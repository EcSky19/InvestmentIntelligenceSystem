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

function LoadingTerminal({ progress, lines }) {
  const vis = Math.min(lines.length, Math.floor(progress / 8) + 1);
  return (
    <div style={{ padding: 30, fontFamily: "'JetBrains Mono',monospace" }}>
      <div style={{ marginBottom: 20 }}>
        <T c={AMBER} s={13} w={600}>PROCESSING REQUEST</T>
        <div style={{ marginTop: 10, height: 3, background: BORDER, borderRadius: 1 }}>
          <div style={{ height: "100%", background: `linear-gradient(90deg,${AMBER},${GREEN})`, width: `${Math.min(progress, 100)}%`, transition: "width 0.5s ease", borderRadius: 1, boxShadow: `0 0 8px ${GREEN}40` }} />
        </div>
      </div>
      {lines.slice(0, vis).map((l, i) => (
        <div key={i} style={{ padding: "3px 0", opacity: i === vis - 1 ? 0.6 : 1 }}>
          <T c={i === vis - 1 ? YELLOW : GREEN} s={11}>{i < vis - 1 ? "✓" : "▸"} {l}</T>
        </div>
      ))}
    </div>
  );
}

function repairJSON(str) {
  let s = str.replace(/```json|```/g, "").trim();
  if (!s.startsWith("{") && !s.startsWith("[")) {
    const i = s.indexOf("{");
    if (i !== -1) s = s.slice(i); else throw new Error("No JSON found");
  }
  try { return JSON.parse(s); } catch (_) { }
  let trimmed = s.replace(/,\s*$/, "");
  let inS = false, esc = false;
  for (let i = 0; i < trimmed.length; i++) { if (esc) { esc = false; continue; } if (trimmed[i] === "\\") { esc = true; continue; } if (trimmed[i] === '"') inS = !inS; }
  if (inS) trimmed += '"';
  trimmed = trimmed.replace(/,\s*$/, "");
  const stack = []; let inS2 = false, esc2 = false;
  for (let i = 0; i < trimmed.length; i++) { const c = trimmed[i]; if (esc2) { esc2 = false; continue; } if (c === "\\") { esc2 = true; continue; } if (c === '"') { inS2 = !inS2; continue; } if (inS2) continue; if (c === "{" || c === "[") stack.push(c === "{" ? "}" : "]"); else if (c === "}" || c === "]") stack.pop(); }
  try { return JSON.parse(trimmed + stack.reverse().join("")); } catch (_2) { }
  throw new Error("Could not parse API response. Model may have returned incomplete JSON.");
}

async function callClaude(prompt) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 16000, messages: [{ role: "user", content: prompt }] }),
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`);
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || "API error");
  const text = data.content?.map(i => i.text || "").join("\n") || "";
  if (!text) throw new Error("Empty response from API");
  return repairJSON(text);
}

function buildPrimaryPrompt(p) {
  return `You are acting as a senior partner at Bain & Company advising an investment fund.

Analyze the following sector and provide a comprehensive equity analysis:

Sector: ${p.sector}
Industry: ${p.industry || "Full sector scan"}
Geographic scope: ${p.geo}
Stock universe: S&P 500, NASDAQ Composite, and Dow Jones Industrial Average constituents. Only select from publicly traded equities listed on these indices.
Market cap preference: ${p.mcap}
Investment style: ${p.style}
Risk profile: ${p.risk}
Time horizon: ${p.horizon}

CRITICAL: Respond ONLY in valid JSON (no markdown, no backticks, no preamble). Use this exact schema:

{
  "executive_summary": "2-3 sentence overview of sector opportunity",
  "sector_structure": {
    "description": "How the industry makes money and what determines winners",
    "phase": "consolidating|fragmenting|maturing|disrupting",
    "key_drivers": ["driver1","driver2","driver3"]
  },
  "competitors": [
    {
      "ticker": "TICK",
      "name": "Company Name",
      "market_cap_b": 100,
      "revenue_b": 50,
      "revenue_growth_pct": 15,
      "ebitda_margin_pct": 30,
      "net_margin_pct": 20,
      "moat_scores": { "brand": 4, "cost_advantage": 3, "network_effects": 5, "switching_costs": 4, "regulatory": 2, "distribution": 4, "scale": 5 },
      "moat_avg": 3.9,
      "mgmt_score": 8,
      "mgmt_note": "Brief management assessment",
      "innovation_score": 8,
      "innovation_note": "Brief innovation assessment",
      "market_share_trend": "Gaining|Stable|Losing",
      "inst_signal": "Positive|Neutral|Negative",
      "inst_note": "Brief institutional note",
      "strengths": ["s1","s2"],
      "weaknesses": ["w1","w2"],
      "opportunities": ["o1","o2"],
      "threats": ["t1","t2"],
      "key_catalysts": ["c1","c2"],
      "key_risks": ["r1","r2"],
      "weighted_score": 78,
      "classification": "Core compounder|Emerging share gainer|Cyclical|Turnaround|Avoid"
    }
  ],
  "top3_tickers": ["TICK1","TICK2","TICK3"],
  "winner_ticker": "TICK1",
  "winner_case": "Why this is the best overall pick",
  "winner_type": "Best business|Best stock|Best risk-reward",
  "winner_catalysts": ["catalyst1","catalyst2"],
  "winner_risks": ["risk1","risk2"],
  "winner_confirm_signals": ["signal1","signal2"],
  "winner_invalidation_signals": ["signal1","signal2"],
  "sector_threats": ["threat1","threat2","threat3"],
  "high_quality_expensive": ["TICK or empty"],
  "cheap_but_weak": ["TICK or empty"]
}

Provide exactly 5 competitors. Use real data. Keep ALL string values SHORT (under 20 words each). No filler. Weighted scores out of 100. This MUST be valid, complete JSON.`;
}

// ── PRIMARY RESULTS ──
function PrimaryResults({ data, onRunSecondary }) {
  const [tab, setTab] = useState("overview");
  const [sel, setSel] = useState(null);
  const top3 = data.competitors.filter(c => data.top3_tickers.includes(c.ticker));
  const winner = data.competitors.find(c => c.ticker === data.winner_ticker);
  const sorted = [...data.competitors].sort((a, b) => b.weighted_score - a.weighted_score);

  const tabs = [{ id: "overview", label: "EXEC SUMMARY" }, { id: "landscape", label: "LANDSCAPE" }, { id: "moats", label: "MOAT MATRIX" }, { id: "mgmt", label: "MGMT & INNOVATION" }, { id: "rankings", label: "RANKINGS" }, { id: "winner", label: "TOP PICK" }];

  const Modal = ({ comp, onClose }) => (
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.85)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={onClose}>
      <div style={{ background: BG2, border: `1px solid ${BORDER}`, maxWidth: 700, width: "90%", maxHeight: "85vh", overflow: "auto" }} onClick={e => e.stopPropagation()}>
        <div style={{ background: BG3, borderBottom: `1px solid ${BORDER}`, padding: "12px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}><T c={AMBER} s={14} w={700}>{comp.ticker}</T><T c={MUTED} s={11}>{comp.name}</T></div>
          <span onClick={onClose} style={{ cursor: "pointer", color: MUTED, fontSize: 18 }}>×</span>
        </div>
        <div style={{ padding: 20, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div>
            <T c={MUTED} s={9} style={{ textTransform: "uppercase", letterSpacing: "0.1em" }}>Financials</T>
            <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
              {[["Mkt Cap", `$${comp.market_cap_b}B`], ["Revenue", `$${comp.revenue_b}B`], ["Rev Growth", `${comp.revenue_growth_pct}%`], ["EBITDA Margin", `${comp.ebitda_margin_pct}%`], ["Net Margin", `${comp.net_margin_pct}%`]].map(([l, v]) => (
                <div key={l} style={{ display: "flex", justifyContent: "space-between" }}><T c={MUTED} s={10}>{l}</T><T c={WHITE} s={10} w={600}>{v}</T></div>
              ))}
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "center" }}><MoatRadar scores={comp.moat_scores} /></div>
          <div style={{ gridColumn: "1/-1" }}>
            <T c={MUTED} s={9} style={{ textTransform: "uppercase", letterSpacing: "0.1em" }}>SWOT</T>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
              {[["Strengths", comp.strengths, GREEN], ["Weaknesses", comp.weaknesses, RED], ["Opportunities", comp.opportunities, CYAN], ["Threats", comp.threats, YELLOW]].map(([t, items, c]) => (
                <div key={t} style={{ background: BG, border: `1px solid ${BORDER}`, padding: 10 }}>
                  <T c={c} s={9} w={600}>{t}</T>
                  {(items || []).map((item, i) => <div key={i} style={{ marginTop: 4 }}><T c={MUTED} s={10}>▸ {item}</T></div>)}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {sel && <Modal comp={sel} onClose={() => setSel(null)} />}
      <div style={{ display: "flex", borderBottom: `1px solid ${BORDER}`, background: BG2, overflowX: "auto", flexShrink: 0 }}>
        {tabs.map(t => (
          <div key={t.id} onClick={() => setTab(t.id)} style={{ padding: "10px 16px", cursor: "pointer", borderBottom: tab === t.id ? `2px solid ${AMBER}` : "2px solid transparent", background: tab === t.id ? BG3 : "transparent", whiteSpace: "nowrap" }}>
            <T c={tab === t.id ? AMBER : MUTED} s={10} w={tab === t.id ? 600 : 400}>{t.label}</T>
          </div>
        ))}
        <div style={{ marginLeft: "auto", padding: "8px 16px" }}>
          <div onClick={onRunSecondary} style={{ background: MAGENTA + "20", border: `1px solid ${MAGENTA}50`, padding: "4px 14px", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
            <T c={MAGENTA} s={10} w={600}>▸ RUN TRADE READINESS</T>
          </div>
        </div>
      </div>
      <div style={{ flex: 1, overflow: "auto", padding: 20 }}>

        {tab === "overview" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <Panel><T c={AMBER} s={11} w={600}>EXECUTIVE SUMMARY</T><div style={{ marginTop: 10 }}><T c={WHITE} s={12} mono={false}>{data.executive_summary}</T></div></Panel>
            <Panel>
              <T c={AMBER} s={11} w={600}>SECTOR STRUCTURE</T>
              <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Badge color={CYAN}>{data.sector_structure?.phase}</Badge>
                {(data.sector_structure?.key_drivers || []).map((d, i) => <Badge key={i} color={MUTED}>{d}</Badge>)}
              </div>
              <div style={{ marginTop: 10 }}><T c={MUTED} s={11} mono={false}>{data.sector_structure?.description}</T></div>
            </Panel>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
              {top3.map((c, i) => (
                <div key={c.ticker} onClick={() => setSel(c)} style={{ background: BG2, border: `1px solid ${i === 0 ? AMBER + "60" : BORDER}`, padding: 16, cursor: "pointer", position: "relative" }}>
                  {i === 0 && <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: AMBER }} />}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <T c={AMBER} s={13} w={700}>#{i + 1}</T><Badge color={sColor(c.weighted_score)}>{c.weighted_score}/100</Badge>
                  </div>
                  <div style={{ marginTop: 8 }}><T c={WHITE} s={14} w={600}>{c.ticker}</T></div>
                  <div><T c={MUTED} s={10}>{c.name}</T></div>
                  <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <Badge color={tColor(c.market_share_trend)}>{c.market_share_trend}</Badge>
                    <Badge>{c.classification}</Badge>
                  </div>
                </div>
              ))}
            </div>
            <Panel><T c={AMBER} s={11} w={600}>SECTOR THREATS</T><div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 8 }}>{(data.sector_threats || []).map((t, i) => <Badge key={i} color={RED}>{t}</Badge>)}</div></Panel>
          </div>
        )}

        {tab === "landscape" && (
          <div style={{ overflowX: "auto" }}>
            <T c={AMBER} s={11} w={600}>COMPETITIVE LANDSCAPE</T>
            <table style={{ width: "100%", marginTop: 12, borderCollapse: "collapse", fontSize: 11, fontFamily: "'JetBrains Mono',monospace" }}>
              <thead><tr style={{ borderBottom: `2px solid ${BORDER}` }}>
                {["Ticker", "Name", "Mkt Cap", "Rev", "Grw%", "EBITDA%", "Net%", "Share", "Signal", "Score"].map(h => (
                  <th key={h} style={{ padding: "8px 6px", textAlign: "left", color: MUTED, fontSize: 9, textTransform: "uppercase", letterSpacing: "0.08em" }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>{sorted.map(c => (
                <tr key={c.ticker} onClick={() => setSel(c)} style={{ borderBottom: `1px solid ${BORDER}`, cursor: "pointer", background: data.top3_tickers.includes(c.ticker) ? AMBER + "08" : "transparent" }}>
                  <td style={{ padding: "8px 6px", color: data.winner_ticker === c.ticker ? AMBER : WHITE, fontWeight: 600 }}>{c.ticker}</td>
                  <td style={{ padding: "8px 6px", color: MUTED, fontSize: 10, maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</td>
                  <td style={{ padding: "8px 6px", color: WHITE }}>{c.market_cap_b}B</td>
                  <td style={{ padding: "8px 6px", color: WHITE }}>{c.revenue_b}B</td>
                  <td style={{ padding: "8px 6px", color: c.revenue_growth_pct >= 15 ? GREEN : c.revenue_growth_pct >= 5 ? YELLOW : RED }}>{c.revenue_growth_pct}%</td>
                  <td style={{ padding: "8px 6px", color: c.ebitda_margin_pct >= 30 ? GREEN : c.ebitda_margin_pct >= 15 ? YELLOW : RED }}>{c.ebitda_margin_pct}%</td>
                  <td style={{ padding: "8px 6px", color: c.net_margin_pct >= 20 ? GREEN : c.net_margin_pct >= 10 ? YELLOW : RED }}>{c.net_margin_pct}%</td>
                  <td style={{ padding: "8px 6px" }}><Badge color={tColor(c.market_share_trend)}>{c.market_share_trend}</Badge></td>
                  <td style={{ padding: "8px 6px" }}><Badge color={sigColor(c.inst_signal)}>{c.inst_signal}</Badge></td>
                  <td style={{ padding: "8px 6px" }}><ScoreBar value={c.weighted_score} color={sColor(c.weighted_score)} width={50} /></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}

        {tab === "moats" && (
          <div>
            <T c={AMBER} s={11} w={600}>MOAT DURABILITY MATRIX</T>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(230px,1fr))", gap: 16, marginTop: 16 }}>
              {sorted.map(c => (
                <div key={c.ticker} onClick={() => setSel(c)} style={{ background: BG2, border: `1px solid ${data.winner_ticker === c.ticker ? AMBER + "60" : BORDER}`, padding: 16, cursor: "pointer" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <T c={WHITE} s={13} w={700}>{c.ticker}</T><T c={CYAN} s={11} w={600}>{c.moat_avg?.toFixed(1)}/5</T>
                  </div>
                  <MoatRadar scores={c.moat_scores} />
                  <div style={{ marginTop: 8 }}>
                    {Object.entries(c.moat_scores).map(([k, v]) => (
                      <div key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "2px 0" }}>
                        <T c={MUTED} s={9}>{k.replace(/_/g, " ")}</T>
                        <div style={{ display: "flex", gap: 2 }}>{[1, 2, 3, 4, 5].map(n => <div key={n} style={{ width: 8, height: 8, background: n <= v ? CYAN : BORDER, borderRadius: 1 }} />)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "mgmt" && (
          <div>
            <T c={AMBER} s={11} w={600}>MANAGEMENT & INNOVATION SCORECARD</T>
            <table style={{ width: "100%", marginTop: 16, borderCollapse: "collapse", fontSize: 11, fontFamily: "'JetBrains Mono',monospace" }}>
              <thead><tr style={{ borderBottom: `2px solid ${BORDER}` }}>
                {["Ticker", "Mgmt", "Innov", "Management Assessment", "Innovation Assessment"].map(h => (
                  <th key={h} style={{ padding: "8px 6px", textAlign: "left", color: MUTED, fontSize: 9, textTransform: "uppercase" }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>{sorted.map(c => (
                <tr key={c.ticker} style={{ borderBottom: `1px solid ${BORDER}` }}>
                  <td style={{ padding: "10px 6px", color: data.winner_ticker === c.ticker ? AMBER : WHITE, fontWeight: 600 }}>{c.ticker}</td>
                  <td style={{ padding: "10px 6px" }}><ScoreBar value={c.mgmt_score} max={10} color={c.mgmt_score >= 7 ? GREEN : c.mgmt_score >= 5 ? YELLOW : RED} width={40} /></td>
                  <td style={{ padding: "10px 6px" }}><ScoreBar value={c.innovation_score} max={10} color={c.innovation_score >= 7 ? GREEN : c.innovation_score >= 5 ? YELLOW : RED} width={40} /></td>
                  <td style={{ padding: "10px 6px", color: MUTED, fontSize: 10, maxWidth: 200 }}>{c.mgmt_note}</td>
                  <td style={{ padding: "10px 6px", color: MUTED, fontSize: 10, maxWidth: 200 }}>{c.innovation_note}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}

        {tab === "rankings" && (
          <div>
            <T c={AMBER} s={11} w={600}>WEIGHTED INVESTMENT SCORE RANKINGS</T>
            <div style={{ marginTop: 16 }}>
              {sorted.map((c, i) => (
                <div key={c.ticker} onClick={() => setSel(c)} style={{ display: "flex", alignItems: "center", gap: 16, padding: "12px 16px", background: i < 3 ? AMBER + "08" : "transparent", borderBottom: `1px solid ${BORDER}`, cursor: "pointer" }}>
                  <T c={i < 3 ? AMBER : MUTED} s={16} w={700} style={{ width: 30 }}>#{i + 1}</T>
                  <div style={{ flex: "0 0 70px" }}><T c={WHITE} s={14} w={700}>{c.ticker}</T></div>
                  <div style={{ flex: 1 }}><div style={{ height: 10, background: BORDER, borderRadius: 1 }}><div style={{ height: "100%", width: `${c.weighted_score}%`, background: `linear-gradient(90deg,${sColor(c.weighted_score)}80,${sColor(c.weighted_score)})`, borderRadius: 1 }} /></div></div>
                  <T c={sColor(c.weighted_score)} s={16} w={700} style={{ width: 50, textAlign: "right" }}>{c.weighted_score}</T>
                  <div style={{ width: 140 }}><Badge color={c.classification === "Avoid" ? RED : c.classification === "Core compounder" ? GREEN : CYAN}>{c.classification}</Badge></div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "winner" && winner && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ background: `linear-gradient(135deg,${BG2} 0%,${AMBER}08 100%)`, border: `1px solid ${AMBER}40`, padding: 24 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
                <div>
                  <T c={MUTED} s={10}>BEST OVERALL WINNER</T>
                  <div style={{ marginTop: 4 }}><T c={AMBER} s={28} w={700}>{winner.ticker}</T></div>
                  <div><T c={MUTED} s={13}>{winner.name}</T></div>
                  <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <Badge color={AMBER}>{data.winner_type}</Badge>
                    <Badge color={GREEN}>{winner.weighted_score}/100</Badge>
                    <Badge color={tColor(winner.market_share_trend)}>Share: {winner.market_share_trend}</Badge>
                  </div>
                </div>
                <MoatRadar scores={winner.moat_scores} />
              </div>
            </div>
            <Panel><T c={AMBER} s={11} w={600}>INVESTMENT THESIS</T><div style={{ marginTop: 8 }}><T c={WHITE} s={12} mono={false}>{data.winner_case}</T></div></Panel>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {[[data.winner_catalysts, GREEN, "KEY CATALYSTS"], [data.winner_risks, RED, "KEY RISKS"], [data.winner_confirm_signals, CYAN, "CONFIRMATION SIGNALS"], [data.winner_invalidation_signals, YELLOW, "INVALIDATION SIGNALS"]].map(([items, c, title]) => (
                <Panel key={title} border={c + "30"}><T c={c} s={10} w={600}>{title}</T>{(items || []).map((x, i) => <div key={i} style={{ marginTop: 6 }}><T c={WHITE} s={11} mono={false}>▸ {x}</T></div>)}</Panel>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}