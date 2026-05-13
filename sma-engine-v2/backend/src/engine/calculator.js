'use strict';

function computeSMA(closes, period) {
  if (!closes || closes.length < period) return null;
  const slice = closes.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

// Build SMA array across all bars (null where insufficient history)
function buildSMAArray(closes, period) {
  return closes.map((_, i) => {
    if (i < period - 1) return null;
    return closes.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0) / period;
  });
}

function computeAvgVol(vols, period) {
  if (!vols || vols.length < period) return null;
  const slice = vols.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

function computeRelVol(currentVol, avgVol) {
  if (!avgVol || avgVol === 0 || !currentVol) return null;
  return currentVol / avgVol;
}

function computeCloseLocation(o, h, l, c) {
  if (h === l) return 0.5;
  return (c - l) / (h - l);
}

function computeDistancePct(price, sma) {
  if (!sma || sma === 0) return null;
  return ((price - sma) / sma) * 100;
}

// Count consecutive days the close was on a specific side of SMA
// side: 'below' | 'above'
// Looks backwards from bar[n-2] (day before latest)
function computeDaysOnSide(bars, smaArray, side) {
  let count = 0;
  for (let i = bars.length - 2; i >= 0; i--) {
    const sma = smaArray[i];
    if (!sma) break;
    const cond = side === 'below' ? bars[i].c < sma : bars[i].c > sma;
    if (cond) count++;
    else break;
  }
  return count;
}

// Compute n-day return
function computeReturn(bars, n) {
  if (bars.length < n + 1) return null;
  const latest = bars[bars.length - 1].c;
  const prior  = bars[bars.length - 1 - n].c;
  if (!prior) return null;
  return ((latest - prior) / prior) * 100;
}

// Market cap tier based on avg dollar volume
function marketCapTier(price, avgVol20) {
  const dv = price * (avgVol20 || 0);
  if (dv > 500e6) return 'Mega';
  if (dv > 100e6) return 'Large';
  if (dv > 25e6)  return 'Mid';
  if (dv > 5e6)   return 'Small';
  return 'Micro';
}

// Run all calculations for a ticker given its bars
function runCalculations(bars) {
  if (!bars || bars.length < 2) return null;

  const closes = bars.map(b => b.c);
  const vols   = bars.map(b => b.v);
  const latest = bars[bars.length - 1];
  const prev   = bars[bars.length - 2];

  const smaArray  = buildSMAArray(closes, 50);
  const sma50     = smaArray[smaArray.length - 1];
  const smaPrev   = smaArray[smaArray.length - 2];
  if (!sma50 || !smaPrev) return null;

  const avgVol20 = computeAvgVol(vols, 20);
  const avgVol50 = computeAvgVol(vols, 50);
  const relVol20 = computeRelVol(latest.v, avgVol20);
  const relVol50 = computeRelVol(latest.v, avgVol50);

  const distPct        = computeDistancePct(latest.c, sma50);
  const prevCloseVs50  = computeDistancePct(prev.c, smaPrev);
  const closeLocation  = computeCloseLocation(latest.o, latest.h, latest.l, latest.c);

  const ret5d  = computeReturn(bars, 5);
  const ret10d = computeReturn(bars, 10);

  const daysBelow = computeDaysOnSide(bars, smaArray, 'below');
  const daysAbove = computeDaysOnSide(bars, smaArray, 'above');

  return {
    sma50, smaPrev, smaArray,
    avgVol20, avgVol50,
    relVol20, relVol50,
    distPct, prevCloseVs50,
    closeLocation,
    ret5d, ret10d,
    daysBelow, daysAbove,
    latest, prev,
    closes, vols,
    mcTier: marketCapTier(latest.c, avgVol20),
  };
}

module.exports = {
  computeSMA,
  buildSMAArray,
  computeAvgVol,
  computeRelVol,
  computeCloseLocation,
  computeDistancePct,
  computeDaysOnSide,
  computeReturn,
  marketCapTier,
  runCalculations,
};
