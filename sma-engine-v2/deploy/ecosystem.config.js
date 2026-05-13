// PM2 Ecosystem Config — 50-Day SMA Crossing Engine
// Usage: pm2 start deploy/ecosystem.config.js
// Logs:  pm2 logs sma-engine
// Save:  pm2 save && pm2 startup (to survive reboots)

module.exports = {
  apps: [
    {
      name:          'sma-engine',
      script:        './backend/src/server.js',
      cwd:           '/opt/sma-engine',
      instances:     1,        // Single instance — DB has state (no need for cluster)
      exec_mode:     'fork',
      node_args:     '--max-old-space-size=512',

      // Env
      env_production: {
      NODE_ENV: 'production',
      TZ: 'America/New_York',
      },

      // Restart behavior
      autorestart:   true,
      restart_delay: 5000,     // 5s delay between restarts
      max_restarts:  10,
      min_uptime:    '10s',

      // Memory limit — restart if over 400 MB (scans can be memory-intensive)
      max_memory_restart: '400M',

      // Logs
      out_file:      '/opt/sma-engine/backend/logs/pm2-out.log',
      error_file:    '/opt/sma-engine/backend/logs/pm2-err.log',
      merge_logs:    true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      log_type:      'json',

      // Watch (off in production)
      watch:         false,

      // Graceful shutdown — allow 15s for active scans to finish
      kill_timeout:  15000,
      listen_timeout: 8000,
      shutdown_with_message: false,

      // Environment file
      env_file:      '/opt/sma-engine/backend/.env',
    }
  ],

  // ── DEPLOY CONFIG (optional, for pm2 deploy) ─────────────────────────────
  deploy: {
    production: {
      user:         'smaengine',
      host:         'YOUR_VPS_IP',
      ref:          'origin/main',
      repo:         'git@github.com:YOUR_USERNAME/sma-engine.git',
      path:         '/opt/sma-engine',
      'pre-deploy-local': '',
      'post-deploy': [
        'cd backend && npm install --production',
        'npm run db:migrate',
        'cd ../frontend && npm install && npm run build',
        'pm2 reload ecosystem.config.js --env production',
        'pm2 save'
      ].join(' && '),
      'pre-setup':  'apt-get install -y git',
    }
  }
};
