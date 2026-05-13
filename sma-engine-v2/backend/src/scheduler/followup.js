'use strict';
const logger     = require('../logger');
const fetcher    = require('../engine/fetcher');
const calculator = require('../engine/calculator');
const queries    = require('../db/queries');
const config     = require('../config');

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function subtractTradingDays(dateStr, n) {
  // Approximate: multiply by 1.4 to account for weekends
  const d = new Date(dateStr);
  d.setDate(d.getDate() - Math.ceil(n * 1.4));
  return d.toISOString().split('T')[0];
}

// Determine outcome label based on follow-through data
function computeOutcome(alert, ftData) {
  const { direction, status, price: alertPrice } = alert;
  const { price: ftPrice, heldNewSide } = ftData;

  if (!ftPrice || !alertPrice) return 'Inconclusive';

  const isBull = direction === 'Bullish';
  const isBear = direction === 'Bearish';

  if (heldNewSide && isBull) return 'Confirmed';
  if (heldNewSide && isBear) return 'Confirmed';
  if (!heldNewSide && isBull) return 'Failed';
  if (!heldNewSide && isBear) return 'Failed';

  return 'Inconclusive';
}

// Process follow-through for a single alert at a specific interval
async function processFollowthrough(alert, daysInterval, today) {
  const ticker    = alert.ticker;
  const alertDate = typeof alert.alert_date === 'string'
    ? alert.alert_date
    : alert.alert_date.toISOString().split('T')[0];

  const fromDate = subtractTradingDays(today, 5);
  const toDate   = today;

  try {
    await sleep(120); // rate limit
    const bars = await fetcher.fetchBars(ticker, fromDate, toDate);
    if (!bars || bars.length < 2) return null;

    const latest = bars[bars.length - 1];
    const calc   = calculator.runCalculations(bars);
    if (!calc || !calc.sma50) return null;

    const returnPct  = alert.price
      ? ((latest.c - parseFloat(alert.price)) / parseFloat(alert.price)) * 100
      : null;
    const distPct    = calc.distPct;
    const heldNewSide = alert.direction === 'Bullish'
      ? latest.c > calc.sma50
      : alert.direction === 'Bearish'
        ? latest.c < calc.sma50
        : null;

    const ftData = {
      alertId:       alert.id,
      ticker,
      alertDate,
      checkDate:     today,
      daysSince:     daysInterval,
      price:         latest.c,
      sma50:         calc.sma50,
      volume:        latest.v,
      relVol20:      calc.relVol20,
      closeLocation: calc.closeLocation,
      returnPct,
      heldNewSide,
      distPct,
      outcomeLabel:  computeOutcome(alert, { price: latest.c, heldNewSide }),
    };

    await queries.insertFollowthrough(ftData);
    await queries.markFollowthroughDone(alert.id, daysInterval);

    // Update alert outcome label based on most recent follow-through
    if (daysInterval >= 5) {
      await queries.updateAlertOutcome(alert.id, ftData.outcomeLabel);
    }

    return ftData;
  } catch (err) {
    if (err.code === 'AUTH') throw err;
    if (err.code === 'RATE') await sleep(15000);
    logger.warn(`Follow-through failed for ${ticker} @ ${daysInterval}d`, { error: err.message });
    return null;
  }
}

// ─── MAIN FOLLOW-THROUGH BATCH JOB ───────────────────────────────────────────
async function runFollowthroughBatch(opts = {}) {
  const { onProgress = () => {} } = opts;
  const today = new Date().toISOString().split('T')[0];
  const jobId = await queries.startJobLog('followthrough_batch');

  let processed = 0, succeeded = 0, skipped = 0, failed = 0;

  try {
    for (const days of config.followthrough.checkDays) {
      const pending = await queries.getAlertsPendingFollowup(days);
      if (!pending.length) {
        onProgress(null, `No ${days}D follow-ups pending`);
        continue;
      }

      onProgress(null, `Processing ${pending.length} alerts for ${days}D follow-up…`);

      for (const alert of pending) {
        processed++;
        try {
          const result = await processFollowthrough(alert, days, today);
          if (result) succeeded++;
          else skipped++;
        } catch (err) {
          if (err.code === 'AUTH') throw err;
          failed++;
        }
      }
    }

    const summary = { processed, succeeded, skipped, failed };
    await queries.finishJobLog(jobId, 'success', summary);
    logger.info('Follow-through batch complete', summary);
    return summary;
  } catch (err) {
    await queries.finishJobLog(jobId, 'failed', {}, err.message);
    logger.error('Follow-through batch failed', { error: err.message });
    throw err;
  }
}

module.exports = { runFollowthroughBatch, processFollowthrough };
