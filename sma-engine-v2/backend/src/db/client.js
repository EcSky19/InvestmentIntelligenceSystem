'use strict';
const { Pool } = require('pg');
const config   = require('../config');
const logger   = require('../logger');

const pool = new Pool(
  config.db.connectionString
    ? { connectionString: config.db.connectionString }
    : {
        host:     config.db.host,
        port:     config.db.port,
        database: config.db.database,
        user:     config.db.user,
        password: config.db.password,
        max:      config.db.max,
        idleTimeoutMillis:     config.db.idleTimeoutMillis,
        connectionTimeoutMillis: config.db.connectionTimeoutMillis,
      }
);

pool.on('error', (err) => {
  logger.error('Unexpected DB pool error', { error: err.message });
});

// Convenience wrappers
const db = {
  query:  (text, params) => pool.query(text, params),
  client: () => pool.connect(),

  // Transaction helper
  async transaction(fn) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  async testConnection() {
    const { rows } = await pool.query('SELECT NOW() AS now, current_database() AS db');
    return rows[0];
  },
};

module.exports = db;
