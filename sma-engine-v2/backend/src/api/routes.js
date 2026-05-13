'use strict';
const express    = require('express');
const { v4: uuid } = require('uuid');
const queries    = require('../db/queries');
const scanner    = require('../engine/scanner');
const followup   = require('../scheduler/followup');
const perf       = require('../scheduler/performance');
const scheduler  = require('../scheduler/index');
const { requireAuth } = require('./auth');
const logger     = require('../logger');
const config     = require('../config');

const router = express.Router();

// All routes require auth
router.use(requireAuth);

// ─── HEALTH ──────────────────────────────────────────────────────────────────
router.get('/health', async (req, res) => {
  try {
    const dbInfo  = await require('../db/client').testConnection();
    const stats   = await queries.getDashboardStats();
    const jobs    = scheduler.getStatus();
    const weights = await queries.getLatestWeights();
    res.json({
      status:    'ok',
      timestamp: new Date().toISOString(),
      db:        dbInfo,
      stats,
      scheduler: jobs,
      scoreWeights: weights,
      config: {
        tier:          config.scan.defaultTier,
        batchSize:     config.scan.defaultBatchSize,
        schedulerEnabled: config.scheduler.enabled,
        emailConfigured: !!config.email.resendKey,
      },
    });
  } catch (err) {
    res.status(500).json({ status: 'error', error: err.message });
  }
});

// ─── SCANS ────────────────────────────────────────────────────────────────────

// GET /api/scans — list all scans
router.get('/scans', async (req, res) => {
  try {
    const { limit = 50, offset = 0, tier, status } = req.query;
    const scans = await queries.listScans({ limit: parseInt(limit), offset: parseInt(offset), tier, status });
    res.json({ scans, count: scans.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/scans/latest
router.get('/scans/latest', async (req, res) => {
  try {
    const scan = await queries.getLatestCompletedScan();
    if (!scan) return res.json({ scan: null });
    const alerts = await queries.listAlerts({ scanId: scan.id, limit: 500 });
    res.json({ scan, alerts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/scans/:id
router.get('/scans/:id', async (req, res) => {
  try {
    const scan = await queries.getScan(req.params.id);
    if (!scan) return res.status(404).json({ error: 'Scan not found' });
    const alerts = await queries.listAlerts({ limit: 1000 });
    res.json({ scan, alerts: alerts.filter(a => a.scan_id === scan.id) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/scans/trigger — manual scan trigger with SSE streaming
router.post('/scans/trigger', async (req, res) => {
  const {
    tier      = config.scan.defaultTier,
    batchSize = config.scan.defaultBatchSize,
    liqCfg,
  } = req.body || {};

  // Server-Sent Events for real-time progress
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  function send(event, data) {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  }

  const cancelSignal = { cancelled: false };
  const pauseSignal  = { paused: false };

  req.on('close', () => { cancelSignal.cancelled = true; });

  try {
    send('started', { tier, timestamp: new Date().toISOString() });

    const result = await scanner.runScan({
      tier,
      batchSize: parseInt(batchSize) || config.scan.defaultBatchSize,
      liqCfg:    liqCfg || config.scan.liquidity,
      triggerType: 'api',
      cancelSignal,
      pauseSignal,
      onProgress: (pct, msg, liveResult) => {
        if (pct !== null) send('progress', { pct, msg: msg || '' });
        if (liveResult)   send('result',   liveResult);
      },
    });

    send('complete', {
      scanId:   result.scanId,
      tier:     result.tier,
      stats:    result.stats,
      regime:   result.regime,
      alerts:   result.alertsStored,
    });
  } catch (err) {
    send('error', { message: err.message });
    logger.error('Manual scan trigger failed', { error: err.message });
  } finally {
    res.end();
  }
});

// POST /api/scans/jobs/:name — run a named scheduled job now
router.post('/scans/jobs/:name', async (req, res) => {
  try {
    await scheduler.runJobNow(req.params.name);
    res.json({ started: req.params.name, timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ─── ALERTS ──────────────────────────────────────────────────────────────────

router.get('/alerts', async (req, res) => {
  try {
    const { limit=100, offset=0, ticker, status, direction, sector, minScore, dateFrom, dateTo, outcome } = req.query;
    const alerts = await queries.listAlerts({
      limit: parseInt(limit), offset: parseInt(offset),
      ticker, status, direction, sector, minScore, dateFrom, dateTo, outcome,
    });
    res.json({ alerts, count: alerts.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/alerts/active', async (req, res) => {
  try {
    const { rows } = await require('../db/client').query(
      'SELECT * FROM v_active_alerts LIMIT 500'
    );
    res.json({ alerts: rows, count: rows.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/alerts/ticker/:ticker', async (req, res) => {
  try {
    const alerts = await queries.getAlertsByTicker(req.params.ticker, parseInt(req.query.limit || '50'));
    res.json({ ticker: req.params.ticker.toUpperCase(), alerts, count: alerts.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/alerts/:id', async (req, res) => {
  try {
    const alert = await queries.getAlert(req.params.id);
    if (!alert) return res.status(404).json({ error: 'Alert not found' });
    const ft = await queries.getFollowthroughForAlert(req.params.id);
    res.json({ alert, followthrough: ft });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/alerts/:id/outcome', async (req, res) => {
  try {
    const { outcomeLabel } = req.body;
    if (!outcomeLabel) return res.status(400).json({ error: 'outcomeLabel required' });
    await queries.updateAlertOutcome(req.params.id, outcomeLabel);
    res.json({ updated: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── FOLLOW-THROUGH ───────────────────────────────────────────────────────────

router.post('/followthrough/run', async (req, res) => {
  try {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.flushHeaders();

    const summary = await followup.runFollowthroughBatch({
      onProgress: (_, msg) => {
        if (msg) res.write(`data: ${JSON.stringify({ msg })}\n\n`);
      },
    });
    res.write(`event: complete\ndata: ${JSON.stringify(summary)}\n\n`);
    res.end();
  } catch (err) {
    res.write(`event: error\ndata: ${JSON.stringify({ message: err.message })}\n\n`);
    res.end();
  }
});

router.get('/followthrough/pending', async (req, res) => {
  try {
    const result = {};
    for (const days of config.followthrough.checkDays) {
      result[`${days}d`] = await queries.getAlertsPendingFollowup(days);
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/followthrough/:alertId', async (req, res) => {
  try {
    const ft = await queries.getFollowthroughForAlert(req.params.alertId);
    res.json({ followthrough: ft });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── PERFORMANCE STATS ────────────────────────────────────────────────────────

router.get('/performance/stats', async (req, res) => {
  try {
    const { statusType, sector, minSignals = 5 } = req.query;
    const stats = await queries.getPerformanceStats({ statusType, sector, minSignals: parseInt(minSignals) });
    res.json({ stats, count: stats.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/performance/recalc', async (req, res) => {
  try {
    const result = await perf.runPerformanceRecalc();
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/performance/weights', async (req, res) => {
  try {
    const weights = await queries.getLatestWeights();
    const current = require('../engine/scorer').getWeights();
    res.json({ dbWeights: weights, activeWeights: current });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── REGIME ───────────────────────────────────────────────────────────────────

router.get('/regime/history', async (req, res) => {
  try {
    const days = parseInt(req.query.days || '90');
    const history = await queries.getRegimeHistory(days);
    res.json({ history, count: history.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/regime/current', async (req, res) => {
  try {
    const { rows } = await require('../db/client').query(
      'SELECT * FROM regime_log ORDER BY log_date DESC LIMIT 1'
    );
    res.json(rows[0] || { regime_label: 'Unknown' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── DASHBOARD SUMMARY ───────────────────────────────────────────────────────

router.get('/dashboard', async (req, res) => {
  try {
    const [stats, regime, recentScans, activeAlerts, perfStats] = await Promise.all([
      queries.getDashboardStats(),
      queries.getRegimeHistory(7),
      queries.listScans({ limit: 10 }),
      require('../db/client').query('SELECT * FROM v_active_alerts LIMIT 20'),
      queries.getPerformanceStats({ minSignals: 5 }),
    ]);
    res.json({
      stats,
      currentRegime: regime[0] || null,
      recentScans,
      activeAlerts: activeAlerts.rows,
      topPerformingPatterns: (perfStats || []).slice(0, 5),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
