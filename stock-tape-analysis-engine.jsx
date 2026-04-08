import { useState, useEffect, useCallback, useMemo, useRef } from "react";

const FN = `'JetBrains Mono','Fira Code','Consolas',monospace`;
const P = { bg: "#0a0c14", pn: "#0f1119", cd: "#141822", hv: "#1a1f2e", bd: "#1c2236", bh: "#2a3350", t1: "#e8eaf0", t2: "#8892a8", t3: "#505a72", t4: "#2e3548", am: "#ff9800", g: "#26a69a", r: "#ef5350", cy: "#29b6f6", mg: "#ce93d8", y: "#ffd54f" };
const n2 = (v, d = 2) => { const x = Number(v); return isNaN(x) ? "—" : x.toFixed(d); };
const pct = (a, b) => b ? ((a / b) * 100) : 0;
const safeMax = (arr) => arr.length ? Math.max(...arr) : 0;
const safeMin = (arr) => arr.length ? Math.min(...arr) : 0;
