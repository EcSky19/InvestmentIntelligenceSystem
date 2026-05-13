'use strict';
const config  = require('../config');
const fetcher = require('./fetcher');
const logger  = require('../logger');

// ─── TIER DEFINITIONS ────────────────────────────────────────────────────────
const TIER_INFO = {
  T1: { label: 'S&P 500 Core',                    approx: 503,  estMinutes: '1–2'   },
  T2: { label: 'S&P 500 + Nasdaq 100 + NYSE 100', approx: 650,  estMinutes: '2–4'   },
  T3: { label: 'Liquid US Equities',              approx: 900,  estMinutes: '8–15'  },
  T4: { label: 'Full Nasdaq + NYSE',              approx: 1000, estMinutes: '20–35' },
};

// ─── S&P 500 ─────────────────────────────────────────────────────────────────
const SP500 = [
  'AAPL','MSFT','NVDA','AMZN','GOOGL','META','TSLA','BRK.B','JPM','LLY',
  'V','UNH','XOM','MA','JNJ','AVGO','PG','HD','COST','ABBV','MRK','AMD',
  'ORCL','CVX','WMT','BAC','KO','NFLX','PEP','TMO','CRM','CSCO','ACN','ABT',
  'WFC','LIN','IBM','PM','NOW','MS','GS','MCD','INTU','AMAT','TXN','AMGN',
  'ISRG','QCOM','RTX','SPGI','BKNG','CAT','BLK','GILD','PFE','ADBE','LOW',
  'PANW','MU','LRCX','ETN','CB','UPS','DE','KLAC','MDT','SYK','MMM','GE',
  'NEE','REGN','AMT','ADI','SNPS','CDNS','ABNB','SBUX','PLD','AXP','CEG',
  'CRWD','MRVL','MSI','DELL','HPQ','INTC','F','GM','T','VZ','DIS','CMCSA',
  'CVS','CI','HUM','PNC','USB','C','SCHW','PYPL','ANET','FTNT','ADSK',
  'NKE','TGT','TJX','CMG','DHR','BSX','VRTX','BIIB','MRNA','LMT','NOC',
  'BA','HON','EMR','FCX','NEM','OXY','COP','SLB','MPC','PSX','O','SPG',
  'AME','CTAS','PAYX','WM','RSG','EW','ZTS','IDXX','DXCM','FICO','ROP',
  'VRSK','MPWR','ANSS','FSLR','PCG','AEP','DUK','SO','D','ED','EXC',
  'XEL','AWK','PPL','NI','AES','FE','ETR','WEC','DTE','AEE','PEG',
  'MTB','KEY','RF','CFG','HBAN','FITB','HIG','ALL','PGR','TRV','L',
  'MCO','ICE','CME','CBOE','HAL','DVN','EOG','FANG','HES','MRO',
  'NUE','STLD','LYB','DOW','EMN','CE','IFF','IP','PKG','UBER','SHOP',
  'PLTR','SNOW','DDOG','NET','ZS','WDAY','TEAM','TTD','APP','RBLX',
  'COIN','SOFI','RIVN','LULU','MDLZ','SYF','COF','ALLY',
];

// ─── NASDAQ 100 ───────────────────────────────────────────────────────────────
const NASDAQ100 = [
  'AAPL','MSFT','NVDA','AMZN','GOOGL','META','TSLA','AVGO','COST','NFLX',
  'AMD','INTU','CSCO','AMAT','TXN','AMGN','ISRG','QCOM','BKNG','ADI',
  'SNPS','CDNS','KLAC','PANW','LRCX','MU','MRVL','ADBE','CRWD','CEG',
  'SBUX','MELI','ABNB','PYPL','WDAY','DDOG','FTNT','ADSK','KDP','BIIB',
  'VRTX','MRNA','REGN','GILD','IDXX','DXCM','ZS','TEAM','TTD','CTAS',
  'PAYX','ROST','ODFL','MNST','FAST','VRSK','CPRT','ANSS','DLTR','CTSH',
  'ILMN','NXPI','MCHP','SWKS','WBA','CMCSA','HON','PEP','LIN','LULU',
  'ON','ARM','SMCI','APP','HOOD','PCAR','AZN','MELI',
];

// ─── NYSE 100 ─────────────────────────────────────────────────────────────────
const NYSE100 = [
  'BRK.B','JPM','LLY','V','UNH','XOM','MA','JNJ','PG','HD','WMT','BAC',
  'KO','CVX','MRK','ORCL','ACN','ABT','WFC','IBM','PM','NOW','MS','GS',
  'MCD','CAT','BLK','UPS','DE','ETN','CB','MDT','SYK','MMM','GE','NEE',
  'AMT','PLD','AXP','LOW','NKE','TGT','TJX','CMG','DHR','BSX','LMT',
  'NOC','BA','HON','EMR','FCX','NEM','OXY','COP','SLB','O','SPG','RTX',
  'SPGI','TMO','ABBV','PFE','CVS','CI','HUM','PNC','USB','C','SCHW',
  'ANET','DELL','HPQ','F','GM','T','VZ','DIS','UBER','SNOW','PLTR',
  'NET','SHOP','SQ','RBLX','SPOT','COIN','HOOD',
];

// ─── T3 EXTENDED UNIVERSE ────────────────────────────────────────────────────
const T3_EXTENDED = [
  // SaaS / Cloud
  'ZM','DOCU','BOX','ASAN','MNDY','SMAR','BRZE','BILL','HUBS','GTLB',
  'ESTC','PSTG','NTAP','STX','WDC','NTNX','CFLT','CTSH','EPAM','GLOB',
  'VEEV','CDAY','PCTY','PAYC','JAMF','MANH','TWLO','OKTA','MDB',
  // Cybersecurity
  'TENB','QLYS','RPD','CYBR','CHKP','VRNT','MIME','S',
  // Semiconductors
  'ONTO','ACLS','FORM','COHU','AMBA','WOLF','ALGM','CRUS','SLAB','MTSI',
  'QRVO','SWKS','POWI','DIOD','MKSI','AEHR','ICHR','NXPI','MCHP',
  // FinTech / Finance
  'SYF','DFS','NU','UPST','LC','AFRM','MKTX','VIRT','LPLA','RJF',
  'STEP','EVR','LAZ','GCMG',
  // Healthcare Biotech
  'JAZZ','EXEL','ALKS','ACAD','SAGE','NBIX','HOLX','ALGN','HSIC',
  'NTRA','VCYT','EXAS','IONS','ARVN','RVMD','BEAM','EDIT','NTLA',
  'CRSP','ARWR','PTCT','MDGL','VKTX','RXRX','FOLD','PRGO','VTRS',
  'AUPH','BBIO','BCRX','BHVN','BPMC','INSM','LEGN','TGTX',
  // Devices / Health Services
  'OMCL','NXGN','HMSY','AMED','MMSI','ICUI','LMAT','PODD','NVST',
  // Consumer
  'DKNG','PENN','CHWY','CROX','ONON','SKX','DECK','UAA','LEVI','PVH',
  'HBI','CPRI','TPR','BOOT','CVNA','KMX','AN','LAD',
  // Consumer Staples
  'POST','USFD','SFM','PFGC','ULTA','ELF','JJSF','TSN',
  // Energy
  'RIG','NBR','HP','PTEN','OII','WMB','OKE','KMI','EPD','ET',
  'TRGP','MPLX','DVN','SM','MTDR','VTLE','CTRA',
  // Industrials
  'GXO','XPO','ARCB','HTLD','ZIM','DAC','SFL','TREX','APOG','AAON',
  'SPXC','ENS','PWR','EME','TTEK','MTZ',
  // Real Estate
  'INVH','AMH','UDR','CPT','AVB','ESS','MAA','NNN','ADC','VICI',
  'GLPI','IRM','CUBE','EXR','NSA','REXR','FR','EGP','STAG',
  // Utilities
  'OGE','PNM','MGEE','AVA','IDACORP','BKH','SJW',
  // Materials
  'MP','ARNC','GEF','GPK','BERY','CENX',
  // Regional Banks
  'WAL','WTFC','TCBI','GBCI','UMBF','BOH','WAFD','BANR','SBCF',
  'CVBF','PPBI','BANF','FFIN','HOMB','PB','FULT','WSBC','UBSI',
  'BRKL','NYCB','TRMK','CATY','HOPE','HTBK','TBBK','HTLF',
  // BDCs / Alt Finance
  'ARCC','PFLT','CSWC','TRIN','MAIN','GAIN','NEWT','STWD','BXMT','RITM',
];

// ─── T4 EXTRA ────────────────────────────────────────────────────────────────
const T4_EXTRA = [
  'GEVO','ENPH','SEDG','RUN','NOVA','ARRY','CSIQ','JKS','DAQO',
  'BURL','FIVE','OLLI','TXRH','EAT','JACK','QSR','YUM','DPZ','WEN',
  'SHAK','WING','PLNT','XPOF','WSM','LESL','SSD','BLDR','IBP','BECN',
  'GMS','UFP','SUM','EXP','VMC','MLM','CRH','ROCK','STRL','WIX',
  'ACGL','ERIE','AFG','KMPR','HCI','OXLC','EFC','HRZN','OCSL','PSEC',
  'SLRC','FDUS','GSKY','UPST','LC','SOFI','NU','OPFI',
];

const T2_TICKERS = [...new Set([...SP500, ...NASDAQ100, ...NYSE100])];
const T3_TICKERS = [...new Set([...T2_TICKERS, ...T3_EXTENDED])];
const T4_TICKERS = [...new Set([...T3_TICKERS, ...T4_EXTRA])];

// ─── METADATA MAP ────────────────────────────────────────────────────────────
const META = {
  AAPL:{c:'Apple Inc.',e:'NASDAQ',s:'Technology',i:'Hardware'},
  MSFT:{c:'Microsoft Corp.',e:'NASDAQ',s:'Technology',i:'Software'},
  NVDA:{c:'NVIDIA Corp.',e:'NASDAQ',s:'Technology',i:'Semiconductors'},
  AMZN:{c:'Amazon.com Inc.',e:'NASDAQ',s:'Consumer Discretionary',i:'Internet'},
  GOOGL:{c:'Alphabet Inc.',e:'NASDAQ',s:'Communication Services',i:'Internet'},
  META:{c:'Meta Platforms',e:'NASDAQ',s:'Communication Services',i:'Internet'},
  TSLA:{c:'Tesla Inc.',e:'NASDAQ',s:'Consumer Discretionary',i:'Auto'},
  'BRK.B':{c:'Berkshire Hathaway',e:'NYSE',s:'Financials',i:'Asset Management'},
  JPM:{c:'JPMorgan Chase',e:'NYSE',s:'Financials',i:'Banks'},
  LLY:{c:'Eli Lilly',e:'NYSE',s:'Healthcare',i:'Pharmaceuticals'},
  V:{c:'Visa Inc.',e:'NYSE',s:'Financials',i:'FinTech'},
  UNH:{c:'UnitedHealth Group',e:'NYSE',s:'Healthcare',i:'Medical Devices'},
  XOM:{c:'Exxon Mobil',e:'NYSE',s:'Energy',i:'Energy Exploration'},
  MA:{c:'Mastercard Inc.',e:'NYSE',s:'Financials',i:'FinTech'},
  JNJ:{c:'Johnson & Johnson',e:'NYSE',s:'Healthcare',i:'Pharmaceuticals'},
  AVGO:{c:'Broadcom Inc.',e:'NASDAQ',s:'Technology',i:'Semiconductors'},
  PG:{c:'Procter & Gamble',e:'NYSE',s:'Consumer Staples',i:'Consumer Brands'},
  HD:{c:'Home Depot',e:'NYSE',s:'Consumer Discretionary',i:'Retail'},
  COST:{c:'Costco Wholesale',e:'NASDAQ',s:'Consumer Staples',i:'Retail'},
  ABBV:{c:'AbbVie Inc.',e:'NYSE',s:'Healthcare',i:'Pharmaceuticals'},
  MRK:{c:'Merck & Co.',e:'NYSE',s:'Healthcare',i:'Pharmaceuticals'},
  AMD:{c:'Advanced Micro Devices',e:'NASDAQ',s:'Technology',i:'Semiconductors'},
  ORCL:{c:'Oracle Corp.',e:'NYSE',s:'Technology',i:'Software'},
  CVX:{c:'Chevron Corp.',e:'NYSE',s:'Energy',i:'Energy Exploration'},
  WMT:{c:'Walmart Inc.',e:'NYSE',s:'Consumer Staples',i:'Retail'},
  BAC:{c:'Bank of America',e:'NYSE',s:'Financials',i:'Banks'},
  KO:{c:'Coca-Cola Co.',e:'NYSE',s:'Consumer Staples',i:'Consumer Brands'},
  NFLX:{c:'Netflix Inc.',e:'NASDAQ',s:'Communication Services',i:'Internet'},
  PEP:{c:'PepsiCo Inc.',e:'NASDAQ',s:'Consumer Staples',i:'Consumer Brands'},
  TMO:{c:'Thermo Fisher',e:'NYSE',s:'Healthcare',i:'Medical Devices'},
  CRM:{c:'Salesforce Inc.',e:'NYSE',s:'Technology',i:'Software'},
  CSCO:{c:'Cisco Systems',e:'NASDAQ',s:'Technology',i:'Hardware'},
  ACN:{c:'Accenture PLC',e:'NYSE',s:'Technology',i:'Software'},
  ABT:{c:'Abbott Labs',e:'NYSE',s:'Healthcare',i:'Medical Devices'},
  WFC:{c:'Wells Fargo',e:'NYSE',s:'Financials',i:'Banks'},
  IBM:{c:'IBM Corp.',e:'NYSE',s:'Technology',i:'Software'},
  NOW:{c:'ServiceNow Inc.',e:'NYSE',s:'Technology',i:'Software'},
  MS:{c:'Morgan Stanley',e:'NYSE',s:'Financials',i:'Asset Management'},
  GS:{c:'Goldman Sachs',e:'NYSE',s:'Financials',i:'Banks'},
  MCD:{c:"McDonald's Corp.",e:'NYSE',s:'Consumer Discretionary',i:'Consumer Brands'},
  INTU:{c:'Intuit Inc.',e:'NASDAQ',s:'Technology',i:'Software'},
  AMAT:{c:'Applied Materials',e:'NASDAQ',s:'Technology',i:'Semiconductors'},
  TXN:{c:'Texas Instruments',e:'NASDAQ',s:'Technology',i:'Semiconductors'},
  AMGN:{c:'Amgen Inc.',e:'NASDAQ',s:'Healthcare',i:'Biotechnology'},
  ISRG:{c:'Intuitive Surgical',e:'NASDAQ',s:'Healthcare',i:'Medical Devices'},
  QCOM:{c:'QUALCOMM Inc.',e:'NASDAQ',s:'Technology',i:'Semiconductors'},
  RTX:{c:'RTX Corp.',e:'NYSE',s:'Industrials',i:'Aerospace & Defense'},
  SPGI:{c:'S&P Global Inc.',e:'NYSE',s:'Financials',i:'Asset Management'},
  BKNG:{c:'Booking Holdings',e:'NASDAQ',s:'Consumer Discretionary',i:'Internet'},
  CAT:{c:'Caterpillar Inc.',e:'NYSE',s:'Industrials',i:'Industrials'},
  BLK:{c:'BlackRock Inc.',e:'NYSE',s:'Financials',i:'Asset Management'},
  GILD:{c:'Gilead Sciences',e:'NASDAQ',s:'Healthcare',i:'Biotechnology'},
  PFE:{c:'Pfizer Inc.',e:'NYSE',s:'Healthcare',i:'Pharmaceuticals'},
  ADBE:{c:'Adobe Inc.',e:'NASDAQ',s:'Technology',i:'Software'},
  LOW:{c:"Lowe's Companies",e:'NYSE',s:'Consumer Discretionary',i:'Retail'},
  PANW:{c:'Palo Alto Networks',e:'NASDAQ',s:'Technology',i:'Cybersecurity'},
  MU:{c:'Micron Technology',e:'NASDAQ',s:'Technology',i:'Semiconductors'},
  LRCX:{c:'Lam Research',e:'NASDAQ',s:'Technology',i:'Semiconductors'},
  CRWD:{c:'CrowdStrike',e:'NASDAQ',s:'Technology',i:'Cybersecurity'},
  MRVL:{c:'Marvell Technology',e:'NASDAQ',s:'Technology',i:'Semiconductors'},
  PLTR:{c:'Palantir Tech.',e:'NYSE',s:'Technology',i:'AI Infrastructure'},
  SNOW:{c:'Snowflake Inc.',e:'NYSE',s:'Technology',i:'Cloud Computing'},
  DDOG:{c:'Datadog Inc.',e:'NASDAQ',s:'Technology',i:'Cloud Computing'},
  NET:{c:'Cloudflare Inc.',e:'NYSE',s:'Technology',i:'Cybersecurity'},
  ZS:{c:'Zscaler Inc.',e:'NASDAQ',s:'Technology',i:'Cybersecurity'},
  WDAY:{c:'Workday Inc.',e:'NASDAQ',s:'Technology',i:'Cloud Computing'},
  APP:{c:'Applovin Corp.',e:'NASDAQ',s:'Technology',i:'Software'},
  COIN:{c:'Coinbase Global',e:'NASDAQ',s:'Financials',i:'FinTech'},
  UBER:{c:'Uber Technologies',e:'NYSE',s:'Consumer Discretionary',i:'Internet'},
  SHOP:{c:'Shopify Inc.',e:'NYSE',s:'Technology',i:'Internet'},
  ARM:{c:'Arm Holdings',e:'NASDAQ',s:'Technology',i:'Semiconductors'},
  SMCI:{c:'Super Micro Computer',e:'NASDAQ',s:'Technology',i:'AI Infrastructure'},
  DELL:{c:'Dell Technologies',e:'NYSE',s:'Technology',i:'Hardware'},
  INTC:{c:'Intel Corp.',e:'NASDAQ',s:'Technology',i:'Semiconductors'},
  F:{c:'Ford Motor Co.',e:'NYSE',s:'Consumer Discretionary',i:'Auto'},
  GM:{c:'General Motors',e:'NYSE',s:'Consumer Discretionary',i:'Auto'},
  T:{c:'AT&T Inc.',e:'NYSE',s:'Communication Services',i:'Other'},
  VZ:{c:'Verizon Comms.',e:'NYSE',s:'Communication Services',i:'Other'},
  DIS:{c:'Walt Disney Co.',e:'NYSE',s:'Communication Services',i:'Other'},
  RBLX:{c:'Roblox Corp.',e:'NYSE',s:'Communication Services',i:'Internet'},
  NKE:{c:'Nike Inc.',e:'NYSE',s:'Consumer Discretionary',i:'Consumer Brands'},
  TGT:{c:'Target Corp.',e:'NYSE',s:'Consumer Discretionary',i:'Retail'},
  CMG:{c:'Chipotle Mexican Grill',e:'NYSE',s:'Consumer Discretionary',i:'Consumer Brands'},
  LMT:{c:'Lockheed Martin',e:'NYSE',s:'Industrials',i:'Aerospace & Defense'},
  NOC:{c:'Northrop Grumman',e:'NYSE',s:'Industrials',i:'Aerospace & Defense'},
  BA:{c:'Boeing Co.',e:'NYSE',s:'Industrials',i:'Aerospace & Defense'},
  HON:{c:'Honeywell Intl.',e:'NASDAQ',s:'Industrials',i:'Industrials'},
  OXY:{c:'Occidental Petro.',e:'NYSE',s:'Energy',i:'Energy Exploration'},
  COP:{c:'ConocoPhillips',e:'NYSE',s:'Energy',i:'Energy Exploration'},
  SLB:{c:'SLB',e:'NYSE',s:'Energy',i:'Energy Exploration'},
  NEE:{c:'NextEra Energy',e:'NYSE',s:'Utilities',i:'Utilities'},
  O:{c:'Realty Income',e:'NYSE',s:'Real Estate',i:'Other'},
  SPG:{c:'Simon Property Group',e:'NYSE',s:'Real Estate',i:'Other'},
};

function getMeta(ticker) {
  return META[ticker] || { c: ticker, e: 'US', s: 'Unknown', i: 'Other' };
}

// ─── LIQUIDITY FILTER ────────────────────────────────────────────────────────
function passesLiquidity(price, avgVol20, liqCfg) {
  const cfg = liqCfg || config.scan.liquidity;
  if (price < (cfg.minPrice || 2)) return false;
  if (!avgVol20 || avgVol20 < (cfg.minAvgVol || 250000)) return false;
  if (avgVol20 * price < (cfg.minDollarVol || 5000000)) return false;
  return true;
}

// ─── RESOLVE UNIVERSE ────────────────────────────────────────────────────────
async function resolveUniverse(tier, onProgress) {
  let base;
  if (tier === 'T1')      base = SP500;
  else if (tier === 'T2') base = T2_TICKERS;
  else if (tier === 'T3') base = T3_TICKERS;
  else                    base = T4_TICKERS;

  if (onProgress) onProgress(`Using ${tier} curated universe: ${base.length} tickers`);

  // Optional: try live API enhancement for T3/T4
  if (tier === 'T3' || tier === 'T4') {
    try {
      if (onProgress) onProgress('Attempting live API ticker enhancement (optional)…');
      const live = await fetcher.fetchFullTickerList(onProgress);
      if (live.length > base.length) {
        const merged = [...new Set([...base, ...live])];
        if (onProgress) onProgress(`Universe extended to ${merged.length} tickers via API`);
        return merged;
      }
    } catch (e) {
      if (e.code === 'AUTH') throw e;
      if (onProgress) onProgress(`API enhancement skipped — using curated ${tier} list`);
      logger.warn('Live universe fetch failed, using curated list', { error: e.message });
    }
  }

  return [...base];
}

module.exports = {
  TIER_INFO,
  SP500, NASDAQ100, NYSE100,
  T2_TICKERS, T3_TICKERS, T4_TICKERS,
  getMeta,
  passesLiquidity,
  resolveUniverse,
};
