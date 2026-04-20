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
  { label: "Energy", industries: ["Oil & Gas (Integrated)", "Oil & Gas (E&P)", "Renewable Energy", "Energy Services", "Uranium", "Utilities"] },
  { label: "Materials", industries: ["Chemicals", "Mining / Metals", "Packaging", "Construction Materials"] },
  { label: "Communication Services", industries: ["Telecom", "Media & Entertainment", "Digital Advertising", "Gaming / Interactive"] },
  { label: "Real Estate", industries: ["Data Centers", "Industrial REITs", "Residential REITs", "Retail REITs", "Office REITs"] },
];
const GEOS = ["All", "United States", "Europe", "Asia-Pacific", "Emerging Markets", "Global"];
const MCAPS = ["All", "Mega Cap (>$200B)", "Large Cap ($10B–$200B)", "Mid Cap ($2B–$10B)", "Small Cap ($300M–$2B)", "Micro Cap (<$300M)"];
const STYLES = ["Growth", "GARP", "Quality", "Value", "Blend"];
const RISKS = ["Conservative", "Moderate", "Aggressive"];
const HORIZONS = ["12 months", "24 months", "36 months"];
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
  return `You are the Sector Alpha Engine inside a modular investment intelligence system.

Your sole purpose: identify which stocks deserve OWNERSHIP as the best long-term names in the sector/industry.
Do NOT include chart timing, entry signals, moving averages, RSI, volume triggers, or "buy now" language.
Focus entirely on business quality, future growth, competitive strength, and probability of long-term outperformance over 1-3 years.

Sector: ${p.sector}
Industry: ${p.industry || "Full sector scan"}
Geographic scope: ${p.geo}
Stock universe: S&P 500, NASDAQ Composite, and Dow Jones Industrial Average constituents only.
Market cap preference: ${p.mcap}
Investment style: ${p.style}
Risk profile: ${p.risk}
Time horizon: ${p.horizon}

Scoring weights (Ownership Score out of 100):
- Future growth potential: 20
- Competitive moat and strategic position: 20
- Financial quality and durability: 15
- Management quality and capital allocation: 15
- Market share gain potential: 10
- Innovation and reinvestment strength: 10
- Institutional quality / sponsorship: 5
- Valuation support vs growth/quality: 5

CRITICAL: Respond ONLY in valid JSON (no markdown, no backticks, no preamble). Use this exact schema:

{
  "executive_summary": "2-3 sentence ownership thesis for the sector",
  "sector_structure": {
    "description": "How the industry creates value and what determines long-term winners",
    "phase": "consolidating|fragmenting|maturing|disrupting",
    "key_drivers": ["driver1","driver2","driver3"],
    "secular_tailwinds": ["tailwind1","tailwind2"],
    "industry_growth_rate": "Low|Moderate|High|Very High"
  },
  "competitors": [
    {
      "ticker": "TICK",
      "name": "Company Name",
      "market_cap_b": 100,
      "revenue_b": 50,
      "revenue_growth_pct": 15,
      "earnings_growth_pct": 20,
      "gross_margin_pct": 60,
      "ebitda_margin_pct": 30,
      "net_margin_pct": 20,
      "fcf_margin_pct": 18,
      "roic_pct": 25,
      "moat_scores": { "brand": 4, "cost_advantage": 3, "network_effects": 5, "switching_costs": 4, "regulatory": 2, "distribution": 4, "scale": 5 },
      "moat_avg": 3.9,
      "mgmt_score": 8,
      "mgmt_note": "Brief management and capital allocation assessment",
      "innovation_score": 8,
      "innovation_note": "Brief innovation and reinvestment assessment",
      "financial_quality_score": 8,
      "financial_note": "Brief financial durability assessment",
      "market_share_trend": "Gaining|Stable|Losing",
      "growth_sustainability": "Accelerating|Stable|Decelerating",
      "inst_signal": "Positive|Neutral|Negative",
      "inst_note": "Brief institutional quality note",
      "strengths": ["s1","s2"],
      "weaknesses": ["w1","w2"],
      "opportunities": ["o1","o2"],
      "threats": ["t1","t2"],
      "ownership_drivers": ["why own this stock long-term 1","reason 2"],
      "key_risks": ["r1","r2"],
      "ownership_score": 78,
      "classification": "Core compounder|Emerging leader|High-upside challenger|Cyclical|Avoid"
    }
  ],
  "top5_tickers": ["TICK1","TICK2","TICK3","TICK4","TICK5"],
  "winner_ticker": "TICK1",
  "winner_case": "Why this is the single strongest ownership candidate",
  "winner_type": "Best business to own|Best stock to own|Best risk-reward long-term",
  "winner_long_term_drivers": ["long-term reason 1","reason 2"],
  "winner_ownership_risks": ["risk1","risk2"],
  "sector_threats": ["threat1","threat2","threat3"],
  "high_quality_expensive": ["TICK"],
  "good_story_weak_execution": ["TICK"],
  "high_upside_high_risk": ["TICK"]
}

Provide exactly 7 competitors. Use real financial data. Keep ALL string values SHORT (under 20 words each). No filler. Ownership scores out of 100. This MUST be valid, complete JSON.`;
}

function buildSecondaryPrompt(pd, p) {
  const tickers = pd.competitors.map(c => c.ticker);
  const scores = Object.fromEntries(pd.competitors.map(c => [c.ticker, c.ownership_score]));
  return `You are a senior market-structure strategist inside an institutional investment system.

The primary engine identified the highest-quality names in ${p.sector} / ${p.industry || "full sector"}.

Shortlisted tickers: ${tickers.join(", ")}
Foundation scores: ${JSON.stringify(scores)}
Time horizon: ${p.tradeHorizon}
Risk tolerance: ${p.risk}

For each ticker, evaluate: market structure confirmation, fundamental inflection triggers, sponsorship/smart-money validation, catalyst proximity, and risk alerts.

CRITICAL: Respond ONLY in valid JSON (no markdown, no backticks). Use this exact schema:

{
  "analysis_summary": "2-3 sentence overview of current tactical landscape",
  "stocks": [
    {
      "ticker": "TICK",
      "name": "Company Name",
      "thesis_status": "Intact|Strengthening|Weakening|Broken",
      "what_changed": "Brief description of recent changes",
      "best_bullish": "Single strongest bullish evidence",
      "best_bearish": "Single strongest bearish evidence",
      "foundation_score": 78,
      "confirmation_score": 65,
      "catalyst_score": 70,
      "sponsorship_score": 60,
      "risk_penalty": 10,
      "final_actionability": 62,
      "alert_state": "Watch|Ready|Triggered|Extended|Broken|Avoid",
      "entry_quality": "Early|Proper|Extended|Broken",
      "active_alerts": [
        { "text": "alert description", "tier": 1, "type": "bullish|bearish|neutral" }
      ],
      "upgrade_trigger": "What would move this to a higher state",
      "downgrade_trigger": "What would move this to a lower state",
      "market_structure_notes": "Key technical/structure observations",
      "catalyst_events": [
        { "event": "Earnings Q2", "timing": "~30 days", "bias": "bullish|bearish|two-sided" }
      ],
      "actionable_now": true
    }
  ],
  "best_act_now": { "ticker": "TICK", "reason": "Why act now" },
  "best_watchlist": { "ticker": "TICK", "reason": "Why watch" },
  "false_positive": { "ticker": "TICK", "reason": "Why dangerous" },
  "overall_posture": "Risk-on|Selective|Cautious|Defensive"
}

Be precise. Keep ALL string values SHORT (under 20 words). Limit active_alerts to 3 per stock max, catalyst_events to 2 max. This MUST be valid, complete JSON.`;
}

// ── PRIMARY RESULTS ──
function PrimaryResults({ data, onRunSecondary }) {
  const [tab, setTab] = useState("overview");
  const [sel, setSel] = useState(null);
  const top5 = data.competitors?.filter(c => (data.top5_tickers || data.top3_tickers || []).includes(c.ticker)) || [];
  const winner = data.competitors?.find(c => c.ticker === data.winner_ticker);
  const sorted = [...(data.competitors || [])].sort((a, b) => (b.ownership_score || b.weighted_score || 0) - (a.ownership_score || a.weighted_score || 0));
  const getScore = c => c.ownership_score ?? c.weighted_score ?? 0;
  const isTop = t => (data.top5_tickers || data.top3_tickers || []).includes(t);

  const tabs = [{ id: "overview", label: "OWNERSHIP THESIS" }, { id: "landscape", label: "LANDSCAPE" }, { id: "financials", label: "FINANCIAL QUALITY" }, { id: "moats", label: "MOAT MATRIX" }, { id: "mgmt", label: "MGMT & INNOVATION" }, { id: "rankings", label: "OWNERSHIP RANKINGS" }, { id: "winner", label: "#1 PICK" }];

  const clsColor = cl => ({ Avoid: RED, Cyclical: YELLOW, "Core compounder": GREEN, "Emerging leader": CYAN, "High-upside challenger": AMBER }[cl] || MUTED);

  const Modal = ({ comp, onClose }) => (
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.85)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={onClose}>
      <div style={{ background: BG2, border: `1px solid ${BORDER}`, maxWidth: 720, width: "92%", maxHeight: "85vh", overflow: "auto" }} onClick={e => e.stopPropagation()}>
        <div style={{ background: BG3, borderBottom: `1px solid ${BORDER}`, padding: "12px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <T c={AMBER} s={14} w={700}>{comp.ticker}</T><T c={MUTED} s={11}>{comp.name}</T>
            <Badge color={clsColor(comp.classification)}>{comp.classification}</Badge>
          </div>
          <span onClick={onClose} style={{ cursor: "pointer", color: MUTED, fontSize: 18 }}>×</span>
        </div>
        <div style={{ padding: 20, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div>
            <T c={MUTED} s={9} style={{ textTransform: "uppercase", letterSpacing: "0.1em" }}>Financials</T>
            <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
              {[["Mkt Cap", `$${comp.market_cap_b}B`], ["Revenue", `$${comp.revenue_b}B`], ["Rev Growth", `${comp.revenue_growth_pct}%`], ["Earnings Growth", `${comp.earnings_growth_pct || "—"}%`], ["Gross Margin", `${comp.gross_margin_pct || "—"}%`], ["EBITDA Margin", `${comp.ebitda_margin_pct}%`], ["Net Margin", `${comp.net_margin_pct}%`], ["FCF Margin", `${comp.fcf_margin_pct || "—"}%`], ["ROIC", `${comp.roic_pct || "—"}%`]].map(([l, v]) => (
                <div key={l} style={{ display: "flex", justifyContent: "space-between" }}><T c={MUTED} s={10}>{l}</T><T c={WHITE} s={10} w={600}>{v}</T></div>
              ))}
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "center" }}><MoatRadar scores={comp.moat_scores} /></div>
          <div style={{ gridColumn: "1/-1", display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
            {[["Mgmt", comp.mgmt_score, 10], ["Innovation", comp.innovation_score, 10], ["Fin Quality", comp.financial_quality_score, 10], ["Ownership", getScore(comp), 100]].map(([l, v, m]) => (
              <div key={l} style={{ background: BG, border: `1px solid ${BORDER}`, padding: 10, textAlign: "center" }}>
                <T c={MUTED} s={8} style={{ textTransform: "uppercase" }}>{l}</T>
                <div style={{ marginTop: 4 }}><T c={sColor(m === 10 ? v * 10 : v)} s={18} w={700}>{v}{m === 10 ? "/10" : "/100"}</T></div>
              </div>
            ))}
          </div>
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
          {(comp.ownership_drivers || comp.key_catalysts) && (
            <div style={{ gridColumn: "1/-1" }}>
              <T c={GREEN} s={9} w={600}>WHY OWN THIS STOCK</T>
              {(comp.ownership_drivers || comp.key_catalysts || []).map((d, i) => <div key={i} style={{ marginTop: 4 }}><T c={WHITE} s={10} mono={false}>▸ {d}</T></div>)}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {sel && <Modal comp={sel} onClose={() => setSel(null)} />}
      <div style={{ display: "flex", borderBottom: `1px solid ${BORDER}`, background: BG2, overflowX: "auto", flexShrink: 0 }}>
        {tabs.map(t => (
          <div key={t.id} onClick={() => setTab(t.id)} style={{ padding: "10px 14px", cursor: "pointer", borderBottom: tab === t.id ? `2px solid ${AMBER}` : "2px solid transparent", background: tab === t.id ? BG3 : "transparent", whiteSpace: "nowrap" }}>
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
            <Panel><T c={AMBER} s={11} w={600}>SECTOR OWNERSHIP THESIS</T><div style={{ marginTop: 10 }}><T c={WHITE} s={12} mono={false}>{data.executive_summary}</T></div></Panel>
            <Panel>
              <T c={AMBER} s={11} w={600}>INDUSTRY STRUCTURE</T>
              <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Badge color={CYAN}>{data.sector_structure?.phase}</Badge>
                <Badge color={GREEN}>{data.sector_structure?.industry_growth_rate || "—"} Growth</Badge>
                {(data.sector_structure?.key_drivers || []).map((d, i) => <Badge key={i} color={MUTED}>{d}</Badge>)}
              </div>
              <div style={{ marginTop: 10 }}><T c={MUTED} s={11} mono={false}>{data.sector_structure?.description}</T></div>
              {data.sector_structure?.secular_tailwinds?.length > 0 && (
                <div style={{ marginTop: 10 }}>
                  <T c={CYAN} s={9} w={600}>SECULAR TAILWINDS</T>
                  <div style={{ marginTop: 6, display: "flex", gap: 8, flexWrap: "wrap" }}>{data.sector_structure.secular_tailwinds.map((t, i) => <Badge key={i} color={CYAN}>{t}</Badge>)}</div>
                </div>
              )}
            </Panel>
            <T c={AMBER} s={11} w={600}>TOP 5 OWNERSHIP CANDIDATES</T>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: 12 }}>
              {top5.slice(0, 5).map((c, i) => (
                <div key={c.ticker} onClick={() => setSel(c)} style={{ background: BG2, border: `1px solid ${i === 0 ? AMBER + "60" : BORDER}`, padding: 16, cursor: "pointer", position: "relative" }}>
                  {i === 0 && <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: AMBER }} />}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <T c={AMBER} s={13} w={700}>#{i + 1}</T><Badge color={sColor(getScore(c))}>{getScore(c)}/100</Badge>
                  </div>
                  <div style={{ marginTop: 8 }}><T c={WHITE} s={14} w={600}>{c.ticker}</T></div>
                  <div><T c={MUTED} s={10}>{c.name}</T></div>
                  <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <Badge color={tColor(c.market_share_trend)}>{c.market_share_trend}</Badge>
                    <Badge color={clsColor(c.classification)}>{c.classification}</Badge>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              {[
                [data.high_quality_expensive, YELLOW, "HIGH QUALITY BUT EXPENSIVE"],
                [data.good_story_weak_execution || data.cheap_but_weak, AMBER, "GOOD STORY / WEAK EXECUTION"],
                [data.high_upside_high_risk, MAGENTA, "HIGH UPSIDE / HIGH RISK"],
              ].map(([items, c, title]) => (items?.length > 0 && items[0]) ? (
                <Panel key={title} border={c + "30"}><T c={c} s={9} w={600}>{title}</T><div style={{ marginTop: 6, display: "flex", gap: 6, flexWrap: "wrap" }}>{items.map(t => <Badge key={t} color={c}>{t}</Badge>)}</div></Panel>
              ) : null)}
            </div>
            <Panel><T c={RED} s={11} w={600}>SECTOR THREATS</T><div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 8 }}>{(data.sector_threats || []).map((t, i) => <Badge key={i} color={RED}>{t}</Badge>)}</div></Panel>
          </div>
        )}

        {tab === "landscape" && (
          <div style={{ overflowX: "auto" }}>
            <T c={AMBER} s={11} w={600}>COMPETITIVE LANDSCAPE</T>
            <table style={{ width: "100%", marginTop: 12, borderCollapse: "collapse", fontSize: 11, fontFamily: "'JetBrains Mono',monospace" }}>
              <thead><tr style={{ borderBottom: `2px solid ${BORDER}` }}>
                {["Ticker", "Name", "Mkt Cap", "Rev", "Rev%", "Earn%", "Share", "Growth", "Class", "Score"].map(h => (
                  <th key={h} style={{ padding: "8px 6px", textAlign: "left", color: MUTED, fontSize: 9, textTransform: "uppercase", letterSpacing: "0.08em" }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>{sorted.map(c => (
                <tr key={c.ticker} onClick={() => setSel(c)} style={{ borderBottom: `1px solid ${BORDER}`, cursor: "pointer", background: isTop(c.ticker) ? AMBER + "08" : "transparent" }}>
                  <td style={{ padding: "8px 6px", color: data.winner_ticker === c.ticker ? AMBER : WHITE, fontWeight: 600 }}>{c.ticker}</td>
                  <td style={{ padding: "8px 6px", color: MUTED, fontSize: 10, maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</td>
                  <td style={{ padding: "8px 6px", color: WHITE }}>{c.market_cap_b}B</td>
                  <td style={{ padding: "8px 6px", color: WHITE }}>{c.revenue_b}B</td>
                  <td style={{ padding: "8px 6px", color: c.revenue_growth_pct >= 15 ? GREEN : c.revenue_growth_pct >= 5 ? YELLOW : RED }}>{c.revenue_growth_pct}%</td>
                  <td style={{ padding: "8px 6px", color: (c.earnings_growth_pct || 0) >= 20 ? GREEN : (c.earnings_growth_pct || 0) >= 10 ? YELLOW : RED }}>{c.earnings_growth_pct || "—"}%</td>
                  <td style={{ padding: "8px 6px" }}><Badge color={tColor(c.market_share_trend)}>{c.market_share_trend}</Badge></td>
                  <td style={{ padding: "8px 6px" }}><Badge color={c.growth_sustainability === "Accelerating" ? GREEN : c.growth_sustainability === "Decelerating" ? RED : YELLOW}>{c.growth_sustainability || "—"}</Badge></td>
                  <td style={{ padding: "8px 6px" }}><Badge color={clsColor(c.classification)}>{c.classification}</Badge></td>
                  <td style={{ padding: "8px 6px" }}><ScoreBar value={getScore(c)} color={sColor(getScore(c))} width={50} /></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}

        {tab === "financials" && (
          <div style={{ overflowX: "auto" }}>
            <T c={AMBER} s={11} w={600}>FINANCIAL QUALITY COMPARISON</T>
            <table style={{ width: "100%", marginTop: 12, borderCollapse: "collapse", fontSize: 11, fontFamily: "'JetBrains Mono',monospace" }}>
              <thead><tr style={{ borderBottom: `2px solid ${BORDER}` }}>
                {["Ticker", "Gross%", "EBITDA%", "Net%", "FCF%", "ROIC%", "Fin Score", "Assessment"].map(h => (
                  <th key={h} style={{ padding: "8px 6px", textAlign: "left", color: MUTED, fontSize: 9, textTransform: "uppercase", letterSpacing: "0.08em" }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>{sorted.map(c => (
                <tr key={c.ticker} onClick={() => setSel(c)} style={{ borderBottom: `1px solid ${BORDER}`, cursor: "pointer", background: isTop(c.ticker) ? AMBER + "08" : "transparent" }}>
                  <td style={{ padding: "8px 6px", color: data.winner_ticker === c.ticker ? AMBER : WHITE, fontWeight: 600 }}>{c.ticker}</td>
                  <td style={{ padding: "8px 6px", color: (c.gross_margin_pct || 0) >= 50 ? GREEN : (c.gross_margin_pct || 0) >= 30 ? YELLOW : RED }}>{c.gross_margin_pct || "—"}%</td>
                  <td style={{ padding: "8px 6px", color: c.ebitda_margin_pct >= 30 ? GREEN : c.ebitda_margin_pct >= 15 ? YELLOW : RED }}>{c.ebitda_margin_pct}%</td>
                  <td style={{ padding: "8px 6px", color: c.net_margin_pct >= 20 ? GREEN : c.net_margin_pct >= 10 ? YELLOW : RED }}>{c.net_margin_pct}%</td>
                  <td style={{ padding: "8px 6px", color: (c.fcf_margin_pct || 0) >= 15 ? GREEN : (c.fcf_margin_pct || 0) >= 5 ? YELLOW : RED }}>{c.fcf_margin_pct || "—"}%</td>
                  <td style={{ padding: "8px 6px", color: (c.roic_pct || 0) >= 20 ? GREEN : (c.roic_pct || 0) >= 10 ? YELLOW : RED }}>{c.roic_pct || "—"}%</td>
                  <td style={{ padding: "8px 6px" }}><ScoreBar value={c.financial_quality_score || 5} max={10} color={(c.financial_quality_score || 5) >= 7 ? GREEN : (c.financial_quality_score || 5) >= 5 ? YELLOW : RED} width={40} /></td>
                  <td style={{ padding: "8px 6px", color: MUTED, fontSize: 10, maxWidth: 200 }}>{c.financial_note || "—"}</td>
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
                    {Object.entries(c.moat_scores || {}).map(([k, v]) => (
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
            <T c={AMBER} s={11} w={600}>MANAGEMENT, INNOVATION & FINANCIAL QUALITY SCORECARD</T>
            <table style={{ width: "100%", marginTop: 16, borderCollapse: "collapse", fontSize: 11, fontFamily: "'JetBrains Mono',monospace" }}>
              <thead><tr style={{ borderBottom: `2px solid ${BORDER}` }}>
                {["Ticker", "Mgmt", "Innov", "Fin Qual", "Management", "Innovation"].map(h => (
                  <th key={h} style={{ padding: "8px 6px", textAlign: "left", color: MUTED, fontSize: 9, textTransform: "uppercase" }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>{sorted.map(c => (
                <tr key={c.ticker} style={{ borderBottom: `1px solid ${BORDER}` }}>
                  <td style={{ padding: "10px 6px", color: data.winner_ticker === c.ticker ? AMBER : WHITE, fontWeight: 600 }}>{c.ticker}</td>
                  <td style={{ padding: "10px 6px" }}><ScoreBar value={c.mgmt_score} max={10} color={c.mgmt_score >= 7 ? GREEN : c.mgmt_score >= 5 ? YELLOW : RED} width={40} /></td>
                  <td style={{ padding: "10px 6px" }}><ScoreBar value={c.innovation_score} max={10} color={c.innovation_score >= 7 ? GREEN : c.innovation_score >= 5 ? YELLOW : RED} width={40} /></td>
                  <td style={{ padding: "10px 6px" }}><ScoreBar value={c.financial_quality_score || 5} max={10} color={(c.financial_quality_score || 5) >= 7 ? GREEN : (c.financial_quality_score || 5) >= 5 ? YELLOW : RED} width={40} /></td>
                  <td style={{ padding: "10px 6px", color: MUTED, fontSize: 10, maxWidth: 180 }}>{c.mgmt_note}</td>
                  <td style={{ padding: "10px 6px", color: MUTED, fontSize: 10, maxWidth: 180 }}>{c.innovation_note}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}

        {tab === "rankings" && (
          <div>
            <T c={AMBER} s={11} w={600}>OWNERSHIP SCORE RANKINGS</T>
            <div style={{ marginTop: 16 }}>
              {sorted.map((c, i) => (
                <div key={c.ticker} onClick={() => setSel(c)} style={{ display: "flex", alignItems: "center", gap: 16, padding: "12px 16px", background: i < 5 ? AMBER + "08" : "transparent", borderBottom: `1px solid ${BORDER}`, cursor: "pointer" }}>
                  <T c={i < 5 ? AMBER : MUTED} s={16} w={700} style={{ width: 30 }}>#{i + 1}</T>
                  <div style={{ flex: "0 0 70px" }}><T c={WHITE} s={14} w={700}>{c.ticker}</T></div>
                  <div style={{ flex: 1 }}><div style={{ height: 10, background: BORDER, borderRadius: 1 }}><div style={{ height: "100%", width: `${getScore(c)}%`, background: `linear-gradient(90deg,${sColor(getScore(c))}80,${sColor(getScore(c))})`, borderRadius: 1 }} /></div></div>
                  <T c={sColor(getScore(c))} s={16} w={700} style={{ width: 50, textAlign: "right" }}>{getScore(c)}</T>
                  <div style={{ width: 160 }}><Badge color={clsColor(c.classification)}>{c.classification}</Badge></div>
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
                  <T c={MUTED} s={10}>STRONGEST OWNERSHIP CANDIDATE</T>
                  <div style={{ marginTop: 4 }}><T c={AMBER} s={28} w={700}>{winner.ticker}</T></div>
                  <div><T c={MUTED} s={13}>{winner.name}</T></div>
                  <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <Badge color={AMBER}>{data.winner_type}</Badge>
                    <Badge color={GREEN}>{getScore(winner)}/100</Badge>
                    <Badge color={tColor(winner.market_share_trend)}>Share: {winner.market_share_trend}</Badge>
                    <Badge color={clsColor(winner.classification)}>{winner.classification}</Badge>
                  </div>
                </div>
                <MoatRadar scores={winner.moat_scores} />
              </div>
            </div>
            <Panel><T c={AMBER} s={11} w={600}>OWNERSHIP THESIS</T><div style={{ marginTop: 8 }}><T c={WHITE} s={12} mono={false}>{data.winner_case}</T></div></Panel>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Panel border={GREEN + "30"}><T c={GREEN} s={10} w={600}>LONG-TERM OWNERSHIP DRIVERS</T>{(data.winner_long_term_drivers || data.winner_catalysts || []).map((x, i) => <div key={i} style={{ marginTop: 6 }}><T c={WHITE} s={11} mono={false}>▸ {x}</T></div>)}</Panel>
              <Panel border={RED + "30"}><T c={RED} s={10} w={600}>OWNERSHIP RISKS</T>{(data.winner_ownership_risks || data.winner_risks || []).map((x, i) => <div key={i} style={{ marginTop: 6 }}><T c={WHITE} s={11} mono={false}>▸ {x}</T></div>)}</Panel>
            </div>
            {winner.strengths && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {[["Strengths", winner.strengths, GREEN], ["Weaknesses", winner.weaknesses, RED], ["Opportunities", winner.opportunities, CYAN], ["Threats", winner.threats, YELLOW]].map(([t, items, c]) => (
                  <Panel key={t} border={c + "20"}><T c={c} s={10} w={600}>{t}</T>{(items || []).map((item, i) => <div key={i} style={{ marginTop: 4 }}><T c={MUTED} s={10}>▸ {item}</T></div>)}</Panel>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── SECONDARY RESULTS (Trade Readiness) ──
function SecondaryResults({ data }) {
  const [tab, setTab] = useState("dashboard");
  const [sel, setSel] = useState(null);
  const sorted = [...data.stocks].sort((a, b) => b.final_actionability - a.final_actionability);

  const tabs = [{ id: "dashboard", label: "ACTIONABILITY DASHBOARD" }, { id: "matrix", label: "SCORE MATRIX" }, { id: "alerts", label: "ACTIVE ALERTS" }, { id: "catalysts", label: "CATALYST MAP" }, { id: "verdict", label: "FINAL VERDICT" }];

  const StockModal = ({ stock, onClose }) => (
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.88)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={onClose}>
      <div style={{ background: BG2, border: `1px solid ${BORDER}`, maxWidth: 750, width: "92%", maxHeight: "88vh", overflow: "auto" }} onClick={e => e.stopPropagation()}>
        <div style={{ background: BG3, borderBottom: `1px solid ${BORDER}`, padding: "12px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <T c={AMBER} s={16} w={700}>{stock.ticker}</T>
            <Badge color={stColor(stock.alert_state)}>{stock.alert_state}</Badge>
            <Badge color={eColor(stock.entry_quality)}>{stock.entry_quality} Entry</Badge>
          </div>
          <span onClick={onClose} style={{ cursor: "pointer", color: MUTED, fontSize: 18 }}>×</span>
        </div>
        <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap" }}>
            {[["Foundation", stock.foundation_score], ["Confirmation", stock.confirmation_score], ["Catalyst", stock.catalyst_score], ["Sponsorship", stock.sponsorship_score]].map(([l, v]) => <ActionGauge key={l} score={v} label={l} />)}
            <div style={{ textAlign: "center" }}><div style={{ width: 90, height: 60, display: "flex", alignItems: "center", justifyContent: "center" }}><T c={RED} s={28} w={700}>-{stock.risk_penalty}</T></div><T c={MUTED} s={8} style={{ textTransform: "uppercase", letterSpacing: "0.1em" }}>Risk Penalty</T></div>
          </div>
          <div style={{ textAlign: "center", padding: 12, background: BG, border: `1px solid ${sColor(stock.final_actionability)}30` }}>
            <T c={MUTED} s={9} style={{ textTransform: "uppercase" }}>Final Actionability</T>
            <div><T c={sColor(stock.final_actionability)} s={36} w={700}>{stock.final_actionability}</T></div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Panel border={GREEN + "30"}><T c={GREEN} s={9} w={600}>BEST BULLISH EVIDENCE</T><div style={{ marginTop: 6 }}><T c={WHITE} s={11} mono={false}>{stock.best_bullish}</T></div></Panel>
            <Panel border={RED + "30"}><T c={RED} s={9} w={600}>BEST BEARISH EVIDENCE</T><div style={{ marginTop: 6 }}><T c={WHITE} s={11} mono={false}>{stock.best_bearish}</T></div></Panel>
            <Panel><T c={MUTED} s={9} w={600}>WHAT CHANGED</T><div style={{ marginTop: 6 }}><T c={WHITE} s={11} mono={false}>{stock.what_changed}</T></div></Panel>
            <Panel><T c={MUTED} s={9} w={600}>MARKET STRUCTURE</T><div style={{ marginTop: 6 }}><T c={WHITE} s={11} mono={false}>{stock.market_structure_notes}</T></div></Panel>
            <Panel border={CYAN + "30"}><T c={CYAN} s={9} w={600}>UPGRADE TRIGGER</T><div style={{ marginTop: 6 }}><T c={WHITE} s={11} mono={false}>{stock.upgrade_trigger}</T></div></Panel>
            <Panel border={YELLOW + "30"}><T c={YELLOW} s={9} w={600}>DOWNGRADE TRIGGER</T><div style={{ marginTop: 6 }}><T c={WHITE} s={11} mono={false}>{stock.downgrade_trigger}</T></div></Panel>
          </div>
          {stock.active_alerts?.length > 0 && (
            <Panel><T c={AMBER} s={9} w={600}>ACTIVE ALERTS</T><div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
              {stock.active_alerts.map((a, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Badge color={a.tier === 1 ? GREEN : a.tier === 2 ? YELLOW : MUTED}>T{a.tier}</Badge>
                  <Badge color={a.type === "bullish" ? GREEN : a.type === "bearish" ? RED : MUTED}>{a.type}</Badge>
                  <T c={WHITE} s={10} mono={false}>{a.text}</T>
                </div>
              ))}
            </div></Panel>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {sel && <StockModal stock={sel} onClose={() => setSel(null)} />}
      <div style={{ display: "flex", borderBottom: `1px solid ${BORDER}`, background: BG2, overflowX: "auto", flexShrink: 0 }}>
        {tabs.map(t => (
          <div key={t.id} onClick={() => setTab(t.id)} style={{ padding: "10px 16px", cursor: "pointer", borderBottom: tab === t.id ? `2px solid ${MAGENTA}` : "2px solid transparent", background: tab === t.id ? BG3 : "transparent", whiteSpace: "nowrap" }}>
            <T c={tab === t.id ? MAGENTA : MUTED} s={10} w={tab === t.id ? 600 : 400}>{t.label}</T>
          </div>
        ))}
      </div>
      <div style={{ flex: 1, overflow: "auto", padding: 20 }}>

        {tab === "dashboard" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <T c={MAGENTA} s={11} w={600}>TRADE READINESS DASHBOARD</T>
              <Badge color={data.overall_posture === "Risk-on" ? GREEN : data.overall_posture === "Defensive" ? RED : YELLOW}>{data.overall_posture}</Badge>
            </div>
            <Panel><T c={WHITE} s={12} mono={false}>{data.analysis_summary}</T></Panel>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 12 }}>
              {sorted.map(s => (
                <div key={s.ticker} onClick={() => setSel(s)} style={{ background: BG2, border: `1px solid ${stColor(s.alert_state)}30`, padding: 16, cursor: "pointer", position: "relative" }}>
                  <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: stColor(s.alert_state) }} />
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <T c={WHITE} s={16} w={700}>{s.ticker}</T>
                    <T c={sColor(s.final_actionability)} s={20} w={700}>{s.final_actionability}</T>
                  </div>
                  <div style={{ marginTop: 6 }}><T c={MUTED} s={10}>{s.name}</T></div>
                  <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <Badge color={stColor(s.alert_state)}>{s.alert_state}</Badge>
                    <Badge color={eColor(s.entry_quality)}>{s.entry_quality}</Badge>
                    <Badge color={s.thesis_status === "Strengthening" ? GREEN : s.thesis_status === "Weakening" ? RED : CYAN}>{s.thesis_status}</Badge>
                    {s.actionable_now && <Badge color={GREEN}>ACT NOW</Badge>}
                  </div>
                  <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
                    {[["FND", s.foundation_score], ["CNF", s.confirmation_score], ["CAT", s.catalyst_score], ["SPN", s.sponsorship_score]].map(([l, v]) => (
                      <div key={l} style={{ display: "flex", justifyContent: "space-between" }}><T c={MUTED} s={9}>{l}</T><ScoreBar value={v} color={sColor(v)} width={40} /></div>
                    ))}
                    <div style={{ display: "flex", justifyContent: "space-between" }}><T c={MUTED} s={9}>RSK</T><T c={RED} s={10} w={600}>-{s.risk_penalty}</T></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "matrix" && (
          <div style={{ overflowX: "auto" }}>
            <T c={MAGENTA} s={11} w={600}>ACTIONABILITY SCORE MATRIX</T>
            <table style={{ width: "100%", marginTop: 16, borderCollapse: "collapse", fontSize: 11, fontFamily: "'JetBrains Mono',monospace" }}>
              <thead><tr style={{ borderBottom: `2px solid ${BORDER}` }}>
                {["Ticker", "Found", "Confirm", "Catal", "Spons", "Risk", "FINAL", "State", "Entry", "Act?"].map(h => (
                  <th key={h} style={{ padding: "8px 6px", textAlign: "left", color: MUTED, fontSize: 9, textTransform: "uppercase" }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>{sorted.map(s => (
                <tr key={s.ticker} onClick={() => setSel(s)} style={{ borderBottom: `1px solid ${BORDER}`, cursor: "pointer", background: s.actionable_now ? GREEN + "06" : "transparent" }}>
                  <td style={{ padding: "8px 6px", color: data.best_act_now?.ticker === s.ticker ? AMBER : WHITE, fontWeight: 600 }}>{s.ticker}</td>
                  <td style={{ padding: "8px 6px" }}><ScoreBar value={s.foundation_score} color={sColor(s.foundation_score)} width={40} /></td>
                  <td style={{ padding: "8px 6px" }}><ScoreBar value={s.confirmation_score} color={sColor(s.confirmation_score)} width={40} /></td>
                  <td style={{ padding: "8px 6px" }}><ScoreBar value={s.catalyst_score} color={sColor(s.catalyst_score)} width={40} /></td>
                  <td style={{ padding: "8px 6px" }}><ScoreBar value={s.sponsorship_score} color={sColor(s.sponsorship_score)} width={40} /></td>
                  <td style={{ padding: "8px 6px" }}><T c={RED} s={11} w={600}>-{s.risk_penalty}</T></td>
                  <td style={{ padding: "8px 6px" }}><T c={sColor(s.final_actionability)} s={14} w={700}>{s.final_actionability}</T></td>
                  <td style={{ padding: "8px 6px" }}><Badge color={stColor(s.alert_state)}>{s.alert_state}</Badge></td>
                  <td style={{ padding: "8px 6px" }}><Badge color={eColor(s.entry_quality)}>{s.entry_quality}</Badge></td>
                  <td style={{ padding: "8px 6px" }}><T c={s.actionable_now ? GREEN : RED} s={11} w={600}>{s.actionable_now ? "YES" : "NO"}</T></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}

        {tab === "alerts" && (
          <div>
            <T c={MAGENTA} s={11} w={600}>ACTIVE ALERTS BY TIER</T>
            {[1, 2, 3].map(tier => {
              const alerts = sorted.flatMap(s => (s.active_alerts || []).filter(a => a.tier === tier).map(a => ({ ...a, ticker: s.ticker })));
              if (!alerts.length) return null;
              return (
                <div key={tier} style={{ marginTop: 16 }}>
                  <T c={tier === 1 ? GREEN : tier === 2 ? YELLOW : MUTED} s={10} w={600}>TIER {tier} — {tier === 1 ? "THESIS-CHANGING" : tier === 2 ? "READINESS-IMPROVING" : "CONTEXT-ONLY"}</T>
                  <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
                    {alerts.map((a, i) => (
                      <div key={i} style={{ background: BG2, border: `1px solid ${BORDER}`, padding: "8px 12px", display: "flex", alignItems: "center", gap: 10 }}>
                        <T c={AMBER} s={11} w={700} style={{ width: 50 }}>{a.ticker}</T>
                        <Badge color={a.type === "bullish" ? GREEN : a.type === "bearish" ? RED : MUTED}>{a.type}</Badge>
                        <T c={WHITE} s={10} mono={false}>{a.text}</T>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {tab === "catalysts" && (
          <div>
            <T c={MAGENTA} s={11} w={600}>CATALYST PROXIMITY MAP</T>
            <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 12 }}>
              {sorted.map(s => (
                <Panel key={s.ticker}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                    <T c={WHITE} s={13} w={700}>{s.ticker}</T>
                    <Badge color={stColor(s.alert_state)}>{s.alert_state}</Badge>
                    <T c={MUTED} s={10}>Catalyst Score: </T><T c={sColor(s.catalyst_score)} s={11} w={600}>{s.catalyst_score}</T>
                  </div>
                  {(s.catalyst_events || []).length > 0 ? (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {s.catalyst_events.map((ce, i) => (
                        <div key={i} style={{ background: BG, border: `1px solid ${ce.bias === "bullish" ? GREEN : ce.bias === "bearish" ? RED : YELLOW}30`, padding: "6px 10px", display: "flex", alignItems: "center", gap: 6 }}>
                          <Badge color={ce.bias === "bullish" ? GREEN : ce.bias === "bearish" ? RED : YELLOW}>{ce.bias}</Badge>
                          <T c={WHITE} s={10}>{ce.event}</T>
                          <T c={MUTED} s={9}>{ce.timing}</T>
                        </div>
                      ))}
                    </div>
                  ) : <T c={MUTED} s={10}>No near-term catalysts identified</T>}
                </Panel>
              ))}
            </div>
          </div>
        )}

        {tab === "verdict" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <T c={MAGENTA} s={11} w={600}>INVESTMENT COMMITTEE FINAL VERDICT</T>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              {[
                [data.best_act_now, GREEN, "BEST TO ACT ON NOW", "▸"],
                [data.best_watchlist, CYAN, "BEST WATCHLIST CANDIDATE", "◉"],
                [data.false_positive, RED, "MOST DANGEROUS FALSE POSITIVE", "⚠"],
              ].map(([item, c, title, icon]) => item && (
                <div key={title} style={{ background: BG2, border: `1px solid ${c}40`, padding: 20, position: "relative" }}>
                  <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: c }} />
                  <T c={c} s={9} w={600}>{title}</T>
                  <div style={{ marginTop: 8 }}><T c={WHITE} s={22} w={700}>{icon} {item.ticker}</T></div>
                  <div style={{ marginTop: 8 }}><T c={MUTED} s={11} mono={false}>{item.reason}</T></div>
                </div>
              ))}
            </div>
            <T c={MAGENTA} s={11} w={600}>FULL ACTIONABILITY RANKING</T>
            {sorted.map((s, i) => (
              <div key={s.ticker} onClick={() => setSel(s)} style={{ display: "flex", alignItems: "center", gap: 16, padding: "14px 20px", background: i === 0 ? GREEN + "08" : "transparent", borderBottom: `1px solid ${BORDER}`, cursor: "pointer" }}>
                <T c={i === 0 ? GREEN : i === 1 ? CYAN : i === 2 ? YELLOW : MUTED} s={18} w={700} style={{ width: 36 }}>#{i + 1}</T>
                <div style={{ flex: "0 0 65px" }}><T c={WHITE} s={15} w={700}>{s.ticker}</T></div>
                <div style={{ flex: 1 }}><div style={{ height: 12, background: BORDER, borderRadius: 1 }}><div style={{ height: "100%", width: `${s.final_actionability}%`, background: `linear-gradient(90deg,${sColor(s.final_actionability)}60,${sColor(s.final_actionability)})`, borderRadius: 1 }} /></div></div>
                <T c={sColor(s.final_actionability)} s={18} w={700} style={{ width: 50, textAlign: "right" }}>{s.final_actionability}</T>
                <div style={{ width: 80 }}><Badge color={stColor(s.alert_state)}>{s.alert_state}</Badge></div>
                <div style={{ width: 70 }}><Badge color={eColor(s.entry_quality)}>{s.entry_quality}</Badge></div>
                <T c={s.actionable_now ? GREEN : MUTED} s={10} w={600} style={{ width: 30 }}>{s.actionable_now ? "YES" : "—"}</T>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── MAIN APP ──
export default function SectorAlphaEngine() {
  const [phase, setPhase] = useState("config");
  const [sector, setSector] = useState("");
  const [industry, setIndustry] = useState("");
  const [geo, setGeo] = useState("United States");
  const [mcap, setMcap] = useState("All");
  const [style, setStyle] = useState("Quality");
  const [risk, setRisk] = useState("Moderate");
  const [horizon, setHorizon] = useState("12 months");
  const [tradeHorizon, setTradeHorizon] = useState("3-6 months");
  const [progress, setProgress] = useState(0);
  const [primaryData, setPrimaryData] = useState(null);
  const [secondaryData, setSecondaryData] = useState(null);
  const [error, setError] = useState(null);
  const [activeModule, setActiveModule] = useState(1);
  const [archive, setArchive] = useState([]);
  const [archiveLoading, setArchiveLoading] = useState(true);

  const industries = SECTORS.find(s => s.label === sector)?.industries || [];

  // ── Archive persistence ──
  useEffect(() => { loadArchive(); }, []);

  async function loadArchive() {
    setArchiveLoading(true);
    try {
      const res = await window.storage.get("sector-alpha-archive");
      if (res && res.value) setArchive(JSON.parse(res.value));
    } catch (_) { }
    setArchiveLoading(false);
  }

  async function saveToArchive(primary, secondary, params) {
    const entry = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      timestamp: new Date().toISOString(),
      params: { sector: params.sector, industry: params.industry, geo: params.geo, mcap: params.mcap, style: params.style, risk: params.risk, horizon: params.horizon, tradeHorizon: params.tradeHorizon },
      primaryData: primary,
      secondaryData: secondary || null,
      winner: primary.winner_ticker,
      score: primary.competitors?.find(c => c.ticker === primary.winner_ticker)?.ownership_score || primary.competitors?.find(c => c.ticker === primary.winner_ticker)?.weighted_score,
    };
    const updated = [entry, ...archive];
    setArchive(updated);
    try { await window.storage.set("sector-alpha-archive", JSON.stringify(updated)); } catch (_) { }
    return entry.id;
  }

  async function updateArchiveSecondary(id, secData) {
    const updated = archive.map(a => a.id === id ? { ...a, secondaryData: secData, actNow: secData?.best_act_now?.ticker } : a);
    setArchive(updated);
    try { await window.storage.set("sector-alpha-archive", JSON.stringify(updated)); } catch (_) { }
  }

  async function deleteArchiveEntry(id) {
    const updated = archive.filter(a => a.id !== id);
    setArchive(updated);
    try { await window.storage.set("sector-alpha-archive", JSON.stringify(updated)); } catch (_) { }
  }

  async function clearArchive() {
    setArchive([]);
    try { await window.storage.set("sector-alpha-archive", JSON.stringify([])); } catch (_) { }
  }

  function loadFromArchive(entry) {
    setPrimaryData(entry.primaryData);
    setSecondaryData(entry.secondaryData || null);
    setActiveModule(entry.secondaryData ? 2 : 1);
    setSector(entry.params.sector);
    setIndustry(entry.params.industry || "");
    setGeo(entry.params.geo);
    setMcap(entry.params.mcap);
    setStyle(entry.params.style);
    setRisk(entry.params.risk);
    setHorizon(entry.params.horizon);
    setTradeHorizon(entry.params.tradeHorizon);
    setCurrentArchiveId(entry.id);
    setPhase(entry.secondaryData ? "secondary" : "primary");
  }

  const [currentArchiveId, setCurrentArchiveId] = useState(null);

  function goHome() {
    setPhase("config");
    setPrimaryData(null);
    setSecondaryData(null);
    setActiveModule(1);
    setCurrentArchiveId(null);
    setError(null);
  }

  function startProgress() {
    let p = 0;
    setProgress(0);
    const iv = setInterval(() => {
      p += Math.random() * 8;
      if (p >= 90) { clearInterval(iv); setProgress(90); }
      else setProgress(p);
    }, 600);
    return iv;
  }

  const runPrimary = async () => {
    setPhase("loading1"); setError(null);
    const iv = startProgress();
    let lastErr;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const result = await callClaude(buildPrimaryPrompt({ sector, industry, geo, mcap, style, risk, horizon }));
        clearInterval(iv); setProgress(100);
        setPrimaryData(result);
        setSecondaryData(null);
        const id = await saveToArchive(result, null, { sector, industry, geo, mcap, style, risk, horizon, tradeHorizon });
        setCurrentArchiveId(id);
        setTimeout(() => { setPhase("primary"); setActiveModule(1); }, 500);
        return;
      } catch (err) { lastErr = err; }
    }
    clearInterval(iv); setError("Analysis failed after retries: " + lastErr.message); setPhase("config");
  };

  const runSecondary = async () => {
    setPhase("loading2"); setError(null);
    const iv = startProgress();
    let lastErr;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const result = await callClaude(buildSecondaryPrompt(primaryData, { sector, industry, risk, tradeHorizon }));
        clearInterval(iv); setProgress(100);
        setSecondaryData(result);
        if (currentArchiveId) await updateArchiveSecondary(currentArchiveId, result);
        setTimeout(() => { setPhase("secondary"); setActiveModule(2); }, 500);
        return;
      } catch (err) { lastErr = err; }
    }
    clearInterval(iv); setError("Trade readiness failed after retries: " + lastErr.message); setPhase("primary");
  };

  const ll1 = ["INITIALIZING SECTOR ALPHA ENGINE v4.2.1...", "CONNECTING TO MARKET DATA FEEDS...", "LOADING COMPETITIVE INTELLIGENCE MODULE...", "SCANNING INSTITUTIONAL 13F FILINGS...", "BUILDING MOAT DURABILITY MATRIX...", "RUNNING PORTER'S FIVE FORCES ANALYSIS...", "COMPUTING WEIGHTED INVESTMENT SCORES...", "CROSS-REFERENCING MANAGEMENT QUALITY DB...", "AGGREGATING SMART MONEY POSITIONING...", "GENERATING FINAL RANKINGS...", "COMPILING INVESTMENT COMMITTEE BRIEF..."];
  const ll2 = ["LOADING TRADE READINESS MODULE v2.1.0...", "PULLING REAL-TIME PRICE ACTION DATA...", "ANALYZING VOLUME STRUCTURE & TAPE...", "SCANNING INSTITUTIONAL ACCUMULATION SIGNALS...", "MAPPING CATALYST PROXIMITY WINDOWS...", "EVALUATING BREAKOUT CONFIRMATION PATTERNS...", "COMPUTING RISK PENALTY MATRIX...", "RUNNING ALERT-STATE CLASSIFICATION...", "SCORING ACTIONABILITY VECTORS...", "GENERATING FINAL TRADE READINESS BRIEF..."];

  const sub = phase === "config" ? "Sector Ownership Analysis & Equity Selection" : `${sector}${industry && industry !== "All" ? ` — ${industry}` : ""}`;

  function fmtDate(iso) {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }) + " " + d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
  }

  const BackButton = () => (
    <div onClick={goHome} style={{ padding: "5px 14px", cursor: "pointer", border: `1px solid ${AMBER}50`, background: AMBER + "12", display: "flex", alignItems: "center", gap: 6 }}>
      <T c={AMBER} s={10} w={600}>◂ MAIN MENU</T>
    </div>
  );

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: BG, color: WHITE, position: "relative", overflow: "hidden" }}>
      <ScanLine />
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600;700&family=IBM+Plex+Sans:wght@300;400;500;600;700&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:6px}::-webkit-scrollbar-track{background:${BG}}::-webkit-scrollbar-thumb{background:${BORDER};border-radius:3px}::-webkit-scrollbar-thumb:hover{background:${MUTED}}
        select option{background:${BG};color:${WHITE}}
      `}</style>

      <HeaderBar title="SECTOR ALPHA ENGINE" subtitle={sub} rightContent={
        (phase === "primary" || phase === "secondary") ? (
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <BackButton />
            <div style={{ display: "flex", gap: 2 }}>
              <div onClick={() => { setPhase("primary"); setActiveModule(1); }} style={{ padding: "4px 12px", cursor: "pointer", background: activeModule === 1 ? AMBER + "20" : "transparent", border: `1px solid ${activeModule === 1 ? AMBER + "60" : BORDER}` }}>
                <T c={activeModule === 1 ? AMBER : MUTED} s={9} w={600}>MODULE 1</T>
              </div>
              {secondaryData && (
                <div onClick={() => { setPhase("secondary"); setActiveModule(2); }} style={{ padding: "4px 12px", cursor: "pointer", background: activeModule === 2 ? MAGENTA + "20" : "transparent", border: `1px solid ${activeModule === 2 ? MAGENTA + "60" : BORDER}` }}>
                  <T c={activeModule === 2 ? MAGENTA : MUTED} s={9} w={600}>MODULE 2</T>
                </div>
              )}
            </div>
          </div>
        ) : null
      } />

      {phase === "config" && (
        <div style={{ flex: 1, overflow: "auto", padding: 30 }}>
          <div style={{ maxWidth: 780, margin: "0 auto" }}>
            <div style={{ textAlign: "center", marginBottom: 30 }}>
              <T c={AMBER} s={20} w={700}>CONFIGURE ANALYSIS</T>
              <div style={{ marginTop: 4 }}><T c={MUTED} s={11}>Define sector parameters and investment preferences</T></div>
              <div style={{ marginTop: 10, display: "flex", justifyContent: "center", gap: 8 }}>
                <Badge color={CYAN}>S&P 500</Badge><Badge color={CYAN}>NASDAQ</Badge><Badge color={CYAN}>DOW JONES</Badge>
              </div>
            </div>
            {error && <div style={{ background: RED + "15", border: `1px solid ${RED}40`, padding: 12, marginBottom: 16 }}><T c={RED} s={11}>{error}</T></div>}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, background: BG2, border: `1px solid ${BORDER}`, padding: 24 }}>
              <SelectField label="Sector" value={sector} onChange={v => { setSector(v); setIndustry(""); }} options={SECTORS} />
              <SelectField label="Industry (optional)" value={industry} onChange={setIndustry} options={["All", ...industries]} disabled={!sector} />
              <SelectField label="Geography" value={geo} onChange={setGeo} options={GEOS} />
              <SelectField label="Market Cap" value={mcap} onChange={setMcap} options={MCAPS} />
              <SelectField label="Investment Style" value={style} onChange={setStyle} options={STYLES} />
              <SelectField label="Risk Profile" value={risk} onChange={setRisk} options={RISKS} />
              <SelectField label="Strategic Horizon" value={horizon} onChange={setHorizon} options={HORIZONS} />
              <SelectField label="Trade Horizon" value={tradeHorizon} onChange={setTradeHorizon} options={TRADE_HORIZONS} />
            </div>
            <div style={{ marginTop: 20, display: "flex", justifyContent: "center" }}>
              <div onClick={sector ? runPrimary : undefined} style={{ background: sector ? `linear-gradient(135deg,${AMBER},${AMBER}CC)` : BORDER, color: sector ? BG : MUTED, padding: "12px 40px", fontFamily: "'JetBrains Mono',monospace", fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", cursor: sector ? "pointer" : "default", textTransform: "uppercase" }}>
                ▸ EXECUTE ANALYSIS
              </div>
            </div>

            {/* ── ARCHIVE SECTION ── */}
            <div style={{ marginTop: 40, borderTop: `1px solid ${BORDER}`, paddingTop: 24 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <T c={AMBER} s={13} w={700}>REPORT ARCHIVE</T>
                  <Badge color={MUTED}>{archive.length} {archive.length === 1 ? "REPORT" : "REPORTS"}</Badge>
                </div>
                {archive.length > 0 && (
                  <div onClick={() => { if (confirm("Clear all archived reports?")) clearArchive(); }} style={{ cursor: "pointer", padding: "3px 10px", border: `1px solid ${RED}40` }}>
                    <T c={RED} s={9} w={600}>CLEAR ALL</T>
                  </div>
                )}
              </div>
              {archiveLoading ? (
                <div style={{ padding: 20, textAlign: "center" }}><T c={MUTED} s={11}>Loading archive...</T></div>
              ) : archive.length === 0 ? (
                <div style={{ padding: 30, textAlign: "center", background: BG2, border: `1px solid ${BORDER}` }}>
                  <T c={MUTED} s={11}>No archived reports yet. Run an analysis to get started.</T>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {archive.map((entry, i) => (
                    <div key={entry.id} style={{ background: BG2, border: `1px solid ${i === 0 ? AMBER + "40" : BORDER}`, padding: "12px 16px", display: "flex", alignItems: "center", gap: 12, position: "relative" }}>
                      {i === 0 && <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: AMBER }} />}
                      <div style={{ flex: "0 0 22px", textAlign: "center" }}>
                        <T c={i === 0 ? AMBER : MUTED} s={12} w={700}>{i + 1}</T>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <T c={WHITE} s={12} w={600}>{entry.params.sector}</T>
                          {entry.params.industry && entry.params.industry !== "All" && <T c={MUTED} s={10}>/ {entry.params.industry}</T>}
                          <Badge color={AMBER}>{entry.winner}</Badge>
                          {entry.score && <Badge color={sColor(entry.score)}>{entry.score}/100</Badge>}
                          {entry.secondaryData && <Badge color={MAGENTA}>M2</Badge>}
                          {entry.actNow && <Badge color={GREEN}>ACT: {entry.actNow}</Badge>}
                        </div>
                        <div style={{ marginTop: 4, display: "flex", gap: 12, flexWrap: "wrap" }}>
                          <T c={MUTED} s={9}>{fmtDate(entry.timestamp)}</T>
                          <T c={MUTED} s={9}>{entry.params.geo} · {entry.params.mcap} · {entry.params.style}</T>
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                        <div onClick={() => loadFromArchive(entry)} style={{ cursor: "pointer", padding: "5px 12px", border: `1px solid ${CYAN}50`, background: CYAN + "12" }}>
                          <T c={CYAN} s={9} w={600}>OPEN</T>
                        </div>
                        <div onClick={() => deleteArchiveEntry(entry.id)} style={{ cursor: "pointer", padding: "5px 8px", border: `1px solid ${RED}30` }}>
                          <T c={RED} s={9}>✕</T>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {phase === "loading1" && <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}><div style={{ maxWidth: 500, width: "100%" }}><LoadingTerminal progress={progress} lines={ll1} /></div></div>}
      {phase === "loading2" && <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}><div style={{ maxWidth: 500, width: "100%" }}><LoadingTerminal progress={progress} lines={ll2} /></div></div>}

      {phase === "primary" && primaryData && (
        <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <PrimaryResults data={primaryData} onRunSecondary={runSecondary} />
        </div>
      )}

      {phase === "secondary" && secondaryData && (
        <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <SecondaryResults data={secondaryData} />
        </div>
      )}

      <div style={{ borderTop: `1px solid ${BORDER}`, padding: "6px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", background: BG2, flexShrink: 0 }}>
        <div style={{ display: "flex", gap: 16 }}>
          {primaryData && <T c={MUTED} s={9}>WINNER: <span style={{ color: AMBER }}>{primaryData.winner_ticker}</span></T>}
          {secondaryData && <T c={MUTED} s={9}>ACT NOW: <span style={{ color: GREEN }}>{secondaryData.best_act_now?.ticker}</span></T>}
          {secondaryData && <T c={MUTED} s={9}>POSTURE: <span style={{ color: CYAN }}>{secondaryData.overall_posture}</span></T>}
          {phase === "config" && archive.length > 0 && <T c={MUTED} s={9}>ARCHIVED: <span style={{ color: AMBER }}>{archive.length}</span></T>}
        </div>
        {phase !== "config" && phase !== "loading1" && phase !== "loading2" && (
          <div onClick={goHome} style={{ cursor: "pointer", padding: "4px 12px", border: `1px solid ${BORDER}` }}>
            <T c={MUTED} s={9}>◂ MAIN MENU</T>
          </div>
        )}
      </div>
    </div>
  );
}
