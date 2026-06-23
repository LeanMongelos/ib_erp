#!/usr/bin/env bash
# Configura dominio + HTTPS (Let's Encrypt) en VPS con Caddy.
# Uso en VPS: bash scripts/vps-setup-domain.sh
# Remoto: node scripts/vps-run-remote.sh.js scripts/vps-setup-domain.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="${APP_DIR:-/opt/ibiomedica}"
DOMAIN="${DOMAIN:-erp-ibiomedica.com.ar}"
NEXTAUTH_URL="https://${DOMAIN}"

echo "==> Dominio: ${DOMAIN}"

bash "${SCRIPT_DIR}/vps-caddy-apply.sh"

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

echo "Done: ${NEXTAUTH_URL}/login"
