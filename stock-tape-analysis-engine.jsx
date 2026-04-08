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