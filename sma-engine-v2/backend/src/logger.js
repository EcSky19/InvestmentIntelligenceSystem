'use strict';
const { createLogger, format, transports } = require('winston');
const config = require('./config');

const logger = createLogger({
  level: config.nodeEnv === 'production' ? 'info' : 'debug',
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.errors({ stack: true }),
    format.printf(({ timestamp, level, message, ...meta }) => {
      const metaStr = Object.keys(meta).length ? ' ' + JSON.stringify(meta) : '';
      return `${timestamp} [${level.toUpperCase()}] ${message}${metaStr}`;
    })
  ),
  transports: [
    new transports.Console(),
    new transports.File({ filename: 'logs/error.log', level: 'error', maxsize: 5242880, maxFiles: 3 }),
    new transports.File({ filename: 'logs/combined.log', maxsize: 10485760, maxFiles: 5 }),
  ],
});

module.exports = logger;
