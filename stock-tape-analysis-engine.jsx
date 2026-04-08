import { useState, useEffect, useCallback, useMemo, useRef } from "react";

const FN = `'JetBrains Mono','Fira Code','Consolas',monospace`;
const P = { bg: "#0a0c14", pn: "#0f1119", cd: "#141822", hv: "#1a1f2e", bd: "#1c2236", bh: "#2a3350", t1: "#e8eaf0", t2: "#8892a8", t3: "#505a72", t4: "#2e3548", am: "#ff9800", g: "#26a69a", r: "#ef5350", cy: "#29b6f6", mg: "#ce93d8", y: "#ffd54f" };
const n2 = (v, d = 2) => { const x = Number(v); return isNaN(x) ? "—" : x.toFixed(d); };
const pct = (a, b) => b ? ((a / b) * 100) : 0;
const safeMax = (arr) => arr.length ? Math.max(...arr) : 0;
const safeMin = (arr) => arr.length ? Math.min(...arr) : 0;

function parseTapeCSV(text) {
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean); if (lines.length < 3) return null;
  const tl = lines[0].replace(/"/g, ""); let ticker = "", date = "";
  const tm = tl.match(/^(\w+)\s+Time\s+and\s+Sales/i); if (tm) ticker = tm[1].toUpperCase();
  const dm = tl.match(/(\d{2}\/\d{2}\/\d{2,4})/);
  if (dm) { const p = dm[1].split("/"); const yr = p[2].length === 2 ? "20" + p[2] : p[2]; date = `${yr}-${p[0].padStart(2, "0")}-${p[1].padStart(2, "0")}`; }
  const trades = [];
  for (let i = 2; i < lines.length; i++) { const row = []; let q = false, c = ""; for (const ch of lines[i]) { if (ch === '"') q = !q; else if (ch === ',' && !q) { row.push(c.trim()); c = ""; } else c += ch; } row.push(c.trim()); if (row.length < 10) continue; const ts = row[0].trim(), pr = parseFloat(row[5]), sz = parseInt(row[9]); if (isNaN(pr) || isNaN(sz) || !ts) continue; const tp = ts.split(":"); if (tp.length < 3) continue; trades.push({ ts, sec: parseInt(tp[0]) * 3600 + parseInt(tp[1]) * 60 + parseFloat(tp[2]), p: pr, sz }); }
  trades.reverse(); return { ticker, date, trades };
}

function engine(parsed, prevClose) {
  try {
    const { ticker, date, trades } = parsed; if (!trades || !trades.length) return null;
    const pp = trades.map(t => t.p), O = pp[0], Cl = pp[pp.length - 1];
    const H = safeMax(pp), L = safeMin(pp);
    const TV = trades.reduce((a, t) => a + t.sz, 0) || 1;
    const R = H - L || 0.01;
    const vwap = trades.reduce((a, t) => a + t.p * t.sz, 0) / TV;
    const cL = R > 0 ? (Cl - L) / R : 0.5;
    const gap = prevClose ? ((O - prevClose) / prevClose) * 100 : 0;
    const dChg = O ? (Cl - O) / O * 100 : 0;

    const top10 = [...trades].sort((a, b) => b.sz - a.sz).slice(0, 10).map(t => {
      const ph = t.sec < 10 * 3600 ? "OPEN" : t.sec < 11.5 * 3600 ? "MIDM" : t.sec < 14 * 3600 ? "MIDD" : "PWRH";
      const z = t.p >= H - R * 0.15 ? "HI" : t.p <= L + R * 0.15 ? "LO" : Math.abs(t.p - vwap) < R * 0.05 ? "VW" : t.p > vwap ? "A/VW" : "B/VW";
      const it = (t.p >= H - R * 0.2 && t.sz >= 5000) ? "DIST" : (t.p <= L + R * 0.2 && t.sz >= 5000) ? "ACCUM" : "POS";
      return { ...t, ph, z, it };
    });

    const mkPh = (s, e) => { const pts = trades.filter(t => t.sec >= s && t.sec < e); if (!pts.length) return { o: 0, c: 0, h: 0, l: 0, v: 0, chg: 0, n: 0 }; const pps = pts.map(t => t.p); const v = pts.reduce((a, t) => a + t.sz, 0); return { o: pps[0], c: pps[pps.length - 1], h: safeMax(pps), l: safeMin(pps), v, chg: pps[0] ? (pps[pps.length - 1] - pps[0]) / pps[0] * 100 : 0, n: pts.length }; };
    const phases = { od: mkPh(9.5 * 3600, 10 * 3600), mm: mkPh(10 * 3600, 11.5 * 3600), md: mkPh(11.5 * 3600, 14 * 3600), ph: mkPh(14.5 * 3600, 16 * 3600), l30: mkPh(15.5 * 3600, 16 * 3600) };

    let vA = 0, vB = 0; trades.forEach(t => { if (t.p > vwap) vA += t.sz; else vB += t.sz; }); const vwPct = (vA + vB) > 0 ? vA / (vA + vB) * 100 : 50;
    const vp = {}; trades.forEach(t => { const b = (Math.round(t.p * 20) / 20).toFixed(2); vp[b] = (vp[b] || 0) + t.sz; });
    const topN = Object.entries(vp).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([p, v]) => ({ price: +p, vol: v }));
    const poc = topN.length ? topN[0].price : vwap;

    const bT = trades.filter(t => t.sz >= 5000); const bV = bT.reduce((a, t) => a + t.sz, 0);
    const lTr = trades.filter(t => t.sz >= 1000); const lV = lTr.reduce((a, t) => a + t.sz, 0);
    const bNH = bT.filter(t => t.p >= H - R * 0.15).length; const bNL = bT.filter(t => t.p <= L + R * 0.15).length;

    const bZones = { hi: [], abv: [], at: [], blw: [], lo: [] };
    bT.forEach(t => { if (t.p >= H - R * 0.15) bZones.hi.push(t); else if (t.p > vwap + 0.05) bZones.abv.push(t); else if (Math.abs(t.p - vwap) <= 0.05) bZones.at.push(t); else if (t.p >= L + R * 0.15) bZones.blw.push(t); else bZones.lo.push(t); });

    const accW = bT.filter(t => t.p <= vwap).reduce((a, t) => a + t.sz * Math.abs(t.p - vwap), 0);
    const distW = bT.filter(t => t.p > vwap).reduce((a, t) => a + t.sz * Math.abs(t.p - vwap), 0);
    const adR = accW > 0 ? distW / accW : 1;
    const dpCross = trades.filter(t => t.sz >= 25000 && Math.abs(t.p - vwap) <= R * 0.08).sort((a, b) => b.sz - a.sz).slice(0, 6);
    const dpVol = dpCross.reduce((a, t) => a + t.sz, 0);

    const f30i = bT.filter(t => t.sec < 10 * 3600); const l30i = bT.filter(t => t.sec >= 15.5 * 3600);
    const f30v = f30i.reduce((a, t) => a + t.sz, 0); const l30v = l30i.reduce((a, t) => a + t.sz, 0);
    const f30a = f30v > 0 ? f30i.reduce((a, t) => a + t.p * t.sz, 0) / f30v : 0;
    const l30a = l30v > 0 ? l30i.reduce((a, t) => a + t.p * t.sz, 0) / l30v : 0;
    const smShift = (l30a && f30a) ? l30a - f30a : 0;

    const clusters = []; let ci = 0;
    while (ci < bT.length) { const cl = [bT[ci]]; let cj = ci + 1; while (cj < bT.length && bT[cj].sec - cl[cl.length - 1].sec <= 60) { cl.push(bT[cj]); cj++; } if (cl.length >= 3) { const v = cl.reduce((a, t) => a + t.sz, 0); const ap = v > 0 ? cl.reduce((a, t) => a + t.p * t.sz, 0) / v : 0; clusters.push({ time: cl[0].ts.substring(0, 5), cnt: cl.length, vol: v, avgP: ap, it: ap > vwap ? "DIST" : "ACCUM" }); } ci = cj > ci + 1 ? cj : ci + 1; }
    clusters.sort((a, b) => b.vol - a.vol);

    const instPart = [["OPEN", 9.5 * 3600, 10 * 3600], ["MIDM", 10 * 3600, 11.5 * 3600], ["MIDD", 11.5 * 3600, 14 * 3600], ["PWRH", 14.5 * 3600, 16 * 3600]].map(([n, s, e]) => { const all = trades.filter(t => t.sec >= s && t.sec < e); const inst = all.filter(t => t.sz >= 1000); const aV = all.reduce((a, t) => a + t.sz, 0) || 1; const iV = inst.reduce((a, t) => a + t.sz, 0); return { n, ip: iV / aV * 100, bp: all.filter(t => t.sz >= 5000).reduce((a, t) => a + t.sz, 0) / aV * 100 }; });

    const bMap = {}; trades.forEach(t => { const k = Math.floor(t.sec / 300) * 300; if (!bMap[k]) bMap[k] = { p: [], v: 0 }; bMap[k].p.push(t.p); bMap[k].v += t.sz; });
    const bars = Object.keys(bMap).sort((a, b) => a - b).map(k => { const d = bMap[k]; return { sec: +k, o: d.p[0], c: d.p[d.p.length - 1], h: safeMax(d.p), l: safeMin(d.p), v: d.v }; });
    let dipBuys = 0, rallySells = 0; for (let i = 2; i < bars.length; i++) { if (bars[i - 1].c < bars[i - 1].o && bars[i].c > bars[i].o && bars[i].v > bars[i - 1].v * 1.2) dipBuys++; if (bars[i - 1].c > bars[i - 1].o && bars[i].c < bars[i].o && bars[i].v > bars[i - 1].v * 1.2) rallySells++; }
    const hT = trades.reduce((a, t) => t.p > a.p ? t : a, trades[0]); const lT2 = trades.reduce((a, t) => t.p < a.p ? t : a, trades[0]);
    const hFH = hT.sec < 12.5 * 3600; const lSH = lT2.sec > 12.5 * 3600;
    let distBars = 0; const avgBarVol = TV / (bars.length || 1); bars.forEach(b => { if (b.v > avgBarVol * 2 && (b.h - b.l) < R * 0.03) distBars++; });
    const lhSell = phases.l30.c < phases.l30.o && phases.l30.v > TV / (6.5 * 2) * 1.3;

    let ut = 0, dt = 0, zt = 0, uV = 0, dV = 0, zV = 0;
    for (let i = 1; i < trades.length; i++) { const dp = trades[i].p - trades[i - 1].p; if (dp > 0) { ut++; uV += trades[i].sz; } else if (dp < 0) { dt++; dV += trades[i].sz; } else { zt++; zV += trades[i].sz; } }
    const tR = dt > 0 ? ut / dt : 1; const vTR = dV > 0 ? uV / dV : 1;
    const tpm = {}; trades.forEach(t => { const m = Math.floor(t.sec / 60); tpm[m] = (tpm[m] || 0) + 1; });
    const tpmArr = Object.entries(tpm).map(([m, c]) => [+m, c]).sort((a, b) => a[0] - b[0]);
    const pkV = tpmArr.length ? safeMax(tpmArr.map(x => x[1])) : 0; const avgVel = trades.length / (6.5 * 60);
    let mxA = 0, mxD = 0, acT = "", deT = "";
    for (let i = 1; i < tpmArr.length; i++) { if (tpmArr[i][0] - tpmArr[i - 1][0] === 1) { const d = tpmArr[i][1] - tpmArr[i - 1][1]; if (d > mxA) { mxA = d; acT = `${Math.floor(tpmArr[i][0] / 60)}:${String(tpmArr[i][0] % 60).padStart(2, "0")}`; } if (d < mxD) { mxD = d; deT = `${Math.floor(tpmArr[i][0] / 60)}:${String(tpmArr[i][0] % 60).padStart(2, "0")}`; } } }
    const gaps = []; for (let i = 1; i < trades.length; i++) { const d = trades[i].sec - trades[i - 1].sec; if (d >= 0) gaps.push(d); }
    const gapsMs = gaps.map(d => d * 1000).sort((a, b) => a - b);
    const medITT = gapsMs.length ? gapsMs[Math.floor(gapsMs.length / 2)] : 0;
    const sameMs = gapsMs.filter(d => d === 0).length; const sameMsPct = trades.length ? sameMs / trades.length * 100 : 0;
    const runs = []; let cDir = 0, cLen = 0;
    for (let i = 1; i < trades.length; i++) { const dp = trades[i].p - trades[i - 1].p; const d = dp > 0 ? 1 : dp < 0 ? -1 : 0; if (d === cDir && d !== 0) { cLen++; } else { if (cLen > 0) runs.push([cDir, cLen]); cDir = d; cLen = 1; } }
    if (cLen > 0) runs.push([cDir, cLen]);
    const uR = runs.filter(r => r[0] === 1); const dR = runs.filter(r => r[0] === -1);
    const aUR = uR.length ? uR.reduce((a, r) => a + r[1], 0) / uR.length : 0; const aDR = dR.length ? dR.reduce((a, r) => a + r[1], 0) / dR.length : 0;
    const mUR = uR.length ? safeMax(uR.map(r => r[1])) : 0; const mDR = dR.length ? safeMax(dR.map(r => r[1])) : 0;

    let cumD = 0; const cumDs = [0];
    for (let i = 1; i < trades.length; i++) { const dp = trades[i].p - trades[i - 1].p; if (dp > 0) cumD += trades[i].sz; else if (dp < 0) cumD -= trades[i].sz; cumDs.push(cumD); }
    const maxCD = safeMax(cumDs); const minCD = safeMin(cumDs); const dRange = (maxCD - minCD) || 1;
    const dRecov = cumD - minCD; const dRecovPct = dRange > 0 ? dRecov / dRange * 100 : 50;
    const dPh = [];
    [["10:00", 10 * 3600], ["11:30", 11.5 * 3600], ["14:00", 14 * 3600], ["15:30", 15.5 * 3600], ["CLOSE", 16 * 3600]].forEach(([l, s]) => { const idx = trades.findIndex(t => t.sec >= s); if (idx >= 0 && idx < cumDs.length) dPh.push({ l, v: cumDs[idx] }); });

    const msG = {}; trades.forEach(t => { const k = Math.round(t.sec * 1000); if (!msG[k]) msG[k] = []; msG[k].push(t); });
    const sweeps = []; Object.values(msG).forEach(g => { if (g.length >= 3) { const ps = [...new Set(g.map(t => t.p))]; if (ps.length >= 2) sweeps.push({ cnt: g.length, sz: g.reduce((a, t) => a + t.sz, 0), mn: safeMin(ps), mx: safeMax(ps), t: g[0].ts }); } });
    const tSV = sweeps.reduce((a, s) => a + s.sz, 0);
    const sNH = sweeps.filter(s => s.mx >= H - R * 0.15).length; const sNL = sweeps.filter(s => s.mn <= L + R * 0.15).length;
    const topSw = [...sweeps].sort((a, b) => b.sz - a.sz).slice(0, 5);

    const bucketSz = Math.max(1, Math.floor(TV / 50)); const vpnB = []; let bU = 0, bD = 0, bVo = 0;
    for (let i = 1; i < trades.length; i++) { const dp = trades[i].p - trades[i - 1].p; if (dp > 0) bU += trades[i].sz; else if (dp < 0) bD += trades[i].sz; else { bU += Math.floor(trades[i].sz / 2); bD += Math.floor(trades[i].sz / 2); } bVo += trades[i].sz; if (bVo >= bucketSz && (bU + bD) > 0) { vpnB.push(Math.abs(bU - bD) / (bU + bD)); bU = 0; bD = 0; bVo = 0; } }
    const vpin = vpnB.length ? vpnB.reduce((a, b) => a + b, 0) / vpnB.length : 0;

    const v5m = {}; trades.forEach(t => { const k = Math.floor(t.sec / 300); v5m[k] = (v5m[k] || 0) + t.sz; });
    const v5s = Object.entries(v5m).sort((a, b) => +a[0] - +b[0]);
    const topVA = []; for (let i = 1; i < v5s.length; i++) { const prev = +v5s[i - 1][1]; if (prev > 0) { const cur = +v5s[i][1]; const sec2 = +v5s[i][0] * 300; topVA.push({ time: `${Math.floor(sec2 / 3600)}:${String(Math.floor((sec2 % 3600) / 60)).padStart(2, "0")}`, pct: (cur - prev) / prev * 100, vol: cur }); } }
    topVA.sort((a, b) => b.pct - a.pct); const topVA5 = topVA.slice(0, 5);

    const psSeq = {}; trades.forEach((t, i) => { const k = `${t.p}_${t.sz}`; if (!psSeq[k]) psSeq[k] = []; psSeq[k].push(i); });
    let iceCount = 0; const topIce = [];
    Object.entries(psSeq).forEach(([k, indices]) => { if (indices.length >= 5) { const parts = k.split("_"); const pr = parseFloat(parts[0]); const sz = parseInt(parts[1]); if (!isNaN(pr) && !isNaN(sz) && sz >= 100) { for (let j = 0; j <= indices.length - 5; j++) { const w = indices.slice(j, j + 5); const span = trades[w[4]].sec - trades[w[0]].sec; if (span < 60 && span >= 0) { iceCount++; topIce.push({ p: pr, sz, t: trades[w[0]].ts, sp: span }); break; } } } } });
    topIce.sort((a, b) => b.sz - a.sz);

    const sBk = { ol: { c: 0, v: 0 }, r1: { c: 0, v: 0 }, s15: { c: 0, v: 0 }, s59: { c: 0, v: 0 }, s1k: { c: 0, v: 0 }, s5k: { c: 0, v: 0 }, s10k: { c: 0, v: 0 }, s50k: { c: 0, v: 0 } };
    trades.forEach(t => { const s = t.sz; let k; if (s < 100) k = "ol"; else if (s === 100) k = "r1"; else if (s < 500) k = "s15"; else if (s < 1000) k = "s59"; else if (s < 5000) k = "s1k"; else if (s < 10000) k = "s5k"; else if (s < 50000) k = "s10k"; else k = "s50k"; sBk[k].c++; sBk[k].v += s; });
    const rndL = trades.filter(t => t.sz % 100 === 0 && t.sz >= 100).length; const oddPct = trades.length ? (trades.length - rndL) / trades.length * 100 : 0;
    const algoS = {};[100, 200, 500, 1000, 2000, 5000].forEach(s => { const c = trades.filter(t => t.sz === s).length; if (c > 50) algoS[s] = { c, p: c / trades.length * 100 }; });
    const mBI = {}; trades.forEach(t => { const m = Math.floor(t.sec / 60); if (!mBI[m]) mBI[m] = { t: [], v: 0 }; mBI[m].t.push(t); mBI[m].v += t.sz; });
    const impacts = []; Object.values(mBI).forEach(bar => { if (bar.t.length > 1 && bar.v > 0) { const dp = Math.abs(bar.t[bar.t.length - 1].p - bar.t[0].p); impacts.push(dp / (bar.v / 1e6)); } });
    const avgImp = impacts.length ? impacts.reduce((a, b) => a + b, 0) / impacts.length : 0;

    const p1m = {}; trades.forEach(t => { p1m[Math.floor(t.sec / 60)] = t.p; });
    const mns = Object.keys(p1m).map(Number).sort((a, b) => a - b);
    const r1m = []; for (let i = 1; i < mns.length; i++) { if (mns[i] - mns[i - 1] <= 2 && p1m[mns[i - 1]] > 0) r1m.push(Math.log(p1m[mns[i]] / p1m[mns[i - 1]])); }
    const rv1m = r1m.length ? Math.sqrt(r1m.reduce((a, r) => a + r * r, 0)) : 0; const rvAnn = rv1m * Math.sqrt(252);
    const p5m = {}; trades.forEach(t => { p5m[Math.floor(t.sec / 300)] = t.p; }); const m5 = Object.keys(p5m).map(Number).sort((a, b) => a - b);
    const r5m = []; for (let i = 1; i < m5.length; i++) { if (m5[i] - m5[i - 1] <= 2 && p5m[m5[i - 1]] > 0) r5m.push(Math.log(p5m[m5[i]] / p5m[m5[i - 1]])); }
    const rv5m = r5m.length ? Math.sqrt(r5m.reduce((a, r) => a + r * r, 0)) : 0;
    let hurst = 0.5; if (r1m.length >= 20) { const n = r1m.length; const mean = r1m.reduce((a, b) => a + b, 0) / n; const devs = r1m.map(r => r - mean); let cs2 = 0; const cd = devs.map(d => { cs2 += d; return cs2; }); const Rr = safeMax(cd) - safeMin(cd); const S = Math.sqrt(devs.reduce((a, d) => a + d * d, 0) / n); if (S > 0 && n > 1) hurst = Math.log(Rr / S) / Math.log(n); }
    let voV = 0; if (r5m.length >= 5) { const mr = r5m.reduce((a, b) => a + b, 0) / r5m.length; voV = Math.sqrt(r5m.reduce((a, r) => a + (r - mr) ** 2, 0) / r5m.length); }
    const gkRaw = 0.5 * Math.log(H / L) ** 2 - (2 * Math.log(2) - 1) * Math.log(Cl / O) ** 2;
    const gkV = Math.sqrt(Math.abs(gkRaw) * 252) * 100;

    // S/R
    const sups = []; const ress = [];
    if (prevClose) { if (prevClose < Cl) sups.push({ price: prevClose, src: "PREV", ev: `Prev $${n2(prevClose)}` }); else ress.push({ price: prevClose, src: "PREV", ev: `Prev $${n2(prevClose)}` }); }
    ress.push({ price: H, src: "HIGH", ev: `High ${hT.ts.substring(0, 8)}` });
    sups.push({ price: L, src: "LOW", ev: `Low ${lT2.ts.substring(0, 8)}` });
    if (vwap > Cl) ress.push({ price: vwap, src: "VWAP", ev: `VWAP $${n2(vwap, 4)}` }); else sups.push({ price: vwap, src: "VWAP", ev: `VWAP $${n2(vwap, 4)}` });
    if (poc > Cl) ress.push({ price: poc, src: "POC", ev: `POC $${n2(poc)}` }); else sups.push({ price: poc, src: "POC", ev: `POC $${n2(poc)}` });
    topN.slice(0, 4).forEach(nd => { if (nd.price > Cl && !ress.find(r => Math.abs(r.price - nd.price) < 0.02)) ress.push({ price: nd.price, src: "VPRF", ev: `HVN ${n2(nd.vol / 1e6)}M` }); if (nd.price < Cl && !sups.find(s => Math.abs(s.price - nd.price) < 0.02)) sups.push({ price: nd.price, src: "VPRF", ev: `HVN ${n2(nd.vol / 1e6)}M` }); });
    ress.sort((a, b) => a.price - b.price); sups.sort((a, b) => b.price - a.price);

    // SCORING
    const sigs = []; let score = 0; const sig = (t, v, c) => { sigs.push({ t, v, c }); score += v; };
    if (cL >= 0.75) sig("Close near high", 2, "g"); else if (cL <= 0.25) sig("Close near low", -2, "r"); else if (cL >= 0.6) sig("Close upper", 1, "g"); else if (cL <= 0.4) sig("Close lower", -1, "r"); else sig("Close mid", 0, "y");
    if (Cl > vwap * 1.005) sig("Above VWAP", 1, "g"); else if (Cl < vwap * 0.995) sig("Below VWAP", -1, "r");
    if (gap > 3) sig("Gap up +" + n2(gap, 1) + "%", 1, "g"); else if (gap < -3) sig("Gap down", 1, "r");
    if (phases.od.chg > 1) sig("Bull open", 1, "g"); else if (phases.od.chg < -1) sig("Bear open", -1, "r");
    if (phases.ph.chg > 1.5) sig("Bull PH", 2, "g"); else if (phases.ph.chg < -1.5) sig("Bear PH", -2, "r");
    if (vwPct > 65) sig("Strong abv VWAP", 2, "g"); else if (vwPct < 35) sig("Weak blw VWAP", -2, "r");
    if (bNH > bNL * 1.5 && bNH > 10) sig("Inst sell hi(" + bNH + ")", -2, "r"); else if (bNL > bNH * 1.5 && bNL > 10) sig("Inst buy lo(" + bNL + ")", 2, "g");
    if (distBars > 5) sig("Distribution", -1, "r"); if (lhSell) sig("Late selling", -2, "r");
    if (hFH && lSH) sig("Trend Down", -2, "r"); else if (!hFH && !lSH) sig("Trend Up", 2, "g");
    if (vTR > 1.15) sig("TickVR " + n2(vTR, 2), 2, "g"); else if (vTR < 0.85) sig("TickVR " + n2(vTR, 2), -2, "r");
    if (cumD > TV * 0.03) sig("CumD +" + n2(cumD / 1e6) + "M", 2, "g"); else if (cumD < -TV * 0.03) sig("CumD " + n2(cumD / 1e6) + "M", -2, "r");
    if (dRecovPct > 70) sig("D Recov " + n2(dRecovPct, 0) + "%", 1, "g"); else if (dRecovPct < 30) sig("D Recov " + n2(dRecovPct, 0) + "%", -1, "r");
    if (sNH > sNL * 2) sig("Sweeps@hi", -1, "r"); else if (sNL > sNH * 2) sig("Sweeps@lo", 1, "g");
    if (vpin > 0.3) sig("VPIN " + n2(vpin * 100, 0) + "%", -1, "r");
    if (mDR > mUR + 2) sig("Dn runs longer", -1, "r"); else if (mUR > mDR + 2) sig("Up runs longer", 1, "g");
    if (dChg < -2) sig("Weak close " + n2(dChg, 1) + "%", -1, "r"); else if (dChg > 2) sig("Strong close", 1, "g");
    if (cL > 0.35 && lSH && phases.ph.chg > 2) sig("Late recovery", 1, "g");
    if (prevClose && gap > 2 && L <= prevClose * 1.005) sig("Gap filled", -1, "r");

    const bias = score >= 7 ? "STRONG BULL" : score >= 3 ? "BULLISH" : score >= 1 ? "LEAN BULL" : score <= -7 ? "STRONG BEAR" : score <= -3 ? "BEARISH" : score <= -1 ? "LEAN BEAR" : "NEUTRAL";
    const biasC = score >= 3 ? P.g : score >= 1 ? P.g : score <= -3 ? P.r : score <= -1 ? P.r : P.y;

    let bSc = 0, beSc = 0, cSc = 0, rSc = 0;
    if (cL >= 0.7) bSc += 12; else if (cL >= 0.5) { bSc += 4; cSc += 4; } else if (cL <= 0.3) beSc += 12; else { cSc += 6; beSc += 4; }
    if (Cl > vwap * 1.01) bSc += 8; else if (Cl < vwap * 0.99) beSc += 8; else cSc += 4;
    if (phases.ph.chg > 2) { bSc += 10; rSc += 7; } else if (phases.ph.chg < -2) beSc += 10; else cSc += 3;
    if (hFH && lSH) beSc += 12; else if (!hFH && !lSH) bSc += 12; else { cSc += 6; rSc += 4; }
    if (bNH > bNL * 1.5) beSc += 8; if (distBars > 5) beSc += 6; if (lhSell) beSc += 8;
    if (dChg < -5 && phases.ph.chg > 3) { rSc += 18; bSc += 4; } else if (dChg < -5 && phases.ph.chg > 1) rSc += 10;
    if (cL > 0.35 && cL < 0.55 && R / O > 0.1) { rSc += 6; cSc += 4; }
    if (gap > 3 && Cl < O) beSc += 6; if (prevClose && gap > 5 && L <= prevClose * 1.005) { beSc += 4; rSc += 4; }
    if (vTR < 0.85) beSc += 8; else if (vTR > 1.15) bSc += 8; else cSc += 3;
    if (cumD < -TV * 0.05) beSc += 10; else if (cumD > TV * 0.05) bSc += 10; else cSc += 4;
    if (dRecovPct < 30) beSc += 6; else if (dRecovPct > 70) { rSc += 10; bSc += 4; }
    if (sNH > sNL * 2) beSc += 6; if (vpin > 0.3) beSc += 5; if (hurst < 0.45) { cSc += 5; rSc += 3; }
    if (oddPct > 35 && dChg < -3) rSc += 5; if (mDR > mUR + 2) beSc += 4; if (voV > 0.015) cSc += 5;
    const rawT = bSc + beSc + cSc + rSc || 1;
    let scenarios = [{ l: "BEAR", p: Math.round(beSc / rawT * 100), c: P.r }, { l: "REVERSAL", p: Math.round(rSc / rawT * 100), c: P.mg }, { l: "BULL", p: Math.round(bSc / rawT * 100), c: P.g }, { l: "CHOP", p: Math.round(cSc / rawT * 100), c: P.y }];
    const tot = scenarios.reduce((a, s) => a + s.p, 0); if (tot !== 100) scenarios[0].p += (100 - tot);
    scenarios.sort((a, b) => b.p - a.p);

    const ndL = [];
    if (ress[0]) ndL.push({ price: ress[0].price, lb: "R1", c: P.r, act: "Reject = SHORT tgt $" + n2(Cl) });
    if (ress[1]) ndL.push({ price: ress[1].price, lb: "R2", c: P.r, act: "Break+hold = flip LONG" });
    ndL.push({ price: vwap, lb: "VWAP", c: P.am, act: "Reclaim=bull. Reject=bear." });
    ndL.push({ price: Cl, lb: "CLOSE", c: P.cy, act: "Open above=bull. Below=weak." });
    if (sups[0]) ndL.push({ price: sups[0].price, lb: "S1", c: P.g, act: "Hold = LONG tgt $" + n2(vwap) });
    if (sups[1]) ndL.push({ price: sups[1].price, lb: "S2", c: P.g, act: "Break = capitulation" });
    ndL.sort((a, b) => b.price - a.price);

    const dayType = hFH && lSH ? "DISTRIBUTION" : !hFH && !lSH ? "ACCUMULATION" : "RANGE";
    const headline = `${ticker} O$${n2(O)} H$${n2(H)} L$${n2(L)} C$${n2(Cl)} (${n2(dChg, 1)}%) V${n2(TV / 1e6, 1)}M`;
    const cdSamp = cumDs.filter((_, i) => i % Math.max(1, Math.floor(trades.length / 200)) === 0);

    return { ticker, date, O, H, L, Cl, vwap, poc, TV, R, cL, gap, dChg, prevClose: prevClose || null, phases, vwPct, topN, bT: bT.length, bV, lT: lTr.length, lV, bNH, bNL, bZones, adR, dpCross, dpVol, smShift, f30i: f30i.length, l30i: l30i.length, f30a, l30a, clusters: clusters.slice(0, 8), instPart, bars, dipBuys, rallySells, hTs: hT.ts, lTs: lT2.ts, hFH, lSH, distBars, lhSell, top10, tradeCount: trades.length, ut, dt, zt, uV, dV, zV, tR, vTR, pkV, avgVel, mxA, mxD, acT, deT, medITT, sameMs, sameMsPct, aUR, aDR, mUR, mDR, cumD, maxCD, minCD, dRange, dRecov, dRecovPct, dPh, cumDs: cdSamp, sweeps: sweeps.length, tSV, sNH, sNL, topSw, vpin, topVA: topVA5, iceCount, topIce: topIce.slice(0, 5), sBk, rndL, oddPct, algoS, avgImp, rv1m, rvAnn, rv5m, hurst, voV, gkV, sups, ress, scenarios, ndL, score, sigs, bias, biasC, dayType, headline };
  } catch (err) { console.error("Engine error:", err); return null; }
}

async function ldIdx() { try { const r = await window.storage.get("stae7:idx"); return r ? JSON.parse(r.value) : []; } catch (e) { return []; } }
async function svIdx(t) { try { await window.storage.set("stae7:idx", JSON.stringify(t)); } catch (e) { } }
async function ldTk(t) { try { const r = await window.storage.get("stae7:" + t); return r ? JSON.parse(r.value) : []; } catch (e) { return []; } }
async function svTk(t, r) { try { await window.storage.set("stae7:" + t, JSON.stringify(r)); } catch (e) { } }

const Tag = ({ children, c = P.cy }) => <span style={{ display: "inline-block", padding: "1px 5px", fontSize: 8, fontWeight: 700, fontFamily: FN, color: c, background: c + "18", border: "1px solid " + c + "33", whiteSpace: "nowrap" }}>{children}</span>;
const Rw = ({ l, v, c, b }) => <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, padding: "2px 0", borderBottom: "1px solid " + P.bd, fontFamily: FN }}><span style={{ color: P.t2 }}>{l}</span><div style={{ display: "flex", alignItems: "center", gap: 4 }}>{b !== undefined && <div style={{ width: 36, height: 2, background: P.bd, overflow: "hidden" }}><div style={{ width: b + "%", height: "100%", background: c || P.cy }} /></div>}<span style={{ color: c || P.t1, fontWeight: 600 }}>{v}</span></div></div>;
const Pnl = ({ title, color = P.am, children }) => <div style={{ background: P.pn, border: "1px solid " + P.bd, overflow: "hidden" }}><div style={{ padding: "5px 8px", background: P.cd, borderBottom: "1px solid " + P.bd, fontSize: 9, fontWeight: 700, letterSpacing: 1, color, fontFamily: FN }}>{"▸ " + title}</div><div style={{ padding: 8 }}>{children}</div></div>;
const Pill = ({ active, onClick, children }) => <button onClick={onClick} style={{ padding: "6px 10px", border: "none", cursor: "pointer", fontFamily: FN, fontSize: 7, fontWeight: 700, letterSpacing: .8, background: active ? P.am + "18" : "transparent", color: active ? P.am : P.t3, borderBottom: active ? "2px solid " + P.am : "2px solid transparent" }}>{children}</button>;

function Chrt({ bars, vwap, H, L, cumDs }) {
  if (!bars || !bars.length) return null;
  const W = 680, Ht = 120, pd = { t: 6, b: 16, l: 42, r: 8 }, cW = W - pd.l - pd.r, cH = Ht - pd.t - pd.b;
  const minS = bars[0].sec, maxS = bars[bars.length - 1].sec, sR = maxS - minS || 1;
  const x = s => pd.l + ((s - minS) / sR) * cW; const y = p => pd.t + (1 - (p - L) / ((H - L) || 1)) * cH;
  const line = bars.map((b, i) => (i === 0 ? "M" : "L") + x(b.sec).toFixed(1) + "," + y(b.c).toFixed(1)).join(" ");
  const maxV = safeMax(bars.map(b => b.v)) || 1;
  let dL = ""; if (cumDs && cumDs.length > 1) { const mD = safeMax(cumDs.map(Math.abs)) || 1; dL = cumDs.map((d, i) => (i === 0 ? "M" : "L") + (pd.l + (i / (cumDs.length - 1)) * cW).toFixed(1) + "," + (pd.t + cH / 2 - (d / mD) * (cH / 2) * 0.7).toFixed(1)).join(" "); }
  const bw = Math.max(1, cW / bars.length * 0.7);
  return <svg viewBox={"0 0 " + W + " " + Ht} style={{ width: "100%", height: "auto", display: "block" }}>
    {[.25, .5, .75].map(p => { const py = pd.t + p * cH; return <g key={p}><line x1={pd.l} y1={py} x2={W - pd.r} y2={py} stroke={P.bd} strokeWidth={.5} /><text x={pd.l - 4} y={py + 3} fill={P.t3} fontSize={7} fontFamily={FN} textAnchor="end">{n2(H - p * (H - L))}</text></g>; })}
    <line x1={pd.l} y1={y(vwap)} x2={W - pd.r} y2={y(vwap)} stroke={P.am} strokeWidth={.5} strokeDasharray="4,3" opacity={.4} />
    {bars.map((b, i) => <rect key={i} x={x(b.sec) - bw / 2} y={Ht - pd.b - (b.v / maxV) * 14} width={bw} height={(b.v / maxV) * 14} fill={b.c >= b.o ? P.g : P.r} opacity={.15} />)}
    {dL && <path d={dL} fill="none" stroke={P.mg} strokeWidth={.8} opacity={.5} />}
    <path d={line} fill="none" stroke={bars[bars.length - 1].c >= bars[0].o ? P.g : P.r} strokeWidth={1.5} />
    {[9.5, 10, 11, 12, 13, 14, 15, 16].map(h => { const s = h * 3600; if (s < minS || s > maxS) return null; return <text key={h} x={x(s)} y={Ht - 4} fill={P.t3} fontSize={7} fontFamily={FN} textAnchor="middle">{h === 9.5 ? "9:30" : Math.floor(h) + ":00"}</text>; })}
  </svg>;
}

function PBar({ sc }) { if (!sc || !sc.length) return null; return <div style={{ display: "flex", height: 16, overflow: "hidden", gap: 1, marginBottom: 4 }}>{sc.map((s, i) => <div key={i} style={{ width: s.p + "%", background: s.c, display: "flex", alignItems: "center", justifyContent: "center", opacity: .85 }}>{s.p >= 14 && <span style={{ fontSize: 7, fontWeight: 700, color: P.bg, fontFamily: FN }}>{s.p}%</span>}</div>)}</div>; }

export default function App() {
  const [tab, setTab] = useState("upload");
  const [tickers, setTickers] = useState([]);
  const [aTk, setATk] = useState(null);
  const [recs, setRecs] = useState([]);
  const [selD, setSelD] = useState(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState(null);
  const [pcI, setPcI] = useState("");
  const fRef = useRef();

  useEffect(() => { (async () => { try { const idx = await ldIdx(); setTickers(idx); if (idx.length) { setATk(idx[0]); setRecs(await ldTk(idx[0])); } } catch (e) { } setLoading(false); })(); }, []);
  const swTk = useCallback(async t => { setATk(t); setSelD(null); const r = await ldTk(t); setRecs(r); setTab("dash"); if (r.length) setSelD(r[0].date); }, []);

  const handleFile = useCallback(async e => {
    const file = e.target.files?.[0]; if (!file) return; setMsg(null);
    const reader = new FileReader();
    reader.onload = async ev => {
      try {
        const parsed = parseTapeCSV(ev.target.result); if (!parsed?.trades?.length) { setMsg({ e: 1, m: "Cannot parse." }); return; }
        const tk = parsed.ticker; if (!tk) { setMsg({ e: 1, m: "No ticker." }); return; }
        let exR = await ldTk(tk); let pc = parseFloat(pcI) || null;
        if (!pc && exR.length) { const prev = [...exR].sort((a, b) => b.date.localeCompare(a.date)).find(r => r.date < parsed.date); if (prev) pc = prev.Cl; }
        const a = engine(parsed, pc); if (!a) { setMsg({ e: 1, m: "Analysis failed." }); return; }
        const idx = exR.findIndex(r => r.date === a.date); if (idx >= 0) exR[idx] = a; else exR.push(a);
        exR.sort((x, y) => y.date.localeCompare(x.date));
        const chrono = [...exR].reverse(); for (let i = 0; i < chrono.length - 1; i++) { const c2 = chrono[i], nx = chrono[i + 1]; const chg = c2.Cl ? ((nx.Cl - c2.Cl) / c2.Cl) * 100 : 0; c2.actChg = chg; c2.actDir = chg > 0.3 ? "BULL" : chg < -0.3 ? "BEAR" : "FLAT"; c2.hit = (c2.score >= 1 ? "BULL" : c2.score <= -1 ? "BEAR" : "FLAT") === c2.actDir; }
        exR = [...chrono].reverse(); await svTk(tk, exR);
        let idx2 = [...tickers]; if (!idx2.includes(tk)) { idx2.push(tk); idx2.sort(); setTickers(idx2); await svIdx(idx2); }
        setATk(tk); setRecs(exR); setSelD(a.date); setMsg({ m: tk + " " + a.date + " | " + a.tradeCount + " trades | Score " + (a.score >= 0 ? "+" : "") + a.score + " " + a.bias }); setTab("dash");
      } catch (err) { setMsg({ e: 1, m: "Error: " + err.message }); }
    }; reader.readAsText(file); if (e.target) e.target.value = "";
  }, [tickers, pcI]);

  const S = useMemo(() => recs.find(r => r.date === selD) || null, [recs, selD]);

  if (loading) return <div style={{ fontFamily: FN, background: P.bg, color: P.t3, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10 }}>LOADING...</div>;

  const tabs = [["upload", "UPLOAD"], ["dash", "DASHBOARD"], ["price", "PRICE"], ["flow", "FLOW"], ["inst", "INST"], ["micro", "MICRO"], ["vol", "VOL"], ["levels", "LEVELS"], ["outlook", "OUTLOOK"], ["hist", "HISTORY"]];
  const zoneVol = (arr) => arr.reduce((a, t) => a + t.sz, 0);

  return (
    <div style={{ fontFamily: FN, background: P.bg, color: P.t1, minHeight: "100vh", fontSize: 9 }}>
      <div style={{ background: "linear-gradient(180deg,#14171f,#0f1119)", borderBottom: "1px solid " + P.bd, padding: "0 12px", display: "flex", alignItems: "center", height: 32, gap: 10 }}>
        <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#00e676", boxShadow: "0 0 6px #00e676" }} /><span style={{ color: P.am, fontSize: 11, fontWeight: 700, letterSpacing: 1.5 }}>STAE</span><span style={{ color: P.t3, fontSize: 8 }}>v6</span>
        <div style={{ flex: 1 }} />
        {aTk && <span style={{ color: "#fff", fontSize: 11, fontWeight: 700 }}>{aTk}</span>}
        {S && <Tag c={S.biasC}>{S.bias}</Tag>}
        {S && <span style={{ color: S.score >= 0 ? P.g : P.r, fontSize: 11, fontWeight: 700 }}>{S.score >= 0 ? "+" : ""}{S.score}</span>}
      </div>

      {tickers.length > 0 && <div style={{ display: "flex", background: P.cd, borderBottom: "1px solid " + P.bd, padding: "0 12px", overflowX: "auto", height: 24, alignItems: "center" }}>
        {tickers.map(tk => <button key={tk} onClick={() => swTk(tk)} style={{ padding: "0 12px", height: 24, border: "none", borderBottom: aTk === tk ? "2px solid " + P.am : "2px solid transparent", cursor: "pointer", fontFamily: FN, fontSize: 8, fontWeight: 700, background: aTk === tk ? P.am + "10" : "transparent", color: aTk === tk ? P.am : P.t3 }}>{tk}</button>)}
      </div>}

      <div style={{ display: "flex", background: P.pn, borderBottom: "1px solid " + P.bd, overflowX: "auto" }}>
        {tabs.map(([k, l]) => <Pill key={k} active={tab === k} onClick={() => setTab(k)}>{l}</Pill>)}
      </div>

      {S && tab !== "upload" && tab !== "hist" && <div style={{ display: "flex", gap: 1, padding: "4px 12px", background: P.bg, borderBottom: "1px solid " + P.bd, flexWrap: "wrap" }}>
        {recs.map((r, i) => <button key={i} onClick={() => setSelD(r.date)} style={{ padding: "2px 8px", border: "1px solid " + (selD === r.date ? P.am : P.bd), background: selD === r.date ? P.am + "15" : "transparent", color: selD === r.date ? P.am : P.t3, fontFamily: FN, fontSize: 7, cursor: "pointer" }}>{r.date}</button>)}
      </div>}

      <div style={{ padding: 8, maxWidth: 1440, margin: "0 auto", display: "flex", flexDirection: "column", gap: 8 }}>

        {tab === "upload" && <div style={{ maxWidth: 520, margin: "0 auto", width: "100%" }}>
          <Pnl title="DATA IMPORT"><div style={{ marginBottom: 6 }}><div style={{ fontSize: 7, color: P.t3, letterSpacing: 1.5, marginBottom: 2 }}>PREVIOUS CLOSE</div><input value={pcI} onChange={e => setPcI(e.target.value)} placeholder="0.00" style={{ background: P.bg, border: "1px solid " + P.bd, padding: "5px 8px", color: P.am, fontFamily: FN, fontSize: 11, fontWeight: 700, width: 120, outline: "none" }} /></div>
            <div style={{ textAlign: "center", padding: "24px 12px", border: "1px solid " + P.bd, background: P.bg, cursor: "pointer" }} onClick={() => fRef.current?.click()} onDragOver={e => { e.preventDefault(); }} onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) { const dt = new DataTransfer(); dt.items.add(f); fRef.current.files = dt.files; handleFile({ target: fRef.current }); } }}><input ref={fRef} type="file" accept=".csv" onChange={handleFile} style={{ display: "none" }} /><div style={{ color: P.am, fontSize: 13, fontWeight: 700 }}>DROP T&S CSV</div><div style={{ color: P.t3, fontSize: 8 }}>Auto-routed to ticker folder</div></div>
            {msg && <div style={{ marginTop: 6, padding: "4px 8px", fontSize: 8, background: msg.e ? P.r + "15" : P.g + "15", color: msg.e ? P.r : P.g }}>{msg.m}</div>}
          </Pnl>
          {tickers.length > 0 && <Pnl title="FOLDERS"><div style={{ marginTop: 0 }}>{tickers.map(tk => <div key={tk} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", borderBottom: "1px solid " + P.bd }}><span onClick={() => swTk(tk)} style={{ cursor: "pointer", color: P.am, fontWeight: 700 }}>{tk}</span><button onClick={async () => { if (!confirm("Delete " + tk + "?")) return; try { await window.storage.delete("stae7:" + tk); } catch (e) { } const idx = tickers.filter(t => t !== tk); setTickers(idx); await svIdx(idx); if (aTk === tk) { if (idx.length) swTk(idx[0]); else { setATk(null); setRecs([]); setSelD(null); } } }} style={{ padding: "1px 6px", border: "1px solid " + P.r + "50", background: "transparent", color: P.r, fontFamily: FN, fontSize: 7, cursor: "pointer" }}>DEL</button></div>)}</div></Pnl>}
        </div>}

        {tab === "dash" && S && <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ background: "linear-gradient(135deg," + P.pn + "," + P.cd + ")", border: "1px solid " + P.bd, padding: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", flexWrap: "wrap", gap: 8 }}>
              <div><div style={{ fontSize: 7, color: P.t3, letterSpacing: 2 }}>COMPOSITE SCORE</div><div style={{ fontSize: 36, fontWeight: 700, color: S.biasC, lineHeight: 1 }}>{S.score >= 0 ? "+" : ""}{S.score}</div><div style={{ display: "flex", gap: 4, marginTop: 4 }}><Tag c={S.biasC}>{S.bias}</Tag><Tag c={P.t3}>{S.dayType}</Tag></div></div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>{[{ l: "CUM D", v: n2(S.cumD / 1e6) + "M", c: S.cumD >= 0 ? P.g : P.r }, { l: "TICK VR", v: n2(S.vTR, 3), c: S.vTR > 1 ? P.g : P.r }, { l: "VPIN", v: n2(S.vpin * 100, 1) + "%", c: S.vpin > 0.3 ? P.r : P.t2 }, { l: "HURST", v: n2(S.hurst, 3) }, { l: "A/D", v: n2(S.adR) + "x", c: S.adR > 1.3 ? P.r : P.g }, { l: "SM SHIFT", v: "$" + n2(S.smShift), c: S.smShift < 0 ? P.r : P.g }, { l: "RV ANN", v: n2(S.rvAnn * 100, 0) + "%" }, { l: "VOL/VOL", v: S.voV > 0.015 ? "UNSTBL" : "STABLE", c: S.voV > 0.015 ? P.r : P.g }].map((m, i) => <div key={i} style={{ textAlign: "center", minWidth: 50 }}><div style={{ fontSize: 6, color: P.t3, letterSpacing: 1.5 }}>{m.l}</div><div style={{ fontSize: 12, fontWeight: 700, color: m.c || P.t1 }}>{m.v}</div></div>)}</div>
              {S.actDir && <div style={{ padding: "4px 8px", background: S.hit ? P.g + "15" : P.r + "15" }}><div style={{ fontSize: 6, color: P.t3 }}>ACTUAL</div><div style={{ fontSize: 10, fontWeight: 700, color: S.actDir === "BULL" ? P.g : S.actDir === "BEAR" ? P.r : P.y }}>{S.actDir} {S.actChg >= 0 ? "+" : ""}{n2(S.actChg)}% {S.hit ? "\u2713" : "\u2717"}</div></div>}
            </div>
            <div style={{ marginTop: 6, fontSize: 8, color: P.t2 }}>{S.headline}</div>
          </div>
          <Pnl title={"SCENARIOS: #1 " + S.scenarios[0].l + " " + S.scenarios[0].p + "%"} color={S.scenarios[0].c}><PBar sc={S.scenarios} /><div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 4 }}>{S.scenarios.map((s, i) => <div key={i} style={{ background: s.c + "0a", border: "1px solid " + s.c + "22", padding: 5, textAlign: "center" }}><div style={{ fontSize: 7, color: s.c, fontWeight: 700 }}>#{i + 1} {s.l}</div><div style={{ fontSize: 20, fontWeight: 700, color: s.c }}>{s.p}%</div></div>)}</div></Pnl>
          <div style={{ display: "grid", gridTemplateColumns: "3fr 2fr", gap: 8 }}>
            <Pnl title="INTRADAY + CUM DELTA" color={P.cy}><Chrt bars={S.bars} vwap={S.vwap} H={S.H} L={S.L} cumDs={S.cumDs} /><div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2, marginTop: 4 }}>{[{ l: "O", v: n2(S.O) }, { l: "H", v: n2(S.H), c: P.g }, { l: "L", v: n2(S.L), c: P.r }, { l: "C", v: n2(S.Cl), c: S.Cl >= S.O ? P.g : P.r }, { l: "VWAP", v: n2(S.vwap), c: P.am }, { l: "POC", v: n2(S.poc), c: P.y }, { l: "VOL", v: n2(S.TV / 1e6, 1) + "M" }].map((s, i) => <div key={i} style={{ textAlign: "center" }}><div style={{ fontSize: 6, color: P.t3 }}>{s.l}</div><div style={{ fontSize: 10, fontWeight: 700, color: s.c || P.t1 }}>{s.v}</div></div>)}</div></Pnl>
            <Pnl title="SMART MONEY" color={P.am}><Rw l="OPEN 30M" v={S.f30i + " @ $" + n2(S.f30a)} c={S.f30a > S.vwap ? P.r : P.g} /><Rw l="CLOSE 30M" v={S.l30i + " @ $" + n2(S.l30a)} c={S.l30a > S.vwap ? P.r : P.g} /><Rw l="SHIFT" v={"$" + n2(S.smShift)} c={S.smShift < 0 ? P.r : P.g} /><Rw l="A/D" v={n2(S.adR) + "x"} c={S.adR > 1.3 ? P.r : P.g} /><Rw l="BLOCKS HI/LO" v={S.bNH + "/" + S.bNL} c={S.bNH > S.bNL ? P.r : P.g} /><Rw l="DARK POOL" v={n2(S.dpVol / 1e3, 0) + "K"} /></Pnl>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            {[{ t: "BULL", c: P.g, items: S.sigs.filter(s => s.v > 0) }, { t: "BEAR", c: P.r, items: S.sigs.filter(s => s.v < 0) }, { t: "NEUT", c: P.y, items: S.sigs.filter(s => s.v === 0) }].map((col, ci) => <Pnl key={ci} title={col.t + " (" + col.items.length + ")"} color={col.c}>{col.items.length === 0 ? <div style={{ color: P.t4 }}>None</div> : col.items.sort((a, b) => Math.abs(b.v) - Math.abs(a.v)).map((s, i) => <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "1px 0", borderBottom: "1px solid " + P.bd, fontSize: 8 }}><span style={{ color: P.t2 }}>{s.t}</span><Tag c={col.c}>{s.v > 0 ? "+" : ""}{s.v}</Tag></div>)}</Pnl>)}
          </div>
        </div>}

        {tab === "price" && S && <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <Pnl title="PRICE STRUCTURE" color={P.cy}><Chrt bars={S.bars} vwap={S.vwap} H={S.H} L={S.L} cumDs={S.cumDs} /><div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 6, marginTop: 6 }}>{[{ l: "PREV", v: S.prevClose ? "$" + n2(S.prevClose) : "--" }, { l: "OPEN", v: "$" + n2(S.O), s: "Gap " + n2(S.gap, 1) + "%" }, { l: "HIGH", v: "$" + n2(S.H), c: P.g, s: S.hTs.substring(0, 8) }, { l: "LOW", v: "$" + n2(S.L), c: P.r, s: S.lTs.substring(0, 8) }, { l: "CLOSE", v: "$" + n2(S.Cl), c: S.Cl >= S.O ? P.g : P.r, s: n2(S.dChg, 1) + "%" }, { l: "VWAP", v: "$" + n2(S.vwap, 4), c: P.am }, { l: "POC", v: "$" + n2(S.poc), c: P.y }, { l: "CL LOC", v: n2(S.cL * 100, 1) + "%" }].map((s, i) => <div key={i}><div style={{ fontSize: 6, color: P.t3, letterSpacing: 1.5 }}>{s.l}</div><div style={{ fontSize: 12, fontWeight: 700, color: s.c || P.t1 }}>{s.v}</div>{s.s && <div style={{ fontSize: 7, color: P.t3 }}>{s.s}</div>}</div>)}</div></Pnl>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <Pnl title="VOLUME PROFILE (12)" color={P.y}>{S.topN.map((nd, i) => { const pctW = S.topN[0] ? nd.vol / S.topN[0].vol * 100 : 0; return <div key={i} style={{ display: "grid", gridTemplateColumns: "48px 1fr 55px", gap: 4, alignItems: "center", padding: "2px 0", borderBottom: "1px solid " + P.bd }}><span style={{ fontSize: 9, fontWeight: nd.price === S.poc ? 700 : 400, color: nd.price === S.poc ? P.am : P.t1 }}>{n2(nd.price)}</span><div style={{ height: 3, background: P.bd }}><div style={{ width: pctW + "%", height: "100%", background: nd.price >= S.Cl ? P.g : P.r }} /></div><span style={{ fontSize: 7, color: P.t3, textAlign: "right" }}>{n2(nd.vol / 1e6)}M{nd.price === S.poc ? " \u25C6" : ""}</span></div>; })}</Pnl>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <Pnl title="RESISTANCE" color={P.r}>{S.ress.map((r, i) => <div key={i} style={{ padding: "3px 0", borderBottom: "1px solid " + P.bd }}><div style={{ display: "flex", gap: 4, alignItems: "center" }}><span style={{ fontSize: 11, fontWeight: 700, color: P.r }}>{n2(r.price)}</span><Tag c={P.r}>{r.src}</Tag></div><div style={{ fontSize: 7, color: P.t3 }}>{r.ev}</div></div>)}</Pnl>
              <Pnl title="SUPPORT" color={P.g}>{S.sups.map((s, i) => <div key={i} style={{ padding: "3px 0", borderBottom: "1px solid " + P.bd }}><div style={{ display: "flex", gap: 4, alignItems: "center" }}><span style={{ fontSize: 11, fontWeight: 700, color: P.g }}>{n2(s.price)}</span><Tag c={P.g}>{s.src}</Tag></div><div style={{ fontSize: 7, color: P.t3 }}>{s.ev}</div></div>)}</Pnl>
            </div>
          </div>
        </div>}

        {tab === "flow" && S && <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <Pnl title="CUMULATIVE DELTA" color={S.cumD >= 0 ? P.g : P.r}><Rw l="FINAL" v={n2(S.cumD / 1e6) + "M"} c={S.cumD >= 0 ? P.g : P.r} /><Rw l="PEAK +" v={"+" + n2(S.maxCD / 1e6) + "M"} c={P.g} /><Rw l="PEAK -" v={n2(S.minCD / 1e6) + "M"} c={P.r} /><Rw l="RANGE" v={n2(S.dRange / 1e6) + "M"} /><Rw l="RECOVERY" v={n2(S.dRecovPct, 1) + "%"} c={S.dRecovPct > 60 ? P.g : P.r} b={S.dRecovPct} /><div style={{ fontSize: 7, color: P.t3, marginTop: 4 }}>BY PHASE</div>{S.dPh.map((d, i) => <Rw key={i} l={d.l} v={n2(d.v / 1e6) + "M"} c={d.v >= 0 ? P.g : P.r} />)}</Pnl>
            <Pnl title="TICK ANALYSIS" color={P.am}><Rw l="UP" v={S.ut.toLocaleString() + " | " + n2(S.uV / 1e6) + "M"} c={P.g} /><Rw l="DOWN" v={S.dt.toLocaleString() + " | " + n2(S.dV / 1e6) + "M"} c={P.r} /><Rw l="ZERO" v={S.zt.toLocaleString() + " | " + n2(S.zV / 1e6) + "M"} /><Rw l="TICK R" v={n2(S.tR, 3)} /><Rw l="VOL TICK R" v={n2(S.vTR, 3)} c={S.vTR > 1 ? P.g : P.r} /><Rw l="VPIN" v={n2(S.vpin * 100) + "%"} c={S.vpin > 0.3 ? P.r : P.t2} /><Rw l="VWAP SPLIT" v={n2(S.vwPct, 1) + "% / " + n2(100 - S.vwPct, 1) + "%"} /></Pnl>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <Pnl title="SWEEPS" color={P.mg}><Rw l="COUNT" v={S.sweeps} /><Rw l="VOLUME" v={n2(S.tSV / 1e3, 0) + "K"} /><Rw l="@ HIGHS" v={S.sNH} c={S.sNH > S.sNL ? P.r : P.t2} /><Rw l="@ LOWS" v={S.sNL} c={S.sNL > S.sNH ? P.g : P.t2} />{S.topSw.map((s, i) => <Rw key={i} l={s.t?.substring(0, 8) || ""} v={s.sz.toLocaleString() + " $" + n2(s.mn) + "-" + n2(s.mx)} />)}</Pnl>
            <Pnl title="PHASES" color={P.cy}>{[["OPEN 9:30-10", S.phases.od], ["MIDM 10-11:30", S.phases.mm], ["MIDD 11:30-14", S.phases.md], ["PWRH 14:30-16", S.phases.ph], ["LAST 15:30-16", S.phases.l30]].map(([n, p], i) => <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "2px 0", borderBottom: "1px solid " + P.bd }}><span style={{ color: P.t2, fontSize: 8 }}>{n}</span><div style={{ display: "flex", gap: 6 }}><span style={{ color: P.t3, fontSize: 7 }}>{n2(p.v / 1e6, 1)}M</span><Tag c={p.chg > 0.5 ? P.g : p.chg < -0.5 ? P.r : P.y}>{p.chg >= 0 ? "+" : ""}{n2(p.chg, 1)}%</Tag></div></div>)}</Pnl>
          </div>
          {S.topVA.length > 0 && <Pnl title="VOLUME ACCELERATION" color={P.cy}><div style={{ display: "grid", gridTemplateColumns: "repeat(" + Math.min(5, S.topVA.length) + ",1fr)", gap: 4 }}>{S.topVA.map((a, i) => <div key={i} style={{ background: P.cd, padding: 4, textAlign: "center" }}><div style={{ fontSize: 7, color: P.t3 }}>{a.time}</div><div style={{ fontSize: 10, fontWeight: 700, color: P.g }}>+{n2(a.pct, 0)}%</div><div style={{ fontSize: 7, color: P.t3 }}>{n2(a.vol / 1e3, 0)}K</div></div>)}</div></Pnl>}
        </div>}

        {tab === "inst" && S && <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <Pnl title="TOP 10 PRINTS" color={P.mg}>{S.top10.map((t, i) => <div key={i} style={{ display: "grid", gridTemplateColumns: "18px 75px 58px 55px 40px 45px", gap: 4, padding: "3px 0", borderBottom: "1px solid " + P.bd, alignItems: "center" }}><span style={{ color: P.t3 }}>{i + 1}</span><span style={{ fontWeight: 700 }}>{t.sz.toLocaleString()}</span><span style={{ color: t.p >= S.vwap ? P.g : P.r, fontWeight: 700 }}>${n2(t.p)}</span><span style={{ color: P.t3, fontSize: 8 }}>{t.ts.substring(0, 8)}</span><Tag c={P.t3}>{t.ph}</Tag><Tag c={t.it === "DIST" ? P.r : t.it === "ACCUM" ? P.g : P.cy}>{t.it}</Tag></div>)}</Pnl>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            <Pnl title="BLOCK ZONES" color={P.cy}>{[["NEAR HI", S.bZones.hi, P.r], ["ABV VWAP", S.bZones.abv, P.r], ["AT VWAP", S.bZones.at, P.cy], ["BLW VWAP", S.bZones.blw, P.cy], ["NEAR LO", S.bZones.lo, P.g]].map(([n2l, arr, c], i) => <Rw key={i} l={n2l} v={arr.length + " | " + n2(zoneVol(arr) / 1e3, 0) + "K"} c={c} />)}</Pnl>
            <Pnl title="A/D SCORECARD" color={S.adR > 1.3 ? P.r : P.g}><Rw l="DIST" v={n2(zoneVol([...S.bZones.hi, ...S.bZones.abv]) / 1e3, 0) + "K"} c={P.r} /><Rw l="ACCUM" v={n2(zoneVol([...S.bZones.at, ...S.bZones.blw, ...S.bZones.lo]) / 1e3, 0) + "K"} c={P.g} /><Rw l="A/D RATIO" v={n2(S.adR) + "x"} c={S.adR > 1.3 ? P.r : P.g} /></Pnl>
            <Pnl title="DARK POOL" color={P.am}><Rw l="CROSSES" v={S.dpCross.length} /><Rw l="VOLUME" v={n2(S.dpVol / 1e3, 0) + "K"} />{S.dpCross.slice(0, 3).map((t, i) => <Rw key={i} l={t.ts.substring(0, 8)} v={n2(t.sz / 1e3, 0) + "K@" + n2(t.p)} />)}</Pnl>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <Pnl title="CLUSTERING" color={P.mg}>{S.clusters.slice(0, 6).map((c2, i) => <Rw key={i} l={c2.time + " (" + c2.cnt + ")"} v={n2(c2.vol / 1e3, 0) + "K $" + n2(c2.avgP)} c={c2.it === "DIST" ? P.r : P.g} />)}</Pnl>
            <Pnl title="INST PARTICIPATION" color={P.cy}>{S.instPart.map((p, i) => <Rw key={i} l={p.n} v={n2(p.ip, 1) + "% | " + n2(p.bp, 1) + "% blk"} b={p.ip} />)}</Pnl>
          </div>
        </div>}

        {tab === "micro" && S && <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <Pnl title="TICK DIRECTION" color={P.am}><Rw l="UP" v={S.ut.toLocaleString() + " (" + n2(S.uV / 1e6) + "M)"} c={P.g} /><Rw l="DOWN" v={S.dt.toLocaleString() + " (" + n2(S.dV / 1e6) + "M)"} c={P.r} /><Rw l="ZERO" v={S.zt.toLocaleString()} /><Rw l="VOL TICK R" v={n2(S.vTR, 3)} c={S.vTR > 1 ? P.g : P.r} /></Pnl>
          <Pnl title="VELOCITY" color={P.cy}><Rw l="PEAK" v={S.pkV + "/min"} /><Rw l="AVG" v={n2(S.avgVel, 1) + "/min"} /><Rw l="ACCEL" v={"+" + S.mxA + " @ " + S.acT} c={P.g} /><Rw l="DECEL" v={S.mxD + " @ " + S.deT} c={P.r} /></Pnl>
          <Pnl title="INTER-TRADE TIME" color={P.mg}><Rw l="MEDIAN" v={n2(S.medITT, 0) + "ms"} /><Rw l="SAME-MS" v={S.sameMs.toLocaleString() + " (" + n2(S.sameMsPct, 1) + "%)"} /></Pnl>
          <Pnl title="PRICE RUNS" color={P.y}><Rw l="AVG UP" v={n2(S.aUR, 1)} c={P.g} /><Rw l="AVG DN" v={n2(S.aDR, 1)} c={P.r} /><Rw l="MAX UP" v={S.mUR} c={P.g} /><Rw l="MAX DN" v={S.mDR} c={P.r} /></Pnl>
          <Pnl title="SIZE DISTRIBUTION" color={P.cy}>{[["<100", S.sBk.ol], ["100", S.sBk.r1], ["100-499", S.sBk.s15], ["500-999", S.sBk.s59], ["1K-5K", S.sBk.s1k], ["5K-10K", S.sBk.s5k], ["10K-50K", S.sBk.s10k], ["50K+", S.sBk.s50k]].map(([l, d], i) => <div key={i} style={{ display: "grid", gridTemplateColumns: "50px 1fr 30px", gap: 3, padding: "1px 0", borderBottom: "1px solid " + P.bd, alignItems: "center", fontSize: 8 }}><span style={{ color: P.t3 }}>{l}</span><div style={{ height: 2, background: P.bd }}><div style={{ width: (S.TV > 0 ? d.v / S.TV * 100 : 0) + "%", height: "100%", background: P.cy }} /></div><span style={{ color: P.t3, textAlign: "right", fontSize: 7 }}>{S.TV > 0 ? n2(d.v / S.TV * 100, 1) : 0}%</span></div>)}<Rw l="ODD LOTS" v={n2(S.oddPct, 1) + "%"} /></Pnl>
          <Pnl title="ICEBERGS | ALGOS | IMPACT" color={P.mg}><Rw l="ICEBERGS" v={S.iceCount} />{S.topIce.slice(0, 3).map((ic, i) => <Rw key={i} l={"5x" + ic.sz.toLocaleString() + " @" + n2(ic.p)} v={n2(ic.sp, 1) + "s"} />)}<div style={{ fontSize: 7, color: P.t3, marginTop: 4 }}>ALGO SIGNATURES</div>{Object.entries(S.algoS).map(([sz, d], i) => <Rw key={i} l={sz + "-SHR"} v={d.c.toLocaleString() + " (" + n2(d.p, 1) + "%)"} />)}<Rw l="IMPACT" v={"$" + n2(S.avgImp, 4) + "/M"} /><Rw l="VPIN" v={n2(S.vpin * 100) + "%"} c={S.vpin > 0.3 ? P.r : P.t2} /></Pnl>
        </div>}

        {tab === "vol" && S && <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
          <Pnl title="REALIZED VOL" color={P.mg}><Rw l="1M RV" v={n2(S.rv1m * 100) + "%"} /><Rw l="5M RV" v={n2(S.rv5m * 100) + "%"} /><Rw l="ANN" v={n2(S.rvAnn * 100, 1) + "%"} /><Rw l="GK" v={n2(S.gkV, 1) + "%"} /></Pnl>
          <Pnl title="HURST" color={P.y}><Rw l="H" v={n2(S.hurst, 3)} c={S.hurst > 0.55 ? P.g : S.hurst < 0.45 ? P.y : P.t2} /><Rw l="REGIME" v={S.hurst > 0.55 ? "TREND" : S.hurst < 0.45 ? "REVERT" : "RANDOM"} /></Pnl>
          <Pnl title="VOL-OF-VOL" color={P.cy}><Rw l="VOV" v={n2(S.voV * 100, 4) + "%"} /><Rw l="STATUS" v={S.voV > 0.015 ? "UNSTABLE" : "STABLE"} c={S.voV > 0.015 ? P.r : P.g} /></Pnl>
        </div>}

        {tab === "levels" && S && <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <Pnl title="NEXT-DAY ACTION LEVELS" color={P.am}>{S.ndL.map((l2, i) => <div key={i} style={{ display: "grid", gridTemplateColumns: "40px 55px 1fr", gap: 6, padding: "5px 0", borderBottom: "1px solid " + P.bd, alignItems: "start" }}><Tag c={l2.c}>{l2.lb}</Tag><span style={{ fontSize: 13, fontWeight: 700, color: l2.c }}>${n2(l2.price)}</span><span style={{ fontSize: 8, color: P.t2, borderLeft: "2px solid " + l2.c + "33", paddingLeft: 6 }}>{l2.act}</span></div>)}</Pnl>
          <Pnl title="GAME PLAN" color={P.cy}><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>{[{ t: "BULLISH", c: P.g, b: "Open > $" + n2(S.Cl) + "\nReclaim VWAP\nLong above R1\nStop $" + n2(S.Cl * 0.97) }, { t: "BEARISH", c: P.r, b: "Open < $" + n2(S.Cl) + "\nReject VWAP\nShort below S1\nStop $" + n2(S.Cl * 1.03) }, { t: "CHOP/REV", c: P.y, b: "S1-R1 range\n50% size\nFade extremes\nVol confirm" }].map((card, i) => <div key={i} style={{ background: card.c + "08", border: "1px solid " + card.c + "22", padding: 6 }}><div style={{ fontSize: 7, color: card.c, fontWeight: 700, marginBottom: 3 }}>IF {card.t}</div><div style={{ fontSize: 8, color: P.t2, lineHeight: 1.7, whiteSpace: "pre-line" }}>{card.b}</div></div>)}</div></Pnl>
        </div>}

        {tab === "outlook" && S && <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <Pnl title={aTk + " SCENARIOS"} color={P.mg}><PBar sc={S.scenarios} />{S.scenarios.map((s, i) => <div key={i} style={{ background: s.c + "08", border: "1px solid " + s.c + "18", padding: 8, marginBottom: 4 }}><div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ fontSize: 10, fontWeight: 700, color: s.c }}>#{i + 1} {s.l}</span><span style={{ fontSize: 18, fontWeight: 700, color: s.c }}>{s.p}%</span></div><div style={{ fontSize: 8, color: P.t2, lineHeight: 1.6, marginTop: 3 }}>{s.l === "BEAR" && <span><b style={{ color: P.t1 }}>Watch:</b> Open {"<"} ${n2(S.Cl)}, reject VWAP. <b style={{ color: P.t1 }}>Act:</b> Short failed VWAP.</span>}{s.l === "REVERSAL" && <span><b style={{ color: P.t1 }}>Watch:</b> Hold S1, delta turns +. <b style={{ color: P.t1 }}>Act:</b> Buy VWAP reclaim.</span>}{s.l === "BULL" && <span><b style={{ color: P.t1 }}>Watch:</b> Open {">"} ${n2(S.Cl)}, hold VWAP. <b style={{ color: P.t1 }}>Act:</b> Buy dips.</span>}{s.l === "CHOP" && <span><b style={{ color: P.t1 }}>Watch:</b> S1-R1 range. <b style={{ color: P.t1 }}>Act:</b> 50% size, fade.</span>}</div></div>)}</Pnl>
          {recs.length > 1 && <Pnl title={aTk + " CROSS-DAY"} color={P.cy}><div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", fontSize: 8, fontFamily: FN }}><thead><tr style={{ borderBottom: "1px solid " + P.bh }}>{["DATE", "O", "H", "L", "C", "D%", "VOL", "CL%", "SCR", "CUMD", "TVR", "VPIN", "H", "SCEN", "NEXT"].map(h => <th key={h} style={{ padding: "3px 2px", textAlign: "left", color: P.t3, fontSize: 7 }}>{h}</th>)}</tr></thead><tbody>{recs.map((a, i) => { const dc = a.prevClose ? ((a.Cl - a.prevClose) / a.prevClose * 100) : a.dChg; return <tr key={i} onClick={() => setSelD(a.date)} style={{ borderBottom: "1px solid " + P.bd, cursor: "pointer", background: selD === a.date ? P.hv : "transparent" }} onMouseEnter={e => { if (selD !== a.date) e.currentTarget.style.background = P.hv; }} onMouseLeave={e => { if (selD !== a.date) e.currentTarget.style.background = "transparent"; }}><td style={{ padding: "3px 2px", color: P.am }}>{a.date}</td><td style={{ padding: "3px 2px" }}>{n2(a.O)}</td><td style={{ padding: "3px 2px" }}>{n2(a.H)}</td><td style={{ padding: "3px 2px" }}>{n2(a.L)}</td><td style={{ padding: "3px 2px", fontWeight: 700 }}>{n2(a.Cl)}</td><td style={{ padding: "3px 2px", color: dc >= 0 ? P.g : P.r }}>{dc >= 0 ? "+" : ""}{n2(dc, 1)}%</td><td style={{ padding: "3px 2px" }}>{n2(a.TV / 1e6, 1)}M</td><td style={{ padding: "3px 2px" }}>{n2(a.cL * 100, 0)}%</td><td style={{ padding: "3px 2px", color: a.biasC, fontWeight: 700 }}>{a.score >= 0 ? "+" : ""}{a.score}</td><td style={{ padding: "3px 2px", color: a.cumD >= 0 ? P.g : P.r }}>{n2(a.cumD / 1e6, 1)}M</td><td style={{ padding: "3px 2px", color: a.vTR > 1 ? P.g : P.r }}>{n2(a.vTR)}</td><td style={{ padding: "3px 2px" }}>{n2(a.vpin * 100, 1)}%</td><td style={{ padding: "3px 2px" }}>{n2(a.hurst)}</td><td style={{ padding: "3px 2px" }}>{a.scenarios ? <Tag c={a.scenarios[0].c}>{a.scenarios[0].p}%</Tag> : ""}</td><td style={{ padding: "3px 2px" }}>{a.actDir ? <span>{a.hit ? "\u2713" : "\u2717"} {a.actDir}</span> : "--"}</td></tr>; })}</tbody></table></div></Pnl>}
        </div>}

        {tab === "hist" && (recs.length === 0 ? <div style={{ textAlign: "center", padding: 40, color: P.t3 }}>NO DATA</div> : <Pnl title={aTk + " | " + recs.length + " SESSIONS"} color={P.am}><div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", fontSize: 8, fontFamily: FN }}><thead><tr style={{ borderBottom: "1px solid " + P.bh }}>{["DATE", "O", "H", "L", "C", "D%", "VOL", "CL%", "SCR", "CUMD", "TVR", "VPIN", "H", "A/D", "#1 PRINT", "SCEN", "NEXT", "HIT"].map(h => <th key={h} style={{ padding: "3px 2px", textAlign: "left", color: P.t3, fontSize: 6, fontWeight: 700 }}>{h}</th>)}</tr></thead><tbody>{recs.map((a, i) => { const dc = a.prevClose ? ((a.Cl - a.prevClose) / a.prevClose * 100) : a.dChg; return <tr key={i} onClick={() => { setSelD(a.date); setTab("dash"); }} style={{ borderBottom: "1px solid " + P.bd, cursor: "pointer" }} onMouseEnter={e => e.currentTarget.style.background = P.hv} onMouseLeave={e => e.currentTarget.style.background = "transparent"}><td style={{ padding: "3px 2px", color: P.am }}>{a.date}</td><td style={{ padding: "3px 2px" }}>{n2(a.O)}</td><td style={{ padding: "3px 2px" }}>{n2(a.H)}</td><td style={{ padding: "3px 2px" }}>{n2(a.L)}</td><td style={{ padding: "3px 2px", fontWeight: 700 }}>{n2(a.Cl)}</td><td style={{ padding: "3px 2px", color: dc >= 0 ? P.g : P.r }}>{dc >= 0 ? "+" : ""}{n2(dc, 1)}%</td><td style={{ padding: "3px 2px" }}>{n2(a.TV / 1e6, 1)}M</td><td style={{ padding: "3px 2px" }}>{n2(a.cL * 100, 0)}%</td><td style={{ padding: "3px 2px", color: a.biasC, fontWeight: 700 }}>{a.score >= 0 ? "+" : ""}{a.score}</td><td style={{ padding: "3px 2px", color: a.cumD >= 0 ? P.g : P.r }}>{n2(a.cumD / 1e6, 1)}M</td><td style={{ padding: "3px 2px", color: a.vTR > 1 ? P.g : P.r }}>{n2(a.vTR)}</td><td style={{ padding: "3px 2px" }}>{n2(a.vpin * 100, 1)}%</td><td style={{ padding: "3px 2px" }}>{n2(a.hurst)}</td><td style={{ padding: "3px 2px", color: a.adR > 1.3 ? P.r : P.g }}>{n2(a.adR, 1)}x</td><td style={{ padding: "3px 2px", fontSize: 7 }}>{a.top10 && a.top10[0] ? Math.round(a.top10[0].sz / 1000) + "K@" + n2(a.top10[0].p) : ""}</td><td style={{ padding: "3px 2px" }}>{a.scenarios ? <Tag c={a.scenarios[0].c}>{a.scenarios[0].p}%</Tag> : ""}</td><td style={{ padding: "3px 2px" }}>{a.actDir ? <Tag c={a.actDir === "BULL" ? P.g : a.actDir === "BEAR" ? P.r : P.y}>{a.actDir}</Tag> : "--"}</td><td style={{ padding: "3px 2px" }}>{a.hit === undefined ? "--" : a.hit ? "\u2713" : "\u2717"}</td></tr>; })}</tbody></table></div></Pnl>)}

        {!S && tab !== "upload" && tab !== "hist" && <div style={{ textAlign: "center", padding: 50, color: P.t3, fontSize: 10, letterSpacing: 2 }}>UPLOAD T&S CSV TO BEGIN</div>}
      </div>

      <div style={{ borderTop: "1px solid " + P.bd, padding: "3px 12px", display: "flex", justifyContent: "space-between", fontSize: 7, color: P.t4, background: P.pn }}>
        <span>STAE v6 | 16-METRIC | PER-TICKER</span>
        <span>NOT FINANCIAL ADVICE</span>
      </div>
    </div>
  );
}
