#!/usr/bin/env bash
# Configura dominio + HTTPS (Let's Encrypt) en VPS con Caddy.
# Uso en VPS: bash scripts/vps-setup-domain.sh
# Remoto: node scripts/vps-run-remote.sh.js scripts/vps-setup-domain.sh
set -euo pipefail

DOMAIN="${DOMAIN:-erp-ibiomedica.com.ar}"
VPS_IP="${VPS_IP:-149.50.152.115}"
APP_DIR="${APP_DIR:-/opt/ibiomedica}"
ACME_EMAIL="${ACME_EMAIL:-admin@ibiomedica.com}"
NEXTAUTH_URL="https://${DOMAIN}"

echo "==> Dominio: ${DOMAIN} (IP ${VPS_IP}, ACME ${ACME_EMAIL})"

echo "==> Firewall (80/443)..."
ufw allow 80/tcp comment 'HTTP' 2>/dev/null || true
ufw allow 443/tcp comment 'HTTPS' 2>/dev/null || true
ufw --force enable 2>/dev/null || true
ufw status | grep -E '80|443' || true

echo "==> Caddyfile..."
cat > /etc/caddy/Caddyfile <<CADDYEOF
{
	email ${ACME_EMAIL}
}

${DOMAIN} {
	reverse_proxy 127.0.0.1:3000
}

http://${VPS_IP} {
	redir https://${DOMAIN}{uri} permanent
}
CADDYEOF

caddy validate --config /etc/caddy/Caddyfile
systemctl enable caddy 2>/dev/null || true
systemctl restart caddy
sleep 3
systemctl is-active caddy

echo "==> NEXTAUTH_URL en ${APP_DIR}/.env..."
if [[ ! -f "${APP_DIR}/.env" ]]; then
  echo "ERROR: no existe ${APP_DIR}/.env"
  exit 1
fi
if grep -q '^NEXTAUTH_URL=' "${APP_DIR}/.env"; then
  sed -i "s|^NEXTAUTH_URL=.*|NEXTAUTH_URL=\"${NEXTAUTH_URL}\"|" "${APP_DIR}/.env"
else
  echo "NEXTAUTH_URL=\"${NEXTAUTH_URL}\"" >> "${APP_DIR}/.env"
fi
grep '^NEXTAUTH_URL=' "${APP_DIR}/.env"

echo "==> PM2 restart..."
cd "${APP_DIR}"
pm2 restart ibiomedica --update-env
pm2 save 2>/dev/null || true

echo "==> Puertos..."
ss -tlnp | grep -E ':80 |:443 ' || true

echo "==> Verificacion local..."
echo -n "http127:"
curl -sS -o /dev/null -w '%{http_code}' --connect-timeout 10 -H "Host: ${DOMAIN}" http://127.0.0.1/login || echo fail
echo
echo -n "https127:"
curl -sS -o /dev/null -w '%{http_code}' --connect-timeout 15 --resolve "${DOMAIN}:443:127.0.0.1" "https://${DOMAIN}/login" || echo fail
echo
echo -n "public_https:"
curl -sS -o /dev/null -w '%{http_code}' --connect-timeout 20 "https://${DOMAIN}/login" || echo fail
echo

echo "Done: ${NEXTAUTH_URL}/login"
