'use strict';
const config = require('../config');

function requireAuth(req, res, next) {
  if (!config.authKey) return next(); // no auth configured — open access (dev only)
  const header = req.headers['authorization'] || '';
  const token  = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token || token !== config.authKey) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Invalid or missing Bearer token' });
  }
  next();
}

module.exports = { requireAuth };
