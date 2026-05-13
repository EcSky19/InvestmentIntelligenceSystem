'use strict';
const cron      = require('node-cron');
const config    = require('../config');
const logger    = require('../logger');
const scanner   = require('../engine/scanner');
const followup  = require('./followup');
const perf      = require('./performance');
const email     = require('../alerts/email');
const queries   = require('../db/queries');

// Track active scan to prevent overlapping
let activeScan = null;

async function triggerScan(tier, jobName, triggerType = 'scheduled') {
  if (activeScan) {
    logger.info(`Skipping ${jobName} — scan already running`, { active: activeScan });
    return null;
  }
  const jobId = await queries.startJobLog(jobName);
  try {
    activeScan = jobName;
    logger.info(`Scheduled scan starting: ${jobName}`, { tier });

    // Get previous regime for change detection
    const regimeHistory = await queries.getRegimeHistory(2);
    const prevRegime    = regimeHistory[1]?.regime_label || null;

    const result = await scanner.runScan({
      tier,
      triggerType,
      jobName,
      regime: prevRegime,
      onProgress: (pct, msg) => {
        if (msg) logger.debug(`[${jobName}] ${msg}`);
      },
    });

    // Send high-conviction alerts for score >= 75 crossings
    const highConviction = (result.results || [])
      .filter(r => r.signalScore >= 75 && ['CA','FA','RC','CB','FB','LS','RJ'].includes(r.status))
      .sort((a, b) => b.signalScore - a.signalScore)
      .slice(0, 10); // cap at 10 per scan to avoid inbox flooding

    for (const alert of highConviction) {
      // Look up performance context
      let perfCtx = null;
      try {
        const ps = await queries.getPerformanceStats({
          statusType: alert.status,
          sector: alert.sector,
          minSignals: 5,
        });
        perfCtx = ps[0] || null;
      } catch {}
      await email.sendHighConvictionAlert(alert, perfCtx);
    }

    await queries.finishJobLog(jobId, 'success', {
      tier, scanned: result.stats.scanned, alerts: result.alertsStored,
    });
    return result;
  } catch (err) {
    await queries.finishJobLog(jobId, 'failed', {}, err.message);
    logger.error(`Scheduled scan failed: ${jobName}`, { error: err.message });
    return null;
  } finally {
    activeScan = null;
  }
}

// ─── JOB DEFINITIONS ─────────────────────────────────────────────────────────
// All times are in America/New_York (TZ set in .env)

const JOBS = [

  // ── PRE-MARKET: 8:30 AM Mon–Fri
  // T1 scan on prior day EOD data
  {
    name:     'morning_brief',
    schedule: '30 8 * * 1-5',
    fn: async () => {
      logger.info('Running morning brief scan (T1)');
      await triggerScan('T2', 'morning_brief');
    },
  },

  // ── MARKET OPEN: 9:35 AM Mon–Fri
  {
    name:     'open_scan',
    schedule: '35 9 * * 1-5',
    fn: async () => {
      logger.info('Running open scan (T1)');
      await triggerScan('T2', 'open_scan');
    },
  },

  // ── MID-MORNING: 11:00 AM Mon–Fri
  {
    name:     'midmorning_scan',
    schedule: '0 11 * * 1-5',
    fn: async () => {
      await triggerScan('T2', 'midmorning_scan');
    },
  },

  // ── EARLY AFTERNOON: 1:30 PM Mon–Fri
  {
    name:     'afternoon_scan',
    schedule: '30 13 * * 1-5',
    fn: async () => {
      await triggerScan('T2', 'afternoon_scan');
    },
  },

  // ── PRE-CLOSE: 3:30 PM Mon–Fri
  {
    name:     'preclose_scan',
    schedule: '30 15 * * 1-5',
    fn: async () => {
      await triggerScan('T2', 'preclose_scan');
    },
  },

  // ── EOD CONFIRMED: 4:15 PM Mon–Fri (T2 — confirmed closes)
  {
    name:     'eod_scan',
    schedule: '15 16 * * 1-5',
    fn: async () => {
      logger.info('Running EOD scan (T2)');
      const result = await triggerScan('T2', 'eod_scan');

      // Run follow-through batch immediately after EOD scan
      try {
        logger.info('Running follow-through batch after EOD scan');
        const ftSummary = await followup.runFollowthroughBatch();

        // Send daily digest
        if (result) {
          await email.sendDailyDigest(result, ftSummary);
        }
      } catch (err) {
        logger.error('Post-EOD jobs failed', { error: err.message });
      }
    },
  },

  // ── NIGHTLY PERFORMANCE RECALC: 11:00 PM Mon–Fri
  {
    name:     'performance_recalc',
    schedule: '0 23 * * 1-5',
    fn: async () => {
      logger.info('Running nightly performance recalculation');
      await perf.runPerformanceRecalc();
    },
  },

  // ── WEEKLY DEEP SCAN: Saturday 8:00 AM (T3)
  {
    name:     'weekly_deep_scan',
    schedule: '0 8 * * 6',
    fn: async () => {
      logger.info('Running weekly T3 deep scan');
      await triggerScan('T3', 'weekly_deep_scan');
    },
  },

  // ── WEEKLY DIGEST: Saturday 10:00 AM
  {
    name:     'weekly_digest',
    schedule: '0 10 * * 6',
    fn: async () => {
      logger.info('Sending weekly digest');
      try {
        const [perfStats, regimeHistory] = await Promise.all([
          queries.getPerformanceStats({ minSignals: 5 }),
          queries.getRegimeHistory(14),
        ]);
        await email.sendWeeklyDigest(perfStats, regimeHistory);
      } catch (err) {
        logger.error('Weekly digest failed', { error: err.message });
      }
    },
  },

  // ── DAILY BACKUP: 2:00 AM every day
  {
    name:     'db_backup',
    schedule: '0 2 * * *',
    fn: async () => {
      logger.info('Running database backup');
      const jobId = await queries.startJobLog('db_backup');
      try {
        const { execSync } = require('child_process');
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const filename  = `/tmp/smaengine-backup-${timestamp}.sql.gz`;
        const dbUrl     = process.env.DATABASE_URL || '';
        execSync(`pg_dump "${dbUrl}" | gzip > ${filename}`, { timeout: 120000 });
        logger.info(`Database backup created: ${filename}`);
        // TODO: upload to Backblaze B2 if configured
        await queries.finishJobLog(jobId, 'success', { filename });
      } catch (err) {
        await queries.finishJobLog(jobId, 'failed', {}, err.message);
        logger.error('DB backup failed', { error: err.message });
      }
    },
  },
];

// ─── INIT ─────────────────────────────────────────────────────────────────────
let scheduledTasks = [];

function start() {
  if (!config.scheduler.enabled) {
    logger.info('Scheduler disabled (SCHEDULER_ENABLED=false)');
    return;
  }

  for (const job of JOBS) {
    const task = cron.schedule(job.schedule, async () => {
      logger.info(`Running scheduled job: ${job.name}`);
      try {
        await job.fn();
      } catch (err) {
        logger.error(`Scheduled job error: ${job.name}`, { error: err.message });
      }
    }, { timezone: config.scheduler.tz });

    scheduledTasks.push({ name: job.name, task });
    logger.info(`Scheduled: ${job.name} (${job.schedule} ${config.scheduler.tz})`);
  }

  logger.info(`Scheduler started — ${scheduledTasks.length} jobs registered`);
}

function stop() {
  for (const { name, task } of scheduledTasks) {
    task.stop();
    logger.info(`Stopped scheduled job: ${name}`);
  }
  scheduledTasks = [];
}

function getStatus() {
  return scheduledTasks.map(({ name }) => {
    const job = JOBS.find(j => j.name === name);
    return { name, schedule: job?.schedule, active: name === activeScan };
  });
}

// Manual trigger (for API endpoint)
async function runJobNow(jobName) {
  const job = JOBS.find(j => j.name === jobName);
  if (!job) throw new Error(`Unknown job: ${jobName}`);
  await job.fn();
}

module.exports = { start, stop, getStatus, runJobNow, triggerScan };
