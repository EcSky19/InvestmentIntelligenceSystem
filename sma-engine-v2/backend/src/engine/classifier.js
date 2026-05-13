'use strict';

// All 12 status codes and their human labels
const STATUS_CODES = {
  CA: 'Crossing Above 50-Day SMA',
  CB: 'Crossing Below 50-Day SMA',
  FA: 'First Close Above 50-Day SMA',
  FB: 'First Close Below 50-Day SMA',
  TB: 'Testing 50-Day SMA From Below',
  TA: 'Testing 50-Day SMA From Above',
  HA: 'Holding Above 50-Day SMA',
  HB: 'Holding Below 50-Day SMA',
  RJ: 'Rejected At 50-Day SMA',
  RC: 'Reclaimed 50-Day SMA',
  LS: 'Lost 50-Day SMA',
  NA: 'No Active 50DMA Signal',
};

const DIRECTION = {
  CA: 'Bullish', FA: 'Bullish', RC: 'Bullish', HA: 'Bullish',
  CB: 'Bearish', FB: 'Bearish', LS: 'Bearish', RJ: 'Bearish', HB: 'Bearish',
  TB: 'Neutral', TA: 'Neutral', NA: 'Neutral',
};

const STATUS_PRIORITY = {
  CA: 1, FA: 1, RC: 1, CB: 1, FB: 1, LS: 1,
  RJ: 2, TB: 3, TA: 3,
  HA: 4, HB: 4,
  NA: 5,
};

// Core classifier — returns status code string
function classify50DMA(calc) {
  const { latest, prev, sma50, smaPrev, daysBelow, daysAbove } = calc;
  if (!sma50 || !smaPrev || !latest || !prev) return 'NA';

  const cc = latest.c;
  const pc = prev.c;
  const ch = latest.h;
  const cl = latest.l;

  // ── FRESH CROSSES ──────────────────────────────────────────────────────────
  if (pc <= smaPrev && cc > sma50) {
    // Previous close was at/below SMA, current close is above → cross up
    if (daysBelow >= 5) return 'RC';   // Reclaim after 5+ days below
    if (daysBelow >= 1) return 'FA';   // First close above
    return 'CA';                        // Immediate cross
  }

  if (pc >= smaPrev && cc < sma50) {
    // Previous close was at/above SMA, current close is below → cross down
    if (daysAbove >= 5) return 'LS';   // Lost after 5+ days above
    if (daysAbove >= 1) return 'FB';   // First close below
    return 'CB';                        // Immediate cross
  }

  // ── CURRENTLY BELOW SMA ──────────────────────────────────────────────────
  if (cc < sma50) {
    // Intraday high touched or exceeded SMA but closed below → rejection
    if (ch >= sma50 * 0.998) return 'RJ';
    // High is within 1.5% below the SMA → testing from below
    const highDist = ((ch - sma50) / sma50) * 100;
    if (highDist >= -1.5 && highDist < 0) return 'TB';
    return 'HB';
  }

  // ── CURRENTLY ABOVE SMA ──────────────────────────────────────────────────
  if (cc > sma50) {
    // Low came within 1.5% above the SMA → testing from above
    const lowDist = ((cl - sma50) / sma50) * 100;
    if (lowDist <= 1.5 && lowDist > 0) return 'TA';
    return 'HA';
  }

  return 'NA';
}

// Determine how many days were on the prior side before this crossing
function getDaysOnPrevSide(status, calc) {
  const { daysBelow, daysAbove } = calc;
  if (['CA', 'FA', 'RC'].includes(status)) return daysBelow;
  if (['CB', 'FB', 'LS'].includes(status)) return daysAbove;
  return 0;
}

module.exports = {
  STATUS_CODES,
  DIRECTION,
  STATUS_PRIORITY,
  classify50DMA,
  getDaysOnPrevSide,
};
