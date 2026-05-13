'use strict';
const { Resend }  = require('resend');
const config      = require('../config');
const logger      = require('../logger');

const resend = config.email.resendKey ? new Resend(config.email.resendKey) : null;

function fmt(v, d = 2)  { return v == null ? '—' : Number(v).toFixed(d); }
function fmtPct(v)       { return v == null ? '—' : (v >= 0 ? '+' : '') + Number(v).toFixed(2) + '%'; }
function fmtRvol(v)      { return v == null ? '—' : Number(v).toFixed(2) + 'x'; }
function fmtPrice(v)     { return v == null ? '—' : '$' + Number(v).toFixed(2); }
function fmtVol(v)       { if (!v) return '—'; if (v >= 1e6) return (v/1e6).toFixed(1)+'M'; if (v >= 1e3) return (v/1e3).toFixed(0)+'K'; return String(v); }

const COLORS = {
  green: '#22c55e', red: '#f43f5e', blue: '#3b82f6',
  amber: '#f59e0b', purple: '#a855f7', orange: '#fb923c',
  bg: '#06070d', card: '#0c0e18', border: '#1c2038', text: '#e2e8f0', muted: '#94a3b8',
};

function statusColor(status) {
  if (['CA','FA','RC'].includes(status)) return COLORS.green;
  if (['CB','FB','LS'].includes(status)) return COLORS.red;
  if (['TB','TA'].includes(status))      return COLORS.purple;
  if (status === 'RJ')                   return COLORS.orange;
  return COLORS.muted;
}

function dirColor(dir) {
  return dir === 'Bullish' ? COLORS.green : dir === 'Bearish' ? COLORS.red : COLORS.purple;
}

// Base HTML shell
function htmlShell(title, body) {
  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"/>
<style>
  body{background:${COLORS.bg};color:${COLORS.text};font-family:'Courier New',monospace;margin:0;padding:0;}
  .wrap{max-width:680px;margin:0 auto;padding:24px 16px;}
  .header{background:${COLORS.card};border:1px solid ${COLORS.border};border-radius:8px;padding:16px 20px;margin-bottom:16px;}
  .logo{font-size:18px;font-weight:700;color:${COLORS.blue};letter-spacing:.06em;}
  .sub{font-size:11px;color:${COLORS.muted};margin-top:4px;}
  .section{background:${COLORS.card};border:1px solid ${COLORS.border};border-radius:6px;padding:14px 16px;margin-bottom:12px;}
  .section-title{font-size:9px;font-weight:700;letter-spacing:.12em;color:${COLORS.muted};text-transform:uppercase;margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid ${COLORS.border};}
  .alert-row{display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid ${COLORS.border};}
  .alert-row:last-child{border-bottom:none;}
  .ticker{font-size:14px;font-weight:700;}
  .badge{display:inline-block;padding:2px 8px;border-radius:3px;font-size:9px;font-weight:700;border:1px solid;}
  .score{font-size:12px;font-weight:700;}
  .kpi-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:12px;}
  .kpi{background:#0f1120;border:1px solid ${COLORS.border};border-radius:5px;padding:10px;text-align:center;}
  .kpi-val{font-size:24px;font-weight:700;}
  .kpi-lbl{font-size:9px;color:${COLORS.muted};margin-top:3px;}
  .expl{font-size:11px;color:${COLORS.muted};font-family:Arial,sans-serif;line-height:1.7;margin-top:6px;}
  .footer{font-size:9px;color:#333;text-align:center;margin-top:24px;padding-top:12px;border-top:1px solid #111;}
  a{color:${COLORS.blue};}
  table{width:100%;border-collapse:collapse;font-size:10px;}
  th{text-align:left;color:${COLORS.muted};font-size:9px;letter-spacing:.08em;padding:6px 8px;border-bottom:1px solid ${COLORS.border};}
  td{padding:6px 8px;border-bottom:1px solid #111;color:${COLORS.text};}
</style></head>
<body><div class="wrap">
${body}
<div class="footer">50-Day SMA Crossing Engine · ${new Date().toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric'})} · Data: Massive Stocks Starter (15-min delayed) · Not investment advice</div>
</div></body></html>`;
}

// ─── HIGH-CONVICTION ALERT EMAIL ─────────────────────────────────────────────
async function sendHighConvictionAlert(result, perfContext = null) {
  if (!resend || !config.email.to.length) return false;

  const sColor  = statusColor(result.status);
  const dColor  = dirColor(result.direction);
  const subject = `${result.direction === 'Bullish' ? '↑' : result.direction === 'Bearish' ? '↓' : '→'} ${result.signalScore >= 80 ? 'HIGH CONVICTION' : 'SIGNAL'}: ${result.ticker} · Score ${result.signalScore} · ${fmtRvol(result.relVol20)} RVol`;

  let perfSection = '';
  if (perfContext && perfContext.total_signals >= 5) {
    perfSection = `
    <div class="section">
      <div class="section-title">Historical Performance Context</div>
      <table>
        <tr><th>Metric</th><th>Value</th><th>Sample</th></tr>
        <tr><td>Confirm Rate (5D)</td><td style="color:${COLORS.green}">${fmt(perfContext.confirm_rate_5d)}%</td><td>${perfContext.total_signals} signals</td></tr>
        <tr><td>Avg Return (5D)</td><td style="color:${perfContext.avg_return_5d >= 0 ? COLORS.green : COLORS.red}">${fmtPct(perfContext.avg_return_5d)}</td><td></td></tr>
        <tr><td>Confirm Rate (10D)</td><td>${fmt(perfContext.confirm_rate_10d)}%</td><td></td></tr>
        <tr><td>Avg RVol at Signal</td><td>${fmtRvol(perfContext.avg_rvol_at_signal)}</td><td></td></tr>
      </table>
    </div>`;
  }

  const body = `
  <div class="header">
    <div class="logo">↕50 SMA CROSSING ENGINE</div>
    <div class="sub">Alert generated ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })} ET</div>
  </div>
  <div class="section">
    <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:10px;">
      <div>
        <span class="ticker" style="color:${dColor}">${result.ticker}</span>
        <span style="margin-left:8px;font-size:12px;color:${COLORS.muted}">${result.company}</span><br/>
        <span style="font-size:10px;color:${COLORS.muted}">${result.exchange} · ${result.sector} · ${result.industry}</span>
      </div>
      <span class="score" style="color:${result.signalScore >= 80 ? COLORS.green : result.signalScore >= 60 ? COLORS.blue : COLORS.amber}">Score ${result.signalScore}/100</span>
    </div>
    <span class="badge" style="color:${sColor};border-color:${sColor}33;background:${sColor}11">
      ${result.status}
    </span>
    <span class="badge" style="color:${dColor};border-color:${dColor}33;background:${dColor}11;margin-left:6px">
      ${result.direction}
    </span>
    <div class="expl" style="margin-top:10px">${result.explanation}</div>
  </div>
  <div class="kpi-grid">
    <div class="kpi"><div class="kpi-val" style="color:${COLORS.text}">${fmtPrice(result.price)}</div><div class="kpi-lbl">Price</div></div>
    <div class="kpi"><div class="kpi-val" style="color:${COLORS.muted}">${fmtPrice(result.sma50)}</div><div class="kpi-lbl">50-Day SMA</div></div>
    <div class="kpi"><div class="kpi-val" style="color:${result.distPct >= 0 ? COLORS.green : COLORS.red}">${fmtPct(result.distPct)}</div><div class="kpi-lbl">Distance</div></div>
    <div class="kpi"><div class="kpi-val" style="color:${(result.relVol20||0) > 1.5 ? COLORS.green : COLORS.text}">${fmtRvol(result.relVol20)}</div><div class="kpi-lbl">Rel Vol (20D)</div></div>
    <div class="kpi"><div class="kpi-val">${fmtVol(result.volume)}</div><div class="kpi-lbl">Volume</div></div>
    <div class="kpi"><div class="kpi-val">${result.daysOnPrevSide ?? '—'}</div><div class="kpi-lbl">Days Prior Side</div></div>
  </div>
  ${perfSection}`;

  try {
    await resend.emails.send({
      from:    config.email.from,
      to:      config.email.to,
      subject,
      html:    htmlShell(subject, body),
    });
    logger.info(`Alert email sent for ${result.ticker}`, { score: result.signalScore });
    return true;
  } catch (err) {
    logger.error('Failed to send alert email', { error: err.message });
    return false;
  }
}

// ─── DAILY DIGEST EMAIL ───────────────────────────────────────────────────────
async function sendDailyDigest(scanResult, followthroughSummary = null) {
  if (!resend || !config.email.to.length) return false;

  const { regime, stats, results = [] } = scanResult;
  const date = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });
  const subject = `50DMA Engine · ${date} · ${regime?.label || 'Unknown'} Regime · ${stats.aboveCrosses}↑ ${stats.belowCrosses}↓`;

  const aboveCross = results.filter(r => ['CA','FA','RC'].includes(r.status))
    .sort((a, b) => b.signalScore - a.signalScore).slice(0, 8);
  const belowCross = results.filter(r => ['CB','FB','LS'].includes(r.status))
    .sort((a, b) => b.signalScore - a.signalScore).slice(0, 8);
  const highRvol   = results.filter(r => (r.relVol20||0) > 2 && !['HA','HB','NA'].includes(r.status))
    .sort((a, b) => (b.relVol20||0) - (a.relVol20||0)).slice(0, 5);

  function alertTable(alerts, titleColor) {
    if (!alerts.length) return '<div style="color:#333;font-size:10px;padding:8px 0">No signals</div>';
    return `<table>
      <tr><th>Ticker</th><th>Company</th><th>Status</th><th>Score</th><th>Price</th><th>Dist%</th><th>RVol</th></tr>
      ${alerts.map(r => `<tr>
        <td style="font-weight:700;color:${dirColor(r.direction)}">${r.ticker}</td>
        <td style="color:${COLORS.muted}">${r.company}</td>
        <td><span style="color:${statusColor(r.status)};font-size:9px;font-weight:700">${r.status}</span></td>
        <td style="font-weight:700;color:${r.signalScore>=80?COLORS.green:r.signalScore>=60?COLORS.blue:COLORS.amber}">${r.signalScore}</td>
        <td>${fmtPrice(r.price)}</td>
        <td style="color:${(r.distPct||0)>=0?COLORS.green:COLORS.red}">${fmtPct(r.distPct)}</td>
        <td style="color:${(r.relVol20||0)>1.5?COLORS.green:COLORS.text}">${fmtRvol(r.relVol20)}</td>
      </tr>`).join('')}
    </table>`;
  }

  let ftSection = '';
  if (followthroughSummary) {
    ftSection = `
    <div class="section">
      <div class="section-title">Follow-Through Batch</div>
      <div style="font-size:11px;color:${COLORS.muted}">
        Processed: <strong style="color:${COLORS.text}">${followthroughSummary.processed}</strong> &nbsp;
        Succeeded: <strong style="color:${COLORS.green}">${followthroughSummary.succeeded}</strong> &nbsp;
        Skipped: <strong style="color:${COLORS.amber}">${followthroughSummary.skipped}</strong> &nbsp;
        Failed: <strong style="color:${COLORS.red}">${followthroughSummary.failed}</strong>
      </div>
    </div>`;
  }

  const body = `
  <div class="header">
    <div class="logo">↕50 SMA CROSSING ENGINE · DAILY DIGEST</div>
    <div class="sub">${date} · Tier ${stats?.tier || 'T1'} · ${stats?.scanned || 0} stocks scanned</div>
  </div>
  <div class="kpi-grid">
    <div class="kpi"><div class="kpi-val" style="color:${COLORS.green}">${stats?.aboveCrosses || 0}</div><div class="kpi-lbl">Crossed Above</div></div>
    <div class="kpi"><div class="kpi-val" style="color:${COLORS.red}">${stats?.belowCrosses || 0}</div><div class="kpi-lbl">Crossed Below</div></div>
    <div class="kpi"><div class="kpi-val" style="color:${COLORS.blue}">${stats?.highRvol || 0}</div><div class="kpi-lbl">High RVol</div></div>
    <div class="kpi"><div class="kpi-val" style="color:${regime?.label==='Bullish'?COLORS.green:regime?.label==='Bearish'?COLORS.red:COLORS.purple}">${regime?.label || '—'}</div><div class="kpi-lbl">Regime</div></div>
    <div class="kpi"><div class="kpi-val">${regime?.pctAbove ? fmt(regime.pctAbove, 0) + '%' : '—'}</div><div class="kpi-lbl">% Above 50DMA</div></div>
    <div class="kpi"><div class="kpi-val">${stats?.topScore || '—'}</div><div class="kpi-lbl">Top Score</div></div>
  </div>
  <div class="section">
    <div class="section-title" style="color:${COLORS.green}">Bullish Crossings</div>
    ${alertTable(aboveCross, COLORS.green)}
  </div>
  <div class="section">
    <div class="section-title" style="color:${COLORS.red}">Bearish Crossings</div>
    ${alertTable(belowCross, COLORS.red)}
  </div>
  ${highRvol.length ? `<div class="section">
    <div class="section-title" style="color:${COLORS.blue}">High Relative Volume Events (2x+)</div>
    ${alertTable(highRvol, COLORS.blue)}
  </div>` : ''}
  ${ftSection}`;

  try {
    await resend.emails.send({
      from:    config.email.from,
      to:      config.email.to,
      subject,
      html:    htmlShell(subject, body),
    });
    logger.info('Daily digest sent');
    return true;
  } catch (err) {
    logger.error('Failed to send daily digest', { error: err.message });
    return false;
  }
}

// ─── WEEKLY DIGEST ───────────────────────────────────────────────────────────
async function sendWeeklyDigest(perfStats, regimeHistory) {
  if (!resend || !config.email.to.length) return false;

  const subject = `50DMA Engine · Weekly Research Digest · ${new Date().toLocaleDateString()}`;
  const topPerformers = (perfStats || [])
    .filter(p => p.total_signals >= 5)
    .sort((a, b) => (b.confirm_rate_5d || 0) - (a.confirm_rate_5d || 0))
    .slice(0, 10);

  const perfTable = topPerformers.length
    ? `<table>
        <tr><th>Status</th><th>Sector</th><th>RVol Bucket</th><th>Signals</th><th>Confirm 5D</th><th>Avg 5D Ret</th></tr>
        ${topPerformers.map(p => `<tr>
          <td style="font-weight:700">${p.status_type}</td>
          <td style="color:${COLORS.muted}">${p.sector || 'All'}</td>
          <td>${p.rvol_bucket || 'Any'}</td>
          <td>${p.total_signals}</td>
          <td style="color:${(p.confirm_rate_5d||0)>=60?COLORS.green:COLORS.amber}">${fmt(p.confirm_rate_5d)}%</td>
          <td style="color:${(p.avg_return_5d||0)>=0?COLORS.green:COLORS.red}">${fmtPct(p.avg_return_5d)}</td>
        </tr>`).join('')}
      </table>`
    : '<div style="color:#333;font-size:11px">Insufficient data — accumulating… </div>';

  const body = `
  <div class="header">
    <div class="logo">↕50 SMA CROSSING ENGINE · WEEKLY RESEARCH DIGEST</div>
    <div class="sub">Week ending ${new Date().toLocaleDateString()}</div>
  </div>
  <div class="section">
    <div class="section-title">Pattern Performance (Top Confirm Rates — 5D)</div>
    ${perfTable}
  </div>
  <div class="section">
    <div class="section-title">Regime History (Last 14 Days)</div>
    <table>
      <tr><th>Date</th><th>Regime</th><th>% Above</th><th>Above Crosses</th><th>Below Crosses</th></tr>
      ${(regimeHistory || []).slice(0,14).map(r => `<tr>
        <td>${r.log_date}</td>
        <td style="color:${r.regime_label==='Bullish'?COLORS.green:r.regime_label==='Bearish'?COLORS.red:COLORS.purple}">${r.regime_label}</td>
        <td>${fmt(r.pct_above_50dma, 0)}%</td>
        <td style="color:${COLORS.green}">${r.above_crosses}</td>
        <td style="color:${COLORS.red}">${r.below_crosses}</td>
      </tr>`).join('')}
    </table>
  </div>`;

  try {
    await resend.emails.send({
      from: config.email.from, to: config.email.to,
      subject, html: htmlShell(subject, body),
    });
    logger.info('Weekly digest sent');
    return true;
  } catch (err) {
    logger.error('Failed to send weekly digest', { error: err.message });
    return false;
  }
}

module.exports = { sendHighConvictionAlert, sendDailyDigest, sendWeeklyDigest };
