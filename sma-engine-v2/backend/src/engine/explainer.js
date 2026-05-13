'use strict';

function fmt(v, d = 2) {
  return v == null || isNaN(v) ? '—' : Number(v).toFixed(d);
}
function fmtRvol(v) {
  return v == null ? '—' : Number(v).toFixed(2) + 'x';
}

function generateExplanation(result, perfContext = null) {
  const {
    ticker, status, relVol20: rv, distPct: dp,
    direction, daysOnPrevSide: days,
  } = result;

  const dist   = fmt(Math.abs(dp || 0));
  const rvStr  = fmtRvol(rv);
  const daysStr = days > 0 ? ` The stock spent ${days} days on the prior side before this event.` : '';

  let base = '';

  switch (status) {
    case 'CA':
      base = `${ticker} crossed above its 50-day SMA. The latest close is ${dist}% above the 50DMA, and relative volume is ${rvStr} the 20-day average. Bullish continuation depends on price holding above the 50DMA with elevated volume.`;
      break;
    case 'CB':
      base = `${ticker} crossed below its 50-day SMA. The latest close is ${dist}% below the 50DMA, and relative volume is ${rvStr} the 20-day average. Continued weakness is likely if price holds below the 50DMA.`;
      break;
    case 'FA':
      base = `${ticker} had its first close above the 50-day SMA.${daysStr} The close is ${dist}% above the SMA, with relative volume at ${rvStr}. Watch for follow-through volume to confirm the break.`;
      break;
    case 'FB':
      base = `${ticker} had its first close below the 50-day SMA.${daysStr} The close is ${dist}% below the SMA, with relative volume at ${rvStr}. Continued selling pressure would confirm the breakdown.`;
      break;
    case 'RC':
      base = `${ticker} reclaimed its 50-day SMA after ${days || 'multiple'} days below it. The close is ${dist}% above the SMA, with relative volume at ${rvStr}. This is a strong bullish event — look for continued volume and price holding above the 50DMA.`;
      break;
    case 'LS':
      base = `${ticker} lost its 50-day SMA after ${days || 'multiple'} days above it. The close is ${dist}% below the SMA, with relative volume at ${rvStr}. This is a significant bearish event. Watch for continuation and elevated selling volume.`;
      break;
    case 'TB':
      base = `${ticker} is testing its 50-day SMA from below. Price is within ${dist}% of the SMA but has not closed above it. Relative volume is ${rvStr}. Watchlist alert — not a confirmed crossing until price closes above the 50DMA.`;
      break;
    case 'TA':
      base = `${ticker} is testing its 50-day SMA from above. The intraday low approached the SMA (${dist}% above) but the stock held. Relative volume is ${rvStr}. Watch for a potential breakdown below the 50DMA.`;
      break;
    case 'RJ':
      base = `${ticker} was rejected at its 50-day SMA. The intraday high touched the SMA but the stock closed below it. This is a bearish rejection event. Relative volume is ${rvStr}. The failure to reclaim the 50DMA is a negative signal.`;
      break;
    case 'HA':
      base = `${ticker} is holding above its 50-day SMA (${dist}% above). No fresh crossing event today. Relative volume is ${rvStr}. Bullish continuation posture — the 50DMA is acting as support.`;
      break;
    case 'HB':
      base = `${ticker} is holding below its 50-day SMA (${dist}% below). No fresh crossing event today. Relative volume is ${rvStr}. Bearish continuation posture — the 50DMA is acting as resistance.`;
      break;
    default:
      base = `${ticker} shows no active 50DMA signal. Distance from 50DMA is ${dist}%. Relative volume is ${rvStr}.`;
  }

  // Append performance context if available (from DB after data accumulates)
  if (perfContext && perfContext.total_signals >= 5) {
    const cr5 = perfContext.confirm_rate_5d != null
      ? `${Number(perfContext.confirm_rate_5d).toFixed(0)}%`
      : null;
    const ar5 = perfContext.avg_return_5d != null
      ? `${Number(perfContext.avg_return_5d) >= 0 ? '+' : ''}${Number(perfContext.avg_return_5d).toFixed(1)}%`
      : null;
    if (cr5 && ar5) {
      base += ` Historical context: ${perfContext.status_type} signals in ${perfContext.sector || 'this sector'} with similar RVol have confirmed at 5 days ${cr5} of the time (avg return ${ar5}, n=${perfContext.total_signals}).`;
    }
  }

  return base;
}

// Short summary for email subject line
function generateAlertSubject(result) {
  const dirEmoji = result.direction === 'Bullish' ? '↑' : result.direction === 'Bearish' ? '↓' : '→';
  const score    = result.signalScore;
  const tier     = score >= 80 ? 'HIGH CONVICTION' : score >= 60 ? 'VALID SIGNAL' : 'WATCH';
  const rvStr    = result.relVol20 ? `${Number(result.relVol20).toFixed(1)}x RVol` : '';
  return `${dirEmoji} ${tier}: ${result.ticker} ${result.status} · Score ${score} · ${rvStr}`;
}

module.exports = { generateExplanation, generateAlertSubject };
