'use strict';

// Default weights — replaced by DB-calibrated weights after enough data
const DEFAULT_WEIGHTS = {
  crossing_quality: 0.45,
  rel_vol:          0.35,
  close_location:   0.10,
  distance:         0.05,
  prior_context:    0.05,
};

// In-memory weights cache — updated by scheduler after nightly recalibration
let _weights = { ...DEFAULT_WEIGHTS };

function setWeights(weightsArray) {
  // weightsArray: [{ factor, weight }] from DB
  if (!weightsArray || !weightsArray.length) return;
  _weights = { ...DEFAULT_WEIGHTS };
  for (const w of weightsArray) {
    if (_weights.hasOwnProperty(w.factor)) {
      _weights[w.factor] = parseFloat(w.weight);
    }
  }
}

function getWeights() {
  return { ..._weights };
}

// ─── SUB-SCORERS ─────────────────────────────────────────────────────────────

function scoreCrossingQuality(status, distPct, closeLocation, daysOnPrevSide) {
  const base = {
    CA: 75, CB: 75, FA: 82, FB: 82,
    RC: 88, LS: 88, RJ: 55,
    TB: 38, TA: 38, HA: 28, HB: 28, NA: 10,
  }[status] || 10;

  let score = base;

  // Bonus for meaningful time on prior side
  if (['FA','FB','RC','LS'].includes(status)) {
    score += Math.min(10, (daysOnPrevSide || 0) * 0.5);
  }

  // Bonus for decisive distance from SMA
  const abs = Math.abs(distPct || 0);
  if (abs > 3) score += 5;
  else if (abs > 1.5) score += 3;

  // Close location bonus
  const isBull = ['CA','FA','RC','HA','TA'].includes(status);
  const isBear = ['CB','FB','LS','HB','TB','RJ'].includes(status);
  if (isBull && closeLocation > 0.7) score += 5;
  if (isBear && closeLocation < 0.3) score += 5;

  return Math.min(100, Math.max(0, Math.round(score)));
}

function scoreRelVol(rv) {
  if (!rv)     return 10;
  if (rv >= 10) return 100;
  if (rv >= 5)  return 92;
  if (rv >= 3)  return 82;
  if (rv >= 2)  return 70;
  if (rv >= 1.5) return 60;
  if (rv >= 1.0) return 50;
  if (rv >= 0.75) return 38;
  if (rv >= 0.5)  return 26;
  if (rv >= 0.25) return 16;
  return 8;
}

function scoreCloseLocation(loc, status) {
  if (loc == null) return 50;
  const isBull = ['CA','FA','RC','HA'].includes(status);
  const isBear = ['CB','FB','LS','HB','RJ'].includes(status);
  if (isBull) return Math.round(loc * 100);
  if (isBear) return Math.round((1 - loc) * 100);
  return 50;
}

function scoreDistance(distPct, status) {
  const abs = Math.abs(distPct || 0);
  // For testing signals, closeness to SMA is the value
  if (['TB','TA'].includes(status)) {
    if (abs < 0.5) return 90;
    if (abs < 1.0) return 75;
    if (abs < 1.5) return 60;
    return 30;
  }
  // For crossing signals, distance = decisiveness
  if (['CA','CB','FA','FB','RC','LS'].includes(status)) {
    if (abs > 5)   return 80;
    if (abs > 3)   return 65;
    if (abs > 1.5) return 55;
    if (abs > 0.5) return 45;
    return 35;
  }
  return 50;
}

function scorePriorContext(daysOnPrevSide, status) {
  if (!daysOnPrevSide) return 40;
  if (['CA','CB','FA','FB','RC','LS'].includes(status)) {
    if (daysOnPrevSide >= 20) return 90;
    if (daysOnPrevSide >= 10) return 75;
    if (daysOnPrevSide >= 5)  return 60;
    if (daysOnPrevSide >= 2)  return 50;
    return 35;
  }
  return 45;
}

// ─── MAIN SCORE FUNCTION ──────────────────────────────────────────────────────

function computeSignalScore(status, distPct, relVol, closeLocation, daysOnPrevSide) {
  const cq  = scoreCrossingQuality(status, distPct, closeLocation, daysOnPrevSide);
  const rv  = scoreRelVol(relVol);
  const cl  = scoreCloseLocation(closeLocation, status);
  const dd  = scoreDistance(distPct, status);
  const pc  = scorePriorContext(daysOnPrevSide, status);

  const w = _weights;
  const total = Math.round(
    Math.min(100, Math.max(0,
      cq * w.crossing_quality +
      rv * w.rel_vol +
      cl * w.close_location +
      dd * w.distance +
      pc * w.prior_context
    ))
  );

  return {
    total,
    crossingQuality:  cq,
    relVolScore:      rv,
    closeLocScore:    cl,
    distScore:        dd,
    priorContextScore: pc,
    weightsUsed: { ...w },
  };
}

module.exports = {
  computeSignalScore,
  setWeights,
  getWeights,
  DEFAULT_WEIGHTS,
};
