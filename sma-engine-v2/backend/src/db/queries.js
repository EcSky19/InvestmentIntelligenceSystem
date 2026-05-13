'use strict';
const db = require('./client');

// ─── SCANS ────────────────────────────────────────────────────────────────────

async function createScan(data) {
  const { rows } = await db.query(`
    INSERT INTO scans (scan_date, scan_time, tier, trigger_type, job_name,
      universe_size, liquidity_cfg, status)
    VALUES (CURRENT_DATE, NOW(), $1, $2, $3, $4, $5, 'running')
    RETURNING id`,
    [data.tier, data.triggerType || 'manual', data.jobName || null,
     data.universeSize || 0, JSON.stringify(data.liquidityCfg || {})]
  );
  return rows[0].id;
}

async function finalizeScan(scanId, stats) {
  await db.query(`
    UPDATE scans SET
      status            = $2,
      scanned_count     = $3,
      failed_count      = $4,
      skipped_count     = $5,
      regime_label      = $6,
      pct_above_50dma   = $7,
      above_crosses     = $8,
      below_crosses     = $9,
      high_rvol_count   = $10,
      extreme_rvol_count= $11,
      testing_count     = $12,
      rejected_count    = $13,
      top_score         = $14,
      duration_seconds  = $15,
      error_message     = $16,
      updated_at        = NOW()
    WHERE id = $1`,
    [scanId, stats.status || 'complete', stats.scanned, stats.failed,
     stats.skipped, stats.regimeLabel, stats.pctAbove,
     stats.aboveCrosses, stats.belowCrosses, stats.highRvol,
     stats.extremeRvol, stats.testing, stats.rejected,
     stats.topScore, stats.durationSeconds, stats.error || null]
  );
}

async function listScans({ limit = 50, offset = 0, tier, status } = {}) {
  const conditions = ['1=1'];
  const params = [];
  if (tier)   { params.push(tier);   conditions.push(`s.tier = $${params.length}`); }
  if (status) { params.push(status); conditions.push(`s.status = $${params.length}`); }
  params.push(limit, offset);
  const { rows } = await db.query(`
    SELECT s.*, COUNT(a.id) AS alert_count
    FROM scans s
    LEFT JOIN alerts a ON a.scan_id = s.id
    WHERE ${conditions.join(' AND ')}
    GROUP BY s.id
    ORDER BY s.scan_time DESC
    LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  return rows;
}

async function getScan(scanId) {
  const { rows } = await db.query(
    'SELECT * FROM scans WHERE id = $1', [scanId]
  );
  return rows[0] || null;
}

async function getLatestCompletedScan() {
  const { rows } = await db.query(`
    SELECT * FROM scans WHERE status = 'complete'
    ORDER BY scan_time DESC LIMIT 1`
  );
  return rows[0] || null;
}

// ─── ALERTS ───────────────────────────────────────────────────────────────────

async function insertAlerts(scanId, alerts) {
  if (!alerts.length) return;
  // Bulk insert using unnest
  const fields = [
    'scan_id','alert_date','ticker','company','exchange','sector','industry',
    'status','direction','signal_score',
    'price','sma50','prev_close','day_high','day_low','day_open',
    'dist_pct','prev_close_vs_50','close_location','days_on_prev_side',
    'volume','avg_vol_20','avg_vol_50','rel_vol_20','rel_vol_50',
    'ret_5d','ret_10d',
    'score_crossing_quality','score_rel_vol','score_close_loc',
    'score_distance','score_prior_context',
    'regime_at_alert','pct_above_at_alert','explanation'
  ];
  for (const alert of alerts) {
    const vals = [
      scanId, new Date().toISOString().split('T')[0],
      alert.ticker, alert.company, alert.exchange, alert.sector, alert.industry,
      alert.status, alert.direction, alert.signalScore,
      alert.price, alert.sma50, alert.prevClose, alert.high, alert.low, alert.open,
      alert.distPct, alert.prevCloseVs50, alert.closeLocation, alert.daysOnPrevSide,
      Math.round(alert.volume || 0), Math.round(alert.avgVol20 || 0), Math.round(alert.avgVol50 || 0), alert.relVol20, alert.relVol50,
      alert.ret5d, alert.ret10d,
      alert.scores?.crossingQuality, alert.scores?.relVolScore,
      alert.scores?.closeLocScore, alert.scores?.distScore, alert.scores?.priorContextScore,
      alert.regimeAtAlert, alert.pctAboveAtAlert, alert.explanation
    ];
    const placeholders = vals.map((_, i) => `$${i + 1}`).join(',');
    await db.query(
      `INSERT INTO alerts (${fields.join(',')}) VALUES (${placeholders})
       ON CONFLICT (scan_id, ticker) DO NOTHING`,
      vals
    );
  }
}

async function listAlerts({
  limit = 100, offset = 0, ticker, status, direction,
  sector, minScore, dateFrom, dateTo, outcome
} = {}) {
  const conds = ['1=1'];
  const params = [];
  const p = (v) => { params.push(v); return `$${params.length}`; };
  if (ticker)    conds.push(`a.ticker = ${p(ticker.toUpperCase())}`);
  if (status)    conds.push(`a.status = ${p(status)}`);
  if (direction) conds.push(`a.direction = ${p(direction)}`);
  if (sector)    conds.push(`a.sector = ${p(sector)}`);
  if (minScore)  conds.push(`a.signal_score >= ${p(parseInt(minScore))}`);
  if (dateFrom)  conds.push(`a.alert_date >= ${p(dateFrom)}`);
  if (dateTo)    conds.push(`a.alert_date <= ${p(dateTo)}`);
  if (outcome)   conds.push(`a.outcome_label = ${p(outcome)}`);
  params.push(limit, offset);
  const { rows } = await db.query(`
    SELECT a.*, s.scan_time, s.tier
    FROM alerts a
    JOIN scans s ON s.id = a.scan_id
    WHERE ${conds.join(' AND ')}
    ORDER BY a.alert_date DESC, a.signal_score DESC
    LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  return rows;
}

async function getAlert(alertId) {
  const { rows } = await db.query(
    `SELECT a.*, s.scan_time, s.tier FROM alerts a
     JOIN scans s ON s.id = a.scan_id WHERE a.id = $1`,
    [alertId]
  );
  return rows[0] || null;
}

async function getAlertsByTicker(ticker, limit = 50) {
  const { rows } = await db.query(
    `SELECT * FROM alerts WHERE ticker = $1
     ORDER BY alert_date DESC LIMIT $2`,
    [ticker.toUpperCase(), limit]
  );
  return rows;
}

async function getAlertsPendingFollowup(daysInterval) {
  // Find alerts where the given follow-up interval is not yet done
  const col = `ft_${daysInterval}d_done`;
  const { rows } = await db.query(`
    SELECT a.* FROM alerts a
    WHERE a.outcome_label = 'Still Active'
      AND a.${col} = FALSE
      AND a.alert_date <= CURRENT_DATE - INTERVAL '${daysInterval} days'
      AND a.alert_date >= CURRENT_DATE - INTERVAL '${daysInterval + 5} days'
    ORDER BY a.alert_date, a.signal_score DESC
  `);
  return rows;
}

async function markFollowthroughDone(alertId, daysInterval) {
  await db.query(
    `UPDATE alerts SET ft_${daysInterval}d_done = TRUE, updated_at = NOW()
     WHERE id = $1`,
    [alertId]
  );
}

async function updateAlertOutcome(alertId, outcomeLabel) {
  await db.query(
    `UPDATE alerts SET outcome_label = $2, updated_at = NOW() WHERE id = $1`,
    [alertId, outcomeLabel]
  );
}

// ─── FOLLOW-THROUGH ───────────────────────────────────────────────────────────

async function insertFollowthrough(data) {
  const { rows } = await db.query(`
    INSERT INTO followthrough
      (alert_id, ticker, alert_date, check_date, days_since,
       price, sma50, volume, rel_vol_20, close_location,
       return_pct, held_new_side, dist_pct, outcome_label)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
    ON CONFLICT (alert_id, days_since) DO UPDATE SET
      price = EXCLUDED.price, return_pct = EXCLUDED.return_pct,
      held_new_side = EXCLUDED.held_new_side, outcome_label = EXCLUDED.outcome_label
    RETURNING id`,
    [data.alertId, data.ticker, data.alertDate, data.checkDate, data.daysSince,
     data.price, data.sma50, data.volume, data.relVol20, data.closeLocation,
     data.returnPct, data.heldNewSide, data.distPct, data.outcomeLabel]
  );
  return rows[0].id;
}

async function getFollowthroughForAlert(alertId) {
  const { rows } = await db.query(
    'SELECT * FROM followthrough WHERE alert_id = $1 ORDER BY days_since',
    [alertId]
  );
  return rows;
}

// ─── REGIME LOG ───────────────────────────────────────────────────────────────

async function upsertRegimeLog(data) {
  await db.query(`
    INSERT INTO regime_log
      (log_date, pct_above_50dma, stocks_above, stocks_below,
       above_crosses, below_crosses, net_crosses,
       high_rvol_above, high_rvol_below, extreme_rvol,
       regime_label, prev_regime, regime_changed, tier_used, scan_id)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
    ON CONFLICT (log_date) DO UPDATE SET
      pct_above_50dma = EXCLUDED.pct_above_50dma,
      above_crosses   = EXCLUDED.above_crosses,
      below_crosses   = EXCLUDED.below_crosses,
      regime_label    = EXCLUDED.regime_label,
      scan_id         = EXCLUDED.scan_id`,
    [data.logDate, data.pctAbove, data.stocksAbove, data.stocksBelow,
     data.aboveCrosses, data.belowCrosses, data.netCrosses,
     data.highRvolAbove, data.highRvolBelow, data.extremeRvol,
     data.regimeLabel, data.prevRegime, data.regimeChanged,
     data.tier, data.scanId]
  );
}

async function getRegimeHistory(days = 90) {
  const { rows } = await db.query(
    `SELECT * FROM regime_log
     WHERE log_date >= CURRENT_DATE - INTERVAL '${days} days'
     ORDER BY log_date DESC`
  );
  return rows;
}

// ─── PERFORMANCE STATS ────────────────────────────────────────────────────────

async function computeAndStorePerformanceStats() {
  // Clear today's stats first
  await db.query(`DELETE FROM performance_stats WHERE computed_date = CURRENT_DATE`);

  // Compute stats grouped by status_type x sector x rvol_bucket x score_bracket
  await db.query(`
    INSERT INTO performance_stats
      (computed_date, status_type, sector, rvol_bucket, score_bracket,
       total_signals,
       confirm_rate_1d, confirm_rate_3d, confirm_rate_5d,
       confirm_rate_10d, confirm_rate_20d,
       avg_return_1d, avg_return_3d, avg_return_5d,
       avg_return_10d, avg_return_20d,
       avg_rvol_at_signal)
    SELECT
      CURRENT_DATE,
      a.status,
      a.sector,
      CASE
        WHEN a.rel_vol_20 >= 3   THEN '3x+'
        WHEN a.rel_vol_20 >= 2   THEN '2-3x'
        WHEN a.rel_vol_20 >= 1.5 THEN '1.5-2x'
        WHEN a.rel_vol_20 >= 1   THEN '1-1.5x'
        WHEN a.rel_vol_20 >= 0.5 THEN '0.5-1x'
        ELSE 'Under 0.5x'
      END AS rvol_bucket,
      (FLOOR(a.signal_score / 10) * 10)::INTEGER AS score_bracket,
      COUNT(DISTINCT a.id) AS total_signals,
      -- 1D confirm rate
      AVG(CASE WHEN f1.held_new_side THEN 1.0 ELSE 0.0 END) * 100,
      AVG(CASE WHEN f3.held_new_side THEN 1.0 ELSE 0.0 END) * 100,
      AVG(CASE WHEN f5.held_new_side THEN 1.0 ELSE 0.0 END) * 100,
      AVG(CASE WHEN f10.held_new_side THEN 1.0 ELSE 0.0 END) * 100,
      AVG(CASE WHEN f20.held_new_side THEN 1.0 ELSE 0.0 END) * 100,
      AVG(f1.return_pct),
      AVG(f3.return_pct),
      AVG(f5.return_pct),
      AVG(f10.return_pct),
      AVG(f20.return_pct),
      AVG(a.rel_vol_20)
    FROM alerts a
    LEFT JOIN followthrough f1  ON f1.alert_id = a.id AND f1.days_since = 1
    LEFT JOIN followthrough f3  ON f3.alert_id = a.id AND f3.days_since = 3
    LEFT JOIN followthrough f5  ON f5.alert_id = a.id AND f5.days_since = 5
    LEFT JOIN followthrough f10 ON f10.alert_id = a.id AND f10.days_since = 10
    LEFT JOIN followthrough f20 ON f20.alert_id = a.id AND f20.days_since = 20
    WHERE a.status NOT IN ('HA','HB','NA')
      AND a.alert_date >= CURRENT_DATE - INTERVAL '365 days'
      AND a.ft_5d_done = TRUE
    GROUP BY a.status, a.sector, rvol_bucket, score_bracket
    HAVING COUNT(DISTINCT a.id) >= 3
    ON CONFLICT (computed_date, status_type, sector, rvol_bucket, score_bracket)
    DO UPDATE SET total_signals = EXCLUDED.total_signals,
      confirm_rate_5d = EXCLUDED.confirm_rate_5d,
      avg_return_5d   = EXCLUDED.avg_return_5d
  `);
}

async function getPerformanceStats({ statusType, sector, minSignals = 5 } = {}) {
  const conds = [`total_signals >= $1`, `computed_date = (SELECT MAX(computed_date) FROM performance_stats)`];
  const params = [minSignals];
  if (statusType) { params.push(statusType); conds.push(`status_type = $${params.length}`); }
  if (sector)     { params.push(sector);     conds.push(`sector = $${params.length}`); }
  const { rows } = await db.query(
    `SELECT * FROM performance_stats WHERE ${conds.join(' AND ')}
     ORDER BY confirm_rate_5d DESC NULLS LAST`,
    params
  );
  return rows;
}

async function getLatestWeights() {
  const { rows } = await db.query(
    `SELECT * FROM score_weights
     WHERE computed_date = (SELECT MAX(computed_date) FROM score_weights)
     ORDER BY factor`
  );
  return rows;
}

// ─── JOB LOG ─────────────────────────────────────────────────────────────────

async function startJobLog(jobName) {
  const { rows } = await db.query(
    `INSERT INTO job_log (job_name) VALUES ($1) RETURNING id`,
    [jobName]
  );
  return rows[0].id;
}

async function finishJobLog(jobId, status, summary, errorMsg) {
  await db.query(
    `UPDATE job_log SET
       finished_at = NOW(),
       duration_ms = EXTRACT(EPOCH FROM (NOW() - started_at)) * 1000,
       status = $2, result_summary = $3, error_message = $4
     WHERE id = $1`,
    [jobId, status, JSON.stringify(summary || {}), errorMsg || null]
  );
}

async function getLastJobRun(jobName) {
  const { rows } = await db.query(
    `SELECT * FROM job_log WHERE job_name = $1
     ORDER BY started_at DESC LIMIT 1`,
    [jobName]
  );
  return rows[0] || null;
}

// ─── STATS HELPERS ────────────────────────────────────────────────────────────

async function getDashboardStats() {
  const { rows } = await db.query(`
    SELECT
      (SELECT COUNT(*) FROM scans WHERE status = 'complete') AS total_scans,
      (SELECT COUNT(*) FROM alerts) AS total_alerts,
      (SELECT COUNT(*) FROM alerts WHERE status IN ('CA','FA','RC')) AS total_above,
      (SELECT COUNT(*) FROM alerts WHERE status IN ('CB','FB','LS')) AS total_below,
      (SELECT COUNT(*) FROM alerts WHERE outcome_label = 'Still Active') AS active_alerts,
      (SELECT COUNT(*) FROM followthrough) AS total_followthroughs,
      (SELECT MAX(scan_time) FROM scans WHERE status = 'complete') AS last_scan_time,
      (SELECT regime_label FROM regime_log ORDER BY log_date DESC LIMIT 1) AS current_regime,
      (SELECT pct_above_50dma FROM regime_log ORDER BY log_date DESC LIMIT 1) AS current_pct_above
  `);
  return rows[0];
}

module.exports = {
  createScan, finalizeScan, listScans, getScan, getLatestCompletedScan,
  insertAlerts, listAlerts, getAlert, getAlertsByTicker,
  getAlertsPendingFollowup, markFollowthroughDone, updateAlertOutcome,
  insertFollowthrough, getFollowthroughForAlert,
  upsertRegimeLog, getRegimeHistory,
  computeAndStorePerformanceStats, getPerformanceStats, getLatestWeights,
  startJobLog, finishJobLog, getLastJobRun,
  getDashboardStats,
};
