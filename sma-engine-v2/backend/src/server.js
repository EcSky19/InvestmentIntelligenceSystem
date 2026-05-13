'use strict';
require('dotenv').config();
const express      = require('express');
const cors         = require('cors');
const helmet       = require('helmet');
const rateLimit    = require('express-rate-limit');
const fs           = require('fs');
const path         = require('path');
const config       = require('./config');
const logger       = require('./logger');
const db           = require('./db/client');
const routes       = require('./api/routes');
const scheduler    = require('./scheduler/index');
const { loadWeightsFromDB } = require('./scheduler/performance');

// Ensure log directory exists
const logDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });

const app = express();

// ── MIDDLEWARE ────────────────────────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));

app.use(cors({
  origin: [
    config.frontendUrl,
    'http://localhost:5173',  // Vite dev server
    'http://localhost:3000',
  ],
  credentials: true,
  methods: ['GET','POST','PATCH','DELETE','OPTIONS'],
}));

app.use(express.json({ limit: '2mb' }));

// Rate limiter — 200 requests per 15 minutes per IP
app.use('/api', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { error: 'Too many requests, please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
}));

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    if (req.path !== '/api/health') {
      logger.info(`${req.method} ${req.path} ${res.statusCode} ${ms}ms`);
    }
  });
  next();
});

// ── ROUTES ────────────────────────────────────────────────────────────────────
app.use('/api', routes);

// Serve frontend build (production)
const frontendDist = path.join(__dirname, '../../frontend/dist');
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get('*', (req, res) => {
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
} else {
  app.get('/', (req, res) => {
    res.json({ message: '50-Day SMA Crossing Engine API', version: '2.0.0' });
  });
}

// 404
app.use((req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

// Global error handler
app.use((err, req, res, next) => {
  logger.error('Unhandled error', { error: err.message, stack: err.stack });
  res.status(500).json({ error: 'Internal Server Error', message: err.message });
});

// ── STARTUP ───────────────────────────────────────────────────────────────────
async function start() {
  // Test database connection
  try {
    const info = await db.testConnection();
    logger.info('Database connected', { db: info.db, time: info.now });
  } catch (err) {
    logger.error('Database connection failed', { error: err.message });
    logger.error('Make sure PostgreSQL is running and DATABASE_URL is correct');
    logger.error('Run: psql $DATABASE_URL -f src/db/schema.sql to initialize the schema');
    process.exit(1);
  }

  // Load calibrated score weights from DB
  await loadWeightsFromDB();

  // Start scheduler
  scheduler.start();

  // Start HTTP server
  const server = app.listen(config.port, () => {
    logger.info(`SMA Engine API running on port ${config.port}`, {
      env:       config.nodeEnv,
      scheduler: config.scheduler.enabled,
      email:     !!config.email.resendKey,
    });
  });

  // Graceful shutdown
  const shutdown = async (signal) => {
    logger.info(`${signal} received — shutting down gracefully`);
    scheduler.stop();
    server.close(() => {
      logger.info('HTTP server closed');
      process.exit(0);
    });
    setTimeout(() => { logger.warn('Forced shutdown'); process.exit(1); }, 15000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT',  () => shutdown('SIGINT'));
  process.on('uncaughtException',  (err) => { logger.error('Uncaught exception',  { error: err.message }); });
  process.on('unhandledRejection', (err) => { logger.error('Unhandled rejection', { error: err?.message || err }); });
}

start();
