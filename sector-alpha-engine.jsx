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