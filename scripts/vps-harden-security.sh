#!/usr/bin/env bash
# Endurecimiento de seguridad VPS — idempotente, seguro re-ejecutar en cada deploy.
# Requiere root (o sudo) para ufw / fail2ban.
#
# Uso manual:
#   sudo bash scripts/vps-harden-security.sh
# En deploy:
#   invocado desde vps-deploy-from-git.sh
set -uo pipefail

APP_DIR="${APP_DIR:-/opt/ibiomedica}"
SSH_PORT="${VPS_SSH_PORT:-5244}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "${APP_DIR:-$ROOT}"

echo ""
echo "=== Hardening seguridad VPS iBiomédica ==="
echo "Directorio: $(pwd)"
echo ""

run_root() {
  if [[ "${EUID:-$(id -u)}" -eq 0 ]]; then
    "$@"
  elif sudo -n true 2>/dev/null; then
    sudo -n "$@"
  else
    echo "WARN: sin root/sudo — omitiendo: $*"
    return 1
  fi
}

echo "--- 1. Firewall UFW ---"
if command -v ufw >/dev/null 2>&1; then
  run_root ufw default deny incoming || true
  run_root ufw default allow outgoing || true
  run_root ufw allow "${SSH_PORT}/tcp" comment 'SSH DonWeb' || true
  run_root ufw allow 80/tcp comment 'HTTP' || true
  run_root ufw allow 443/tcp comment 'HTTPS' || true
  for port in 3000 5432 5433 6379 6380 5678 9000 9001 9002 9003; do
    run_root ufw deny "${port}/tcp" comment 'bloqueo servicios internos' 2>/dev/null || true
  done
  run_root ufw --force enable || true
  ufw status verbose 2>/dev/null | head -25 || true
else
  echo "WARN: ufw no instalado"
fi

echo ""
echo "--- 2. Docker — bind localhost (docker-compose.prod.yml) ---"
if command -v docker >/dev/null 2>&1 && [[ -f docker-compose.yml && -f docker-compose.prod.yml ]]; then
  docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d postgres redis minio 2>/dev/null || \
    echo "WARN: docker compose falló — revisar contenedores manualmente"
else
  echo "WARN: Docker o compose files no disponibles"
fi

echo ""
echo "--- 3. Fail2ban (SSH) ---"
JAIL_SRC="$ROOT/scripts/vps/fail2ban-jail.local"
if [[ -f "$JAIL_SRC" ]]; then
  if run_root apt-get install -y -qq fail2ban 2>/dev/null; then
    run_root cp "$JAIL_SRC" /etc/fail2ban/jail.d/ibiomedica.local || true
    run_root systemctl enable fail2ban 2>/dev/null || true
    run_root systemctl restart fail2ban 2>/dev/null || true
    fail2ban-client status sshd 2>/dev/null | head -5 || echo "    fail2ban: revisar jail sshd (puerto ${SSH_PORT})"
  fi
else
  echo "WARN: $JAIL_SRC no encontrado"
fi

echo ""
echo "--- 4. Variables .env (APP_URL para anti-CSRF) ---"
if [[ -f .env ]]; then
  if grep -q '^NEXTAUTH_URL=' .env; then
    NAU="$(grep '^NEXTAUTH_URL=' .env | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")"
    if ! grep -q '^APP_URL=' .env; then
      echo "APP_URL=${NAU}" >> .env
      echo "    Añadido APP_URL=${NAU}"
    else
      echo "    APP_URL ya definido"
    fi
  fi
  # Aviso si DATABASE_URL apunta a puerto público antiguo
  if grep -q '@127.0.0.1:5432/' .env 2>/dev/null && docker ps --format '{{.Names}}' 2>/dev/null | grep -q ibiomedica_db; then
    echo "WARN: DATABASE_URL usa :5432 — en prod con docker-compose.prod.yml suele ser :5433"
  fi
else
  echo "WARN: .env no encontrado en $(pwd)"
fi

echo ""
echo "--- 5. Verificación puertos sensibles ---"
EXPOSED=0
if command -v ss >/dev/null 2>&1; then
  while read -r line; do
    echo "    ⚠️  EXPUESTO: $line"
    EXPOSED=$((EXPOSED + 1))
  done < <(ss -tlnH 2>/dev/null | awk '$4 ~ /0\.0\.0\.0:/ || $4 ~ /\[::\]:/ {print}' | grep -E ':5432|:5433|:6379|:6380|:9000|:9002|:3000|:5678' || true)
  if [[ "$EXPOSED" -eq 0 ]]; then
    echo "    OK: PostgreSQL/Redis/Minio/Next no escuchan en 0.0.0.0"
  fi
fi

echo ""
echo "--- 6. Permisos storage (certificados AFIP) ---"
if [[ -d storage ]]; then
  run_root chmod -R u=rwX,go= storage 2>/dev/null || chmod -R u=rwX,go= storage 2>/dev/null || true
  if [[ -d storage/afip ]]; then
    run_root chmod -R u=rwX,go= storage/afip 2>/dev/null || chmod -R u=rwX,go= storage/afip 2>/dev/null || true
    echo "    storage/afip: permisos restringidos (solo owner)"
  fi
fi

echo ""
echo "✅ Hardening completado (revisar WARN arriba si los hay)"
echo ""
