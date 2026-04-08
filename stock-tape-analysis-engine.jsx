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