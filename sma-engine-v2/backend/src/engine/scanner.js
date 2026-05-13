'use strict';
const config     = require('../config');
const logger     = require('../logger');
const fetcher    = require('./fetcher');
const calculator = require('./calculator');
const classifier = require('./classifier');
const scorer     = require('./scorer');
const explainer  = require('./explainer');
const universe   = require('./universe');
const queries    = require('../db/queries');
const db         = require('../db/client');

function subtractDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
}
function chunk(arr, size) {
  const c = [];
  for (let i = 0; i < arr.length; i += size) c.push(arr.slice(i, i + size));
  return c;
}
function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// Compute market regime from all results
function computeRegime(results) {
  const valid = results.filter(r => r.status !== 'NA' && r.sma50 != null);
  if (!valid.length) return { label: 'Unknown', pctAbove: null, aboveCrosses: 0, belowCrosses: 0 };
  const above = valid.filter(r => r.price > r.sma50).length;
  const pctAbove = (above / valid.length) * 100;
  const aboveCrosses = results.filter(r => ['CA','FA','RC'].includes(r.status)).length;
  const belowCrosses = results.filter(r => ['CB','FB','LS'].includes(r.status)).length;
  const hvA = results.filter(r => ['CA','FA','RC'].includes(r.status) && (r.relVol20||0) > 1.5).length;
  const hvB = results.filter(r => ['CB','FB','LS'].includes(r.status) && (r.relVol20||0) > 1.5).length;
  let label;
  if (pctAbove >= 55 && aboveCrosses >= belowCrosses && hvA >= hvB) label = 'Bullish';
  else if (pctAbove <= 45 && belowCrosses > aboveCrosses) label = 'Bearish';
  else label = 'Neutral';
  return { label, pctAbove, aboveCrosses, belowCrosses };
}

// Scan a single ticker — returns result object or null if skipped
async function scanTicker(ticker, fromDate, toDate, liqCfg) {
  const bars = await fetcher.fetchBars(ticker, fromDate, toDate);
  const minDays = liqCfg?.minHistoryDays || config.scan.liquidity.minHistoryDays;
  if (!bars || bars.length < minDays) return null;

  const calc = calculator.runCalculations(bars);
  if (!calc) return null;

  const { latest, avgVol20 } = calc;
  if (!universe.passesLiquidity(latest.c, avgVol20, liqCfg)) return null;

  const status        = classifier.classify50DMA(calc);
  const direction     = classifier.DIRECTION[status] || 'Neutral';
  const daysOnPrev    = classifier.getDaysOnPrevSide(status, calc);
  const scores        = scorer.computeSignalScore(
    status, calc.distPct, calc.relVol20, calc.closeLocation, daysOnPrev
  );
  const meta = universe.getMeta(ticker);

  const result = {
    ticker,
    company:          meta.c,
    exchange:         meta.e,
    sector:           meta.s,
    industry:         meta.i,
    status,
    direction,
    signalScore:      scores.total,
    scores,
    price:            latest.c,
    sma50:            calc.sma50,
    prevClose:        calc.prev?.c || null,
    high:             latest.h,
    low:              latest.l,
    open:             latest.o,
    distPct:          calc.distPct,
    prevCloseVs50:    calc.prevCloseVs50,
    currentCloseVs50: calc.distPct,
    closeLocation:    calc.closeLocation,
    daysOnPrevSide:   daysOnPrev,
    volume:           Math.round(latest.v),
    avgVol20:         calc.avgVol20,
    avgVol50:         calc.avgVol50,
    relVol20:         calc.relVol20,
    relVol50:         calc.relVol50,
    ret5d:            calc.ret5d,
    ret10d:           calc.ret10d,
    mcTier:           calc.mcTier,
    timestamp:        new Date(latest.t || Date.now()).toISOString(),
  };
  result.explanation = explainer.generateExplanation(result);
  return result;
}

// ─── MAIN SCAN RUNNER ─────────────────────────────────────────────────────────
// opts.onProgress(pct, msg, liveResult)  — called during scan
// opts.cancelSignal                       — { cancelled: false } ref for cancellation
// opts.pauseSignal                        — { paused: false } ref for pause
async function runScan(opts = {}) {
  const {
    tier         = config.scan.defaultTier,
    batchSize    = config.scan.defaultBatchSize,
    batchDelay   = config.scan.batchDelayMs,
    liqCfg       = config.scan.liquidity,
    triggerType  = 'manual',
    jobName      = null,
    onProgress   = () => {},
    cancelSignal = { cancelled: false },
    pauseSignal  = { paused: false },
    regime: passedRegime = null,
  } = opts;

  const today    = new Date();
  const fromDate = subtractDays(today, 120);
  const toDate   = today.toISOString().split('T')[0];
  const startMs  = Date.now();

  // Create scan record in DB
  const scanId = await queries.createScan({
    tier, triggerType, jobName,
    liquidityCfg: liqCfg,
  });

  const stats = {
    status: 'running',
    scanned: 0, failed: 0, skipped: 0,
    regimeLabel: null, pctAbove: null,
    aboveCrosses: 0, belowCrosses: 0,
    highRvol: 0, extremeRvol: 0,
    testing: 0, rejected: 0, topScore: 0,
    durationSeconds: 0, error: null,
  };

  let allResults = [];
  let tickers;

  try {
    onProgress(2, 'Resolving universe…');
    tickers = await universe.resolveUniverse(tier,
      msg => onProgress(null, msg)
    );
    await queries.finalizeScan(scanId, { ...stats, status: 'running' });
    await db.query('UPDATE scans SET universe_size=$2 WHERE id=$1', [scanId, tickers.length]);

    const batches = chunk(tickers, batchSize);
    const total   = tickers.length;
    let processed = 0;

    for (let bi = 0; bi < batches.length; bi++) {
      if (cancelSignal.cancelled) { stats.status = 'cancelled'; break; }

      // Pause loop
      while (pauseSignal.paused && !cancelSignal.cancelled) {
        await sleep(500);
      }
      if (cancelSignal.cancelled) { stats.status = 'cancelled'; break; }

      const batch = batches[bi];
      for (const ticker of batch) {
        if (cancelSignal.cancelled) break;
        while (pauseSignal.paused && !cancelSignal.cancelled) await sleep(300);

        const pct = Math.round(((processed + 1) / total) * 90) + 5;
        onProgress(pct, `[${processed + 1}/${total}] Scanning ${ticker}…`);
        processed++;

        try {
          await sleep(batchDelay);
          const result = await scanTicker(ticker, fromDate, toDate, liqCfg);
          if (result) {
            stats.scanned++;
            allResults.push(result);
            onProgress(pct, null, result); // stream live result
          } else {
            stats.skipped++;
          }
        } catch (err) {
          if (err.code === 'AUTH') throw err;
          if (err.code === 'RATE') {
            logger.warn(`Rate limited scanning ${ticker}, waiting 15s`);
            await sleep(15000);
          }
          stats.failed++;
          logger.debug(`Scan failed for ${ticker}`, { error: err.message });
        }
      }

      // Inter-batch pause
      if (bi < batches.length - 1 && !cancelSignal.cancelled) {
        await sleep(300);
      }
    }

    // Finalize
    const regime = computeRegime(allResults);
    stats.regimeLabel    = regime.label;
    stats.pctAbove       = regime.pctAbove;
    stats.aboveCrosses   = regime.aboveCrosses;
    stats.belowCrosses   = regime.belowCrosses;
    stats.highRvol       = allResults.filter(r => (r.relVol20||0) > 1.5).length;
    stats.extremeRvol    = allResults.filter(r => (r.relVol20||0) > 3).length;
    stats.testing        = allResults.filter(r => ['TB','TA'].includes(r.status)).length;
    stats.rejected       = allResults.filter(r => r.status === 'RJ').length;
    stats.topScore       = allResults.reduce((m,r) => Math.max(m, r.signalScore||0), 0);
    stats.durationSeconds = Math.round((Date.now() - startMs) / 1000);
    if (stats.status === 'running') stats.status = 'complete';

    onProgress(96, 'Saving alerts to database…');

    // Save active crossing alerts (exclude low-value HA/HB/NA from DB to save space)
    const alertsToSave = allResults.map(r => ({
      ...r,
      regimeAtAlert:   regime.label,
      pctAboveAtAlert: regime.pctAbove,
    }));
    await queries.insertAlerts(scanId, alertsToSave);

    // Save regime log
    try {
      await queries.upsertRegimeLog({
        logDate:      toDate,
        pctAbove:     regime.pctAbove,
        stocksAbove:  allResults.filter(r => (r.price||0) > (r.sma50||0)).length,
        stocksBelow:  allResults.filter(r => (r.price||0) < (r.sma50||0)).length,
        aboveCrosses: regime.aboveCrosses,
        belowCrosses: regime.belowCrosses,
        netCrosses:   regime.aboveCrosses - regime.belowCrosses,
        highRvolAbove: allResults.filter(r => ['CA','FA','RC'].includes(r.status) && (r.relVol20||0) > 1.5).length,
        highRvolBelow: allResults.filter(r => ['CB','FB','LS'].includes(r.status) && (r.relVol20||0) > 1.5).length,
        extremeRvol:  stats.extremeRvol,
        regimeLabel:  regime.label,
        prevRegime:   passedRegime,
        regimeChanged: passedRegime && passedRegime !== regime.label,
        tier, scanId,
      });
    } catch (e) {
      logger.warn('Regime log upsert failed', { error: e.message });
    }

    await queries.finalizeScan(scanId, stats);
    onProgress(100, 'Scan complete.');
    logger.info('Scan complete', { tier, scanned: stats.scanned, alerts: alertsToSave.length, regime: regime.label });

    return {
      scanId, tier, regime, stats,
      results: allResults,
      alertsStored: alertsToSave.length,
    };

  } catch (err) {
    stats.status = 'failed';
    stats.error  = err.message;
    stats.durationSeconds = Math.round((Date.now() - startMs) / 1000);
    await queries.finalizeScan(scanId, stats).catch(() => {});
    logger.error('Scan failed', { tier, error: err.message });
    throw err;
  }
}

module.exports = { runScan, scanTicker, computeRegime };
