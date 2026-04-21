# QUANT TA ENGINE

**Institutional-grade technical analysis powered by 100% real exchange data from [Massive.com](https://massive.com) API.**

Zero AI estimation. Zero proxies. Zero middleware. Just your browser → Massive.com → local quantitative computation.

![Terminal UI](https://img.shields.io/badge/UI-Terminal%20Dark-0A0E14?style=flat-square&labelColor=141A22)
![Data Source](https://img.shields.io/badge/Data-Massive.com%20API-00FF41?style=flat-square&labelColor=0A0E14)
![No Dependencies](https://img.shields.io/badge/Dependencies-Zero-FF8C00?style=flat-square&labelColor=0A0E14)

---

## What It Analyzes

| Criteria | Data Source | Freshness |
|---|---|---|
| Current Price & Day OHLC | Snapshot endpoint | Live (15-min delayed on Starter) |
| 50 / 100 / 200-day SMA | SMA endpoint | 15-min delayed |
| RSI (14-period) | RSI endpoint | 15-min delayed |
| MACD (12/26/9) | MACD endpoint | 15-min delayed |
| Bollinger Bands (20, 2σ) | Computed from OHLC aggs | ~5 day lag on Starter |
| Volume & Relative Volume | Snapshot + aggregates | Live snapshot, avg from aggs |
| Support & Resistance | Multi-source (MAs, BBs, Fib, round numbers) | Mixed |
| Fibonacci Retracement | 52-week range from aggregates | ~5 day lag on Starter |
| Chart Patterns | Computed from daily candles | ~5 day lag on Starter |
| Trade Plan (Entry/Stop/Targets) | Live price + SMA endpoints | 15-min delayed |
| Overall Rating (0-100) | Weighted multi-factor scoring | All sources combined |

## Architecture

```
Browser → api.massive.com (direct HTTPS) → local JS computation → report
```

- **Single HTML file** — no build step, no framework, no npm
- **8 Massive.com API endpoints** called per analysis
- **All analysis computed locally** in your browser — no external AI
- **API key stored in localStorage** — never sent to third parties
- **Reports saved in localStorage** with export/import backup

## Quick Start

### 1. Get a Massive.com API Key

Sign up at [massive.com](https://massive.com) → [Dashboard](https://massive.com/dashboard/keys) → copy your API key.

The **Starter Plan ($29/mo)** includes all endpoints used by this engine.

### 2. Serve from localhost

```bash
# Clone or download
git clone https://github.com/YOUR_USERNAME/quant-ta-engine.git
cd quant-ta-engine

# Serve (Python 3)
python3 -m http.server 8080

# Or Node.js
npx serve -p 8080
```

### 3. Open in browser

```
http://localhost:8080/quant-ta-engine-direct.html
```

### 4. Connect API key

Click **⚙ API KEY** → paste your key → **⚡ TEST CONNECTION** → **▸ CONNECT**

### 5. Run analysis

Enter a ticker (e.g. `AAPL`) → **▸ EXECUTE ANALYSIS**

> **Why localhost?** Browsers block `fetch()` from `file://` pages. Serving from `localhost` allows direct API calls to `api.massive.com`.

## Features

### Dashboard
- All tickers listed alphabetically with latest price, change %, rating, and report count
- Click any ticker to view the latest report
- History button (⏱) shows all past reports for a ticker
- Delete individual tickers

### Analysis Report Card
- **Multi-Timeframe Trend** — Daily, weekly, monthly direction with descriptions
- **Support & Resistance** — 3 levels each, sourced from MAs, BBs, Fibonacci, round numbers, and 52-week range
- **Moving Average Analysis** — SMA-50/100/200 with crossover signals (golden cross / death cross)
- **Oscillators** — RSI gauge, MACD histogram, Bollinger Band width
- **Volume Analysis** — Current, relative (RVOL), and average volume with buyer/seller interpretation
- **Chart Patterns** — Ascending/descending channels, consolidation, Bollinger squeeze
- **Fibonacci Retracement** — 5 key levels from 52-week range
- **Trade Plan** — Entry, stop-loss, 3 profit targets, risk:reward ratio
- **Overall Rating** — Strong Buy → Strong Sell with 0-100 confidence score
- **Future Triggers** — Specific buy/sell conditions

### Backup & Restore
- **Export** all reports as JSON
- **Import** merges without overwriting (deduplicates by timestamp)
- Portable across machines and origins

## Massive.com Endpoints Used

| Endpoint | Path | Purpose |
|---|---|---|
| Snapshot | `/v2/snapshot/locale/us/markets/stocks/tickers/{ticker}` | Live price, day OHLC, volume, prev day |
| Daily Aggregates | `/v2/aggs/ticker/{ticker}/range/1/day/{from}/{to}` | 250-day OHLC for BBs, patterns, 52w range |
| Weekly Aggregates | `/v2/aggs/ticker/{ticker}/range/1/week/{from}/{to}` | Weekly candles for trend analysis |
| SMA | `/v1/indicators/sma/{ticker}` | 50, 100, 200-day simple moving averages |
| RSI | `/v1/indicators/rsi/{ticker}` | 14-period relative strength index |
| MACD | `/v1/indicators/macd/{ticker}` | 12/26/9 moving average convergence/divergence |

## Rating Algorithm

The confidence score (0-100) is a weighted sum of:

| Factor | Bullish Points | Bearish Points |
|---|---|---|
| Daily trend direction | +8 | -8 |
| Weekly trend direction | +10 | -10 |
| Monthly trend direction | +7 | -7 |
| Price above 50-day SMA | +5 | -5 |
| Price above 200-day SMA | +7 | -7 |
| RSI 50-70 (bullish zone) | +6 | — |
| RSI < 40 (bearish zone) | — | -6 |
| MACD histogram positive | +8 | -8 |
| Volume confirms trend | +5 | -5 |
| Golden cross (50 > 200 SMA) | +5 | -5 |

**Score → Rating:**
- 78-100: Strong Buy
- 62-77: Buy
- 42-61: Hold
- 28-41: Sell
- 0-27: Strong Sell

## Starter Plan Limitations

The Massive.com Starter Plan ($29/mo) has a **~5 day delay on aggregate data** (daily/weekly OHLC bars). This affects:
- Bollinger Bands (computed from 20-day aggregates)
- Chart pattern detection (from daily candles)
- 52-week high/low and Fibonacci levels

**Not affected** (15-min delayed):
- Current price (snapshot)
- SMA-50/100/200 (indicator endpoints)
- RSI, MACD (indicator endpoints)
- Trade plan entry/stop/targets (built from snapshot + SMAs)

Upgrade to Developer ($79/mo) or Advanced ($199/mo) for real-time data.

## Security

- API key stored **only** in your browser's `localStorage`
- Key sent **only** to `api.massive.com` via HTTPS
- No telemetry, no analytics, no third-party scripts
- No server-side component — 100% client-side
- Open source — audit the code yourself

## License

MIT

## Disclaimer

This tool is for informational and educational purposes only. Not financial advice. Past performance does not guarantee future results. Always do your own research and consult a licensed financial advisor before making investment decisions.
