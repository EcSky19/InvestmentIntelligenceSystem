'use strict';
const queries = require('../db/queries');
const scorer  = require('../engine/scorer');
const logger  = require('../logger');

// Recalculate performance stats and optionally update score weights
async function runPerformanceRecalc(opts = {}) {
  const jobId = await queries.startJobLog('performance_recalc');
  try {
    logger.info('Starting performance recalculation…');

    // Rebuild performance_stats table for today
    await queries.computeAndStorePerformanceStats();
    logger.info('Performance stats recomputed');

    // Attempt weight recalibration if enough data exists
    const weights = await recalibrateWeights();
    if (weights) {
      scorer.setWeights(weights);
      logger.info('Score weights updated from performance data', { weights });
    }

    const summary = { weightsUpdated: !!weights };
    await queries.finishJobLog(jobId, 'success', summary);
    return summary;
  } catch (err) {
    await queries.finishJobLog(jobId, 'failed', {}, err.message);
    logger.error('Performance recalc failed', { error: err.message });
    throw err;
  }
}

// Recalibrate weights based on correlation between sub-scores and outcomes
// Only runs when enough data exists (500+ follow-through observations)
async function recalibrateWeights() {
  try {
    const db = require('../db/client');

    // Check if we have enough data
    const { rows: countRows } = await db.query(
      `SELECT COUNT(*) AS cnt FROM followthrough WHERE days_since = 5`
    );
    const count = parseInt(countRows[0].cnt);
    if (count < 200) {
      logger.info(`Skipping weight recalibration — only ${count} 5D follow-throughs (need 200+)`);
      return null;
    }

    // Compute correlation of each sub-score with 5D held_new_side outcome
    const { rows } = await db.query(`
      SELECT
        CORR(a.score_rel_vol::float,       (f.held_new_side::int)::float) AS corr_rvol,
        CORR(a.score_crossing_quality::float, (f.held_new_side::int)::float) AS corr_cq,
        CORR(a.score_close_loc::float,     (f.held_new_side::int)::float) AS corr_cl,
        CORR(a.score_distance::float,      (f.held_new_side::int)::float) AS corr_dist,
        CORR(a.score_prior_context::float, (f.held_new_side::int)::float) AS corr_pc,
        COUNT(*) AS n
      FROM alerts a
      JOIN followthrough f ON f.alert_id = a.id AND f.days_since = 5
      WHERE a.status NOT IN ('HA','HB','NA')
        AND f.held_new_side IS NOT NULL
        AND a.score_rel_vol IS NOT NULL
    `);

    const r = rows[0];
    if (!r || !r.n || parseInt(r.n) < 200) return null;

    // Convert correlations to weights (normalize absolute values to sum to 1.0)
    const raw = {
      rel_vol:          Math.max(0.01, Math.abs(parseFloat(r.corr_rvol) || 0.35)),
      crossing_quality: Math.max(0.01, Math.abs(parseFloat(r.corr_cq)  || 0.45)),
      close_location:   Math.max(0.01, Math.abs(parseFloat(r.corr_cl)  || 0.10)),
      distance:         Math.max(0.01, Math.abs(parseFloat(r.corr_dist)|| 0.05)),
      prior_context:    Math.max(0.01, Math.abs(parseFloat(r.corr_pc)  || 0.05)),
    };

    const total = Object.values(raw).reduce((a, b) => a + b, 0);
    const normalized = {};
    for (const [k, v] of Object.entries(raw)) {
      normalized[k] = parseFloat((v / total).toFixed(4));
    }

    // Store updated weights in DB
    const today = new Date().toISOString().split('T')[0];
    const current = scorer.getWeights();
    for (const [factor, weight] of Object.entries(normalized)) {
      await db.query(`
        INSERT INTO score_weights (computed_date, factor, weight, prev_weight, data_points, notes)
        VALUES ($1, $2, $3, $4, $5, 'Auto-calibrated from outcome correlations')
        ON CONFLICT (computed_date, factor) DO UPDATE SET
          weight = EXCLUDED.weight,
          data_points = EXCLUDED.data_points`,
        [today, factor, weight, current[factor] || null, parseInt(r.n)]
      );
    }

    return Object.entries(normalized).map(([factor, weight]) => ({ factor, weight }));
  } catch (err) {
    logger.warn('Weight recalibration failed', { error: err.message });
    return null;
  }
}

// Load latest weights from DB into scorer (called on server startup)
async function loadWeightsFromDB() {
  try {
    const weights = await queries.getLatestWeights();
    if (weights && weights.length) {
      scorer.setWeights(weights);
      logger.info('Score weights loaded from DB', {
        weights: weights.map(w => `${w.factor}=${w.weight}`).join(', ')
      });
    }
  } catch (err) {
    logger.warn('Could not load weights from DB, using defaults', { error: err.message });
  }
}

module.exports = { runPerformanceRecalc, recalibrateWeights, loadWeightsFromDB };
