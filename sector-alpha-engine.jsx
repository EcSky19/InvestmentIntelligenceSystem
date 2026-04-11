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