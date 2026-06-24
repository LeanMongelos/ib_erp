#!/usr/bin/env bash
# Inicia workers PM2 en primera instalación (idempotente — omite si ya registrados).
# Uso: cd /opt/ibiomedica && bash scripts/vps-start-workers.sh
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/ibiomedica}"
cd "$APP_DIR"

if ! command -v pm2 >/dev/null 2>&1; then
  echo "ERROR: pm2 no instalado. Instalar Node/npm y pm2 antes de continuar."
  exit 1
fi

start_worker() {
  local name="$1"
  local npm_script="$2"
  if pm2 describe "$name" >/dev/null 2>&1; then
    echo "==> $name: ya registrado en PM2 (omitido)"
  else
    echo "==> Iniciando $name (npm run $npm_script)..."
    pm2 start npm --name "$name" -- run "$npm_script"
  fi
}

echo "==> Workers iBiomédica (idempotente)"
start_worker worker-afip worker:afip
start_worker worker-cobranzas worker:cobranzas
start_worker worker-crm-email worker:crm-email
start_worker worker-crm-graph worker:crm-graph

pm2 save
echo ""
pm2 status
