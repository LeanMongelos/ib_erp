#!/usr/bin/env bash
# Aplica Caddyfile de producción: dominio + Let's Encrypt + redirecciones.
# Usado por vps-setup-domain.sh y vps-deploy-from-git.sh (no sobrescribir con :80 plano).
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/ibiomedica}"
DOMAIN="${DOMAIN:-erp-ibiomedica.com.ar}"
VPS_IP="${VPS_IP:-149.50.152.115}"
ACME_EMAIL="${ACME_EMAIL:-admin@ibiomedica.com}"

if [[ -f "${APP_DIR}/.env" ]]; then
  url="$(grep '^NEXTAUTH_URL=' "${APP_DIR}/.env" | cut -d= -f2- | tr -d '"' | tr -d "'" || true)"
  if [[ -n "$url" ]]; then
    parsed="${url#https://}"
    parsed="${parsed#http://}"
    parsed="${parsed%%/*}"
    if [[ -n "$parsed" && "$parsed" != "localhost"* ]]; then
      DOMAIN="$parsed"
    fi
  fi
fi

echo "==> Caddy: dominio ${DOMAIN} (IP ${VPS_IP})"

ufw allow 80/tcp comment 'HTTP' 2>/dev/null || true
ufw allow 443/tcp comment 'HTTPS' 2>/dev/null || true
ufw --force enable 2>/dev/null || true

cat > /etc/caddy/Caddyfile <<CADDYEOF
{
	email ${ACME_EMAIL}
}

${DOMAIN} {
	reverse_proxy 127.0.0.1:3000
}

www.${DOMAIN} {
	redir https://${DOMAIN}{uri} permanent
}

http://${VPS_IP} {
	redir https://${DOMAIN}{uri} permanent
}
CADDYEOF

caddy validate --config /etc/caddy/Caddyfile
systemctl enable caddy 2>/dev/null || true
systemctl restart caddy
sleep 5
systemctl is-active caddy

ss -tlnp | grep -E ':80 |:443 ' || true

echo -n "https_local:"
curl -sS -o /dev/null -w '%{http_code}' --connect-timeout 15 \
  --resolve "${DOMAIN}:443:127.0.0.1" "https://${DOMAIN}/login" || echo fail
echo
echo -n "https_public:"
curl -sS -o /dev/null -w '%{http_code}' --connect-timeout 20 "https://${DOMAIN}/login" || echo fail
echo
