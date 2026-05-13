'use strict';
require('dotenv').config();

module.exports = {
  port:        parseInt(process.env.PORT || '3001'),
  nodeEnv:     process.env.NODE_ENV || 'development',
  authKey:     process.env.AUTH_KEY || '',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',

  db: {
    connectionString: process.env.DATABASE_URL,
    host:     process.env.DB_HOST || 'localhost',
    port:     parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'smaengine',
    user:     process.env.DB_USER || 'smaengine',
    password: process.env.DB_PASSWORD || '',
    max:      20,        // connection pool max
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  },

  polygon: {
    apiKey:  process.env.POLYGON_API_KEY || '',
    baseUrl: process.env.POLYGON_BASE_URL || 'https://api.polygon.io',
  },

  email: {
    resendKey: process.env.RESEND_API_KEY || '',
    from:      process.env.EMAIL_FROM || 'alerts@localhost',
    to:        (process.env.EMAIL_TO || '').split(',').map(s => s.trim()).filter(Boolean),
  },

  scan: {
    defaultTier:        process.env.DEFAULT_TIER || 'T1',
    defaultBatchSize:   parseInt(process.env.DEFAULT_BATCH_SIZE || '50'),
    batchDelayMs:       parseInt(process.env.DEFAULT_BATCH_DELAY_MS || '120'),
    lookbackDays:       120,   // days of OHLCV history to fetch
    liquidity: {
      minPrice:       parseFloat(process.env.LIQ_MIN_PRICE || '2'),
      minAvgVol:      parseInt(process.env.LIQ_MIN_AVG_VOL || '250000'),
      minDollarVol:   parseInt(process.env.LIQ_MIN_DOLLAR_VOL || '5000000'),
      minHistoryDays: parseInt(process.env.LIQ_MIN_HISTORY_DAYS || '60'),
    },
  },

  scheduler: {
    enabled: process.env.SCHEDULER_ENABLED === 'true',
    tz: process.env.TZ || 'America/New_York',
  },

  followthrough: {
    checkDays: [1, 3, 5, 10, 20],  // follow-up intervals in trading days
  },
};
