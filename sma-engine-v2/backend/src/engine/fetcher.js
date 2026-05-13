'use strict';
const axios  = require('axios');
const config = require('../config');
const logger = require('../logger');

const BASE   = config.polygon.baseUrl;
const KEY    = config.polygon.apiKey;

// Rate limit: Starter plan = 5 req/min on some endpoints, 
// but aggs typically allows more. We throttle conservatively.
async function apiFetch(url, params = {}) {
  const fullParams = { ...params, apiKey: KEY };
  try {
    const res = await axios.get(url, {
      params: fullParams,
      timeout: 15000,
    });
    return res.data;
  } catch (err) {
    if (err.response?.status === 403) {
      const e = new Error('Invalid or unauthorized API key');
      e.code = 'AUTH';
      throw e;
    }
    if (err.response?.status === 429) {
      const e = new Error('Rate limit exceeded');
      e.code = 'RATE';
      throw e;
    }
    if (err.code === 'ECONNABORTED') {
      const e = new Error(`Timeout fetching ${url}`);
      e.code = 'TIMEOUT';
      throw e;
    }
    throw err;
  }
}

// Fetch daily OHLCV bars for a ticker over a date range
async function fetchBars(ticker, fromDate, toDate) {
  const url = `${BASE}/v2/aggs/ticker/${encodeURIComponent(ticker)}/range/1/day/${fromDate}/${toDate}`;
  const data = await apiFetch(url, {
    adjusted: 'true',
    sort: 'asc',
    limit: 300,
  });
  return data.results || [];
}

// Previous day bar
async function fetchPrevDay(ticker) {
  try {
    const data = await apiFetch(`${BASE}/v2/aggs/ticker/${encodeURIComponent(ticker)}/prev`);
    return (data.results || [])[0] || null;
  } catch {
    return null;
  }
}

// Snapshot — latest price/volume (may not be available on Starter)
async function fetchSnapshot(ticker) {
  try {
    const data = await apiFetch(
      `${BASE}/v2/snapshot/locale/us/markets/stocks/tickers/${encodeURIComponent(ticker)}`
    );
    return data.ticker || null;
  } catch {
    return null;
  }
}

// Reference ticker list page (for T3/T4 dynamic universe)
async function fetchTickerPage(cursor = null) {
  const params = { market: 'stocks', active: 'true', type: 'CS', limit: 1000 };
  if (cursor) params.cursor = cursor;
  const data = await apiFetch(`${BASE}/v3/reference/tickers`, params);
  const nextCursor = data.next_url
    ? new URL(data.next_url).searchParams.get('cursor')
    : null;
  return { results: data.results || [], nextCursor };
}

// Fetch paginated full ticker list for T3/T4
async function fetchFullTickerList(onProgress) {
  let all = [], cursor = null, page = 0, emptyRuns = 0;
  do {
    if (onProgress) onProgress(`Fetching ticker reference page ${page + 1}…`);
    const { results, nextCursor } = await fetchTickerPage(cursor);
    if (!results.length) { emptyRuns++; if (emptyRuns >= 2) break; }
    else emptyRuns = 0;
    all = all.concat(results.map(r => r.ticker).filter(Boolean));
    cursor = nextCursor;
    page++;
    await sleep(350);
  } while (cursor && page < 12);
  if (all.length < 100) throw new Error(`API returned only ${all.length} tickers`);
  return [...new Set(all)];
}

// Grouped daily bars snapshot — all tickers in one call (if available on plan)
async function fetchGroupedDaily(date) {
  try {
    const data = await apiFetch(`${BASE}/v2/aggs/grouped/locale/us/market/stocks/${date}`, {
      adjusted: 'true',
    });
    return data.results || [];
  } catch {
    return [];
  }
}

// Validate API key with a single lightweight call
async function validateApiKey() {
  await apiFetch(`${BASE}/v2/aggs/ticker/AAPL/prev`);
  return true;
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

module.exports = {
  fetchBars,
  fetchPrevDay,
  fetchSnapshot,
  fetchTickerPage,
  fetchFullTickerList,
  fetchGroupedDaily,
  validateApiKey,
};
