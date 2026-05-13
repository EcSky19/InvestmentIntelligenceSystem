#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# 50-Day SMA Crossing Engine — VPS Setup Script
# Tested on: Ubuntu 24.04 LTS (Hetzner CX22 or equivalent)
# Run as root: bash setup.sh
# ═══════════════════════════════════════════════════════════════════════════════
set -euo pipefail

APP_USER="smaengine"
APP_DIR="/opt/sma-engine"
DB_NAME="smaengine"
DB_USER="smaengine"
DB_PASS="$(openssl rand -hex 16)"
NODE_VERSION="20"

echo ""
echo "═══════════════════════════════════════════════════════"
echo "  50-Day SMA Crossing Engine — VPS Setup"
echo "═══════════════════════════════════════════════════════"
echo ""

# ── 1. SYSTEM UPDATE ──────────────────────────────────────────────────────────
echo "→ Updating system packages…"
apt-get update -qq && apt-get upgrade -y -qq
apt-get install -y -qq curl wget git unzip ufw nginx certbot python3-certbot-nginx \
  postgresql postgresql-contrib build-essential gnupg2 lsb-release

# ── 2. NODE.JS ────────────────────────────────────────────────────────────────
echo "→ Installing Node.js ${NODE_VERSION}…"
curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
apt-get install -y nodejs
echo "   Node: $(node --version)  NPM: $(npm --version)"

# ── 3. PM2 ────────────────────────────────────────────────────────────────────
echo "→ Installing PM2…"
npm install -g pm2 --quiet
pm2 install pm2-logrotate --quiet 2>/dev/null || true

# ── 4. APP USER ───────────────────────────────────────────────────────────────
echo "→ Creating app user: ${APP_USER}…"
id "${APP_USER}" &>/dev/null || useradd -m -s /bin/bash "${APP_USER}"
mkdir -p "${APP_DIR}"
chown -R "${APP_USER}:${APP_USER}" "${APP_DIR}"

# ── 5. POSTGRESQL ─────────────────────────────────────────────────────────────
echo "→ Setting up PostgreSQL database…"
systemctl enable --now postgresql

sudo -u postgres psql <<EOF
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${DB_USER}') THEN
    CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASS}';
  END IF;
END
\$\$;
EOF

sudo -u postgres psql -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};" 2>/dev/null || \
  echo "   Database ${DB_NAME} already exists — skipping"

sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};"
sudo -u postgres psql -d "${DB_NAME}" -c "GRANT ALL ON SCHEMA public TO ${DB_USER};"

DB_URL="postgresql://${DB_USER}:${DB_PASS}@localhost:5432/${DB_NAME}"
echo "   Database URL: ${DB_URL}"

# ── 6. FIREWALL ───────────────────────────────────────────────────────────────
echo "→ Configuring UFW firewall…"
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
echo "   UFW enabled — ssh, 80, 443 open"

# ── 7. APP DIRECTORY STRUCTURE ────────────────────────────────────────────────
echo "→ Preparing app directories…"
sudo -u "${APP_USER}" mkdir -p \
  "${APP_DIR}/backend/logs" \
  "${APP_DIR}/frontend/dist" \
  "${APP_DIR}/backups"

# ── 8. ENV FILE ───────────────────────────────────────────────────────────────
AUTH_KEY="$(openssl rand -hex 32)"
ENV_FILE="${APP_DIR}/backend/.env"

cat > "${ENV_FILE}" <<ENVEOF
DATABASE_URL=${DB_URL}
PORT=3001
NODE_ENV=production
AUTH_KEY=${AUTH_KEY}
POLYGON_API_KEY=REPLACE_ME
RESEND_API_KEY=REPLACE_ME
EMAIL_FROM=alerts@yourdomain.com
EMAIL_TO=you@youremail.com
SCHEDULER_ENABLED=true
TZ=America/New_York
FRONTEND_URL=https://yourdomain.com
ENVEOF

chown "${APP_USER}:${APP_USER}" "${ENV_FILE}"
chmod 600 "${ENV_FILE}"

# ── 9. PM2 STARTUP ────────────────────────────────────────────────────────────
echo "→ Configuring PM2 startup…"
env PATH="${PATH}:/usr/bin" pm2 startup systemd -u "${APP_USER}" --hp "/home/${APP_USER}" 2>/dev/null | tail -1 | bash || true
systemctl enable pm2-${APP_USER} 2>/dev/null || true

# ── 10. NGINX (placeholder — real config in nginx.conf) ──────────────────────
echo "→ Installing nginx placeholder config…"
cat > /etc/nginx/sites-available/sma-engine <<'NGXEOF'
# Replace yourdomain.com below, then run:
# certbot --nginx -d yourdomain.com
server {
    listen 80;
    server_name yourdomain.com;
    location / {
        proxy_pass         http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection 'upgrade';
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
        # Required for SSE streaming (scan progress)
        proxy_buffering    off;
        proxy_read_timeout 600s;
    }
}
NGXEOF

ln -sf /etc/nginx/sites-available/sma-engine /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

# ── 11. PRINT SUMMARY ─────────────────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════════════"
echo "  SETUP COMPLETE"
echo "═══════════════════════════════════════════════════════"
echo ""
echo "  DB User:     ${DB_USER}"
echo "  DB Name:     ${DB_NAME}"
echo "  DB Password: ${DB_PASS}  ← SAVE THIS"
echo "  Auth Key:    ${AUTH_KEY}"
echo "  DB URL:      ${DB_URL}"
echo "  App Dir:     ${APP_DIR}"
echo "  Env File:    ${ENV_FILE}"
echo ""
echo "  ┌─ NEXT STEPS ────────────────────────────────────┐"
echo "  │ 1. Copy app files to ${APP_DIR}/backend/       │"
echo "  │    scp -r backend/* user@vps:${APP_DIR}/backend/ │"
echo "  │                                                  │"
echo "  │ 2. Edit .env and fill in:                       │"
echo "  │    POLYGON_API_KEY  (Massive Stocks Starter)    │"
echo "  │    RESEND_API_KEY   (resend.com free tier)      │"
echo "  │    EMAIL_FROM / EMAIL_TO                        │"
echo "  │    FRONTEND_URL     (your domain)               │"
echo "  │                                                  │"
echo "  │ 3. Install deps and run schema:                 │"
echo "  │    cd ${APP_DIR}/backend                        │"
echo "  │    npm install --production                     │"
echo "  │    npm run db:migrate                           │"
echo "  │                                                  │"
echo "  │ 4. Build frontend:                              │"
echo "  │    cd ${APP_DIR}/frontend                       │"
echo "  │    npm install && npm run build                 │"
echo "  │                                                  │"
echo "  │ 5. Start with PM2:                              │"
echo "  │    cd ${APP_DIR}                                │"
echo "  │    pm2 start deploy/ecosystem.config.js         │"
echo "  │    pm2 save                                     │"
echo "  │                                                  │"
echo "  │ 6. SSL (after pointing DNS):                    │"
echo "  │    certbot --nginx -d yourdomain.com            │"
echo "  │                                                  │"
echo "  │ 7. Test: curl http://yourdomain.com/api/health  │"
echo "  └──────────────────────────────────────────────────┘"
echo ""
