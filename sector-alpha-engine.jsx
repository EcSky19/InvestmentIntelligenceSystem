import { useState, useEffect } from "react";

const AMBER = "#FF8C00";
const GREEN = "#00FF41";
const RED = "#FF3B3B";
const CYAN = "#00D4FF";
const YELLOW = "#FFD700";
const MAGENTA = "#FF44CC";
const MUTED = "#6B7B8D";
const BG = "#0A0E14";
const BG2 = "#0F1319";
const BG3 = "#141A22";
const BORDER = "#1C2530";
const WHITE = "#E8ECF0";

const SECTORS = [
  { label: "Technology", industries: ["Semiconductors", "Software (SaaS)", "Cloud Infrastructure", "Cybersecurity", "AI / Machine Learning", "Consumer Internet", "IT Services", "Hardware / Devices"] },
  { label: "Healthcare", industries: ["Pharmaceuticals", "Biotech", "Medical Devices", "Health Insurance", "Healthcare Services", "Diagnostics / Life Sciences Tools"] },
  { label: "Financials", industries: ["Banks", "Insurance", "Asset Management", "Fintech / Payments", "Capital Markets", "REITs"] },
  { label: "Consumer Discretionary", industries: ["E-commerce / Retail", "Luxury Goods", "Restaurants / QSR", "Homebuilders", "Autos / EVs", "Travel / Leisure"] },
  { label: "Consumer Staples", industries: ["Food & Beverage", "Household Products", "Personal Care", "Tobacco", "Grocery / Distribution"] },
  { label: "Industrials", industries: ["Aerospace & Defense", "Industrial Automation", "Freight & Logistics", "Construction / Engineering", "Electrical Equipment"] },
  { label: "Energy", industries: ["Oil & Gas (Integrated)", "Oil & Gas (E&P)", "Renewable Energy", "Energy Services", "Utilities"] },
  { label: "Materials", industries: ["Chemicals", "Mining / Metals", "Packaging", "Construction Materials"] },
  { label: "Communication Services", industries: ["Telecom", "Media & Entertainment", "Digital Advertising", "Gaming / Interactive"] },
  { label: "Real Estate", industries: ["Data Centers", "Industrial REITs", "Residential REITs", "Retail REITs", "Office REITs"] },
];

const GEOS = ["All", "United States", "Europe", "Asia-Pacific", "Emerging Markets", "Global"];
const MCAPS = ["All", "Mega Cap (>$200B)", "Large Cap ($10B–$200B)", "Mid Cap ($2B–$10B)", "Small Cap ($300M–$2B)", "Micro Cap (<$300M)"];
const STYLES = ["Growth", "GARP", "Quality", "Value", "Blend"];
const RISKS = ["Conservative", "Moderate", "Aggressive"];
const HORIZONS = ["12 months", "24 months", "3 years"];
const TRADE_HORIZONS = ["Swing", "1-3 months", "3-6 months", "6-12 months"];

function T({ children, c = WHITE, s = 12, w = 400, mono = true, style: st = {} }) {
  return <span style={{ color: c, fontSize: s, fontWeight: w, fontFamily: mono ? "'JetBrains Mono','Fira Code','SF Mono',monospace" : "'IBM Plex Sans',sans-serif", letterSpacing: mono ? "-0.02em" : "0.01em", lineHeight: 1.5, ...st }}>{children}</span>;
}

function Badge({ children, color = AMBER }) {
  return <span style={{ background: color + "18", color, border: `1px solid ${color}40`, padding: "2px 8px", fontSize: 10, fontFamily: "'JetBrains Mono',monospace", letterSpacing: "0.05em", textTransform: "uppercase", whiteSpace: "nowrap", display: "inline-block" }}>{children}</span>;
}

function Panel({ children, border, style: s = {} }) {
  return <div style={{ background: BG2, border: `1px solid ${border || BORDER}`, padding: 16, ...s }}>{children}</div>;
}

function ScoreBar({ value, max = 100, color = GREEN, width = 60 }) {
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <div style={{ width, height: 6, background: BORDER, borderRadius: 1 }}>
        <div style={{ height: "100%", width: `${(value / max) * 100}%`, background: color, borderRadius: 1 }} />
      </div>
      <T c={color} s={10} w={600}>{value}</T>
    </div>
  );
}

function SelectField({ label, value, onChange, options, disabled }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, opacity: disabled ? 0.35 : 1 }}>
      <T c={MUTED} s={9} style={{ textTransform: "uppercase", letterSpacing: "0.1em" }}>{label}</T>
      <select value={value} onChange={e => onChange(e.target.value)} disabled={disabled} style={{ background: BG, border: `1px solid ${BORDER}`, color: WHITE, fontFamily: "'JetBrains Mono',monospace", fontSize: 11, padding: "6px 8px", outline: "none", cursor: disabled ? "not-allowed" : "pointer" }}>
        <option value="">{disabled ? "Select Sector First..." : "Select..."}</option>
        {options.map(o => <option key={typeof o === "string" ? o : o.label} value={typeof o === "string" ? o : o.label}>{typeof o === "string" ? o : o.label}</option>)}
      </select>
    </div>
  );
}

function ScanLine() {
  return <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "100%", background: "repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(255,255,255,0.008) 2px,rgba(255,255,255,0.008) 4px)", pointerEvents: "none", zIndex: 1 }} />;
}

const sColor = s => s >= 75 ? GREEN : s >= 55 ? YELLOW : RED;
const tColor = t => t === "Gaining" ? GREEN : t === "Losing" ? RED : YELLOW;
const sigColor = s => s === "Positive" ? GREEN : s === "Negative" ? RED : YELLOW;
const stColor = st => ({ Triggered: GREEN, Ready: CYAN, Watch: YELLOW, Extended: AMBER, Broken: RED, Avoid: RED }[st] || MUTED);
const eColor = e => ({ Proper: GREEN, Early: CYAN, Extended: AMBER, Broken: RED }[e] || MUTED);

function MoatRadar({ scores, size = 170 }) {
  const keys = ["brand", "cost_advantage", "network_effects", "switching_costs", "regulatory", "distribution", "scale"];
  const labels = ["BRD", "CST", "NET", "SWT", "REG", "DST", "SCL"];
  const cx = size / 2, cy = size / 2, r = size / 2 - 20;
  const angles = keys.map((_, i) => (Math.PI * 2 * i) / keys.length - Math.PI / 2);
  const pts = keys.map((k, i) => { const v = (scores[k] || 0) / 5; return `${cx + r * v * Math.cos(angles[i])},${cy + r * v * Math.sin(angles[i])}`; }).join(" ");
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {[1, 2, 3, 4, 5].map(ring => <polygon key={ring} points={angles.map(a => `${cx + r * (ring / 5) * Math.cos(a)},${cy + r * (ring / 5) * Math.sin(a)}`).join(" ")} fill="none" stroke={BORDER} strokeWidth={0.5} />)}
      {angles.map((a, i) => <g key={i}><line x1={cx} y1={cy} x2={cx + r * Math.cos(a)} y2={cy + r * Math.sin(a)} stroke={BORDER} strokeWidth={0.5} /><text x={cx + (r + 14) * Math.cos(a)} y={cy + (r + 14) * Math.sin(a)} fill={MUTED} fontSize={7} textAnchor="middle" dominantBaseline="middle" fontFamily="'JetBrains Mono',monospace">{labels[i]}</text></g>)}
      <polygon points={pts} fill={CYAN + "20"} stroke={CYAN} strokeWidth={1.5} />
    </svg>
  );
}

function ActionGauge({ score, label, size = 90 }) {
  const r = 32, cx = size / 2, cy = size / 2 + 4;
  const circ = Math.PI * r;
  const off = circ - (Math.max(0, Math.min(score, 100)) / 100) * circ;
  const color = sColor(score);
  return (
    <div style={{ textAlign: "center" }}>
      <svg width={size} height={size / 2 + 20} viewBox={`0 0 ${size} ${size / 2 + 20}`}>
        <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`} fill="none" stroke={BORDER} strokeWidth={6} />
        <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`} fill="none" stroke={color} strokeWidth={6} strokeDasharray={circ} strokeDashoffset={off} strokeLinecap="round" />
        <text x={cx} y={cy - 8} fill={color} fontSize={16} fontWeight={700} textAnchor="middle" fontFamily="'JetBrains Mono',monospace">{score}</text>
      </svg>
      {label && <T c={MUTED} s={8} style={{ textTransform: "uppercase", letterSpacing: "0.1em" }}>{label}</T>}
    </div>
  );
}

function HeaderBar({ title, subtitle, rightContent }) {
  const [time, setTime] = useState(new Date());
  useEffect(() => { const i = setInterval(() => setTime(new Date()), 1000); return () => clearInterval(i); }, []);
  return (
    <div style={{ background: `linear-gradient(180deg,${BG3} 0%,${BG2} 100%)`, borderBottom: `1px solid ${BORDER}`, padding: "10px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ width: 8, height: 8, background: GREEN, borderRadius: "50%", boxShadow: `0 0 8px ${GREEN}60` }} />
        <T c={AMBER} s={15} w={700}>{title}</T>
        {subtitle && <T c={MUTED} s={11}>// {subtitle}</T>}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        {rightContent}
        <T c={MUTED} s={10}>LIVE</T>
        <T c={CYAN} s={11}>{time.toLocaleTimeString("en-US", { hour12: false })}</T>
        <T c={MUTED} s={10}>{time.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "2-digit" })}</T>
      </div>
    </div>
  );
}