#!/usr/bin/env bash
# Deploy de producción: git pull + build + PM2 + Caddy
set -euo pipefail

APP_DIR="/opt/ibiomedica"
BRANCH="${DEPLOY_BRANCH:-master}"

notify_deploy_webhook() {
  local status="$1"
  local http_code="${2:-}"
  local url="${DEPLOY_WEBHOOK_URL:-}"
  [[ -z "$url" ]] && return 0
  local commit host ts payload
  commit="$(git -C "$APP_DIR" rev-parse --short HEAD 2>/dev/null || echo unknown)"
  host="$(hostname -s 2>/dev/null || echo vps)"
  ts="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  payload=$(printf '{"status":"%s","host":"%s","branch":"%s","commit":"%s","http_code":"%s","ts":"%s"}' \
    "$status" "$host" "$BRANCH" "$commit" "$http_code" "$ts")
  curl -sS -m 5 -X POST "$url" \
    -H 'Content-Type: application/json' \
    -d "$payload" >/dev/null 2>&1 || true
}

on_deploy_error() {
  notify_deploy_webhook "fail" ""
  exit 1
}
trap on_deploy_error ERR

# Pasos idempotentes post-build: un fallo no debe tumbar el deploy (app ya reiniciada).
run_optional_step() {
  local label="$1"
  shift
  echo "==> $label..."
  if "$@"; then
    echo "    OK: $label"
  else
    echo "WARN: $label falló (exit $?). Revisar logs; el deploy continúa."
  fi
}

cd "$APP_DIR"

if [[ ! -d .git ]]; then
  echo "ERROR: $APP_DIR no es un repositorio git. Ejecutá scripts/vps-setup-github-deploy.sh en el VPS."
  exit 1
fi

echo "==> Actualizando código (origin/$BRANCH)..."
git fetch origin
OLD_HEAD="$(git rev-parse HEAD)"
git reset --hard "origin/$BRANCH"
NEW_HEAD="$(git rev-parse HEAD)"
if [[ "$OLD_HEAD" != "$NEW_HEAD" && "${DEPLOY_SELF_REEXEC:-1}" == "1" ]]; then
  echo "==> Código actualizado; re-ejecutando deploy con script nuevo..."
  export DEPLOY_SELF_REEXEC=0
  exec bash "$0" "$@"
fi

echo "==> Docker Compose producción..."
cat > docker-compose.prod.yml <<'EOF'
services:
  postgres:
    ports:
      - "127.0.0.1:5433:5432"
  redis:
    ports:
      - "127.0.0.1:6380:6379"
  minio:
    ports:
      - "127.0.0.1:9002:9000"
      - "127.0.0.1:9003:9001"
EOF

docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d postgres redis minio

echo "==> Esperando PostgreSQL..."
for i in $(seq 1 20); do
  if docker exec ibiomedica_db pg_isready -U admin -d ibiomedica_db >/dev/null 2>&1; then
    break
  fi
  sleep 3
done

echo "==> Dependencias..."
export NODE_OPTIONS=--max-old-space-size=3072
npm ci

echo "==> Validación entorno producción..."
FORCE_PROD=1 npm run validar:env-prod || {
  echo "ERROR: validación de entorno falló — corregí .env antes de continuar."
  exit 1
}

echo "==> Build..."
bash scripts/vps-install-puppeteer-deps.sh
npx prisma generate
npx prisma migrate deploy
npm run build

echo "==> Test invariantes (sin DB)..."
npm run test:invariants

echo "==> PM2..."
pm2 restart ibiomedica 2>/dev/null || pm2 start npm --name ibiomedica -- start
for worker in worker-afip worker-cobranzas worker-crm-email worker-crm-graph; do
  if pm2 describe "$worker" >/dev/null 2>&1; then
    echo "    reiniciando $worker..."
    pm2 restart "$worker" --update-env
  else
    echo "    $worker: no registrado en PM2; omitiendo."
  fi
done
pm2 save

run_optional_step "Migración emails @ib.com + cierre de sesiones (idempotente)" \
  npx tsx --env-file=.env scripts/migrate-emails-ib-com.ts --execute

run_optional_step "Backfill plantillaId en facturas/presupuestos (idempotente)" \
  npx tsx --env-file=.env scripts/backfill-plantillas-documentos.ts --execute

run_optional_step "Permisos cartera de cheques (idempotente)" \
  npx tsx --env-file=.env scripts/sync-cheques-permisos.ts

run_optional_step "Contraseñas go-live ib2026 (excluye Leandro, idempotente)" \
  npx tsx --env-file=.env scripts/reset-passwords-ib2026.ts --execute

run_optional_step "Limpieza datos demo (go-live, idempotente)" \
  npx tsx --env-file=.env scripts/prod-limpieza-demo.ts

run_optional_step "Tracking backfill mapa ST (idempotente)" \
  npx tsx --env-file=.env scripts/sync-tracking-demo.ts

run_optional_step "Listas de precios MIN-ARS / MAY-ARS (idempotente)" \
  npx tsx --env-file=.env scripts/sync-listas-precios.ts

run_optional_step "Integridad post-deploy (reporte; no bloquea deploy)" \
  npm run integridad:prod

run_optional_step "Reparación segura I2/Pr3 (idempotente)" \
  npm run integridad:reparar -- --execute --only I2,Pr3

echo "==> Caddy (dominio + HTTPS, no sobrescribir con HTTP plano)..."
bash scripts/vps-caddy-apply.sh

sleep 2
HEALTH_CODE="$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3000/login)"
echo "deploy_ok:${HEALTH_CODE}"

notify_deploy_webhook "ok" "$HEALTH_CODE"

echo "==> Cron del sistema (opcional)..."
CRON_SCRIPT="$APP_DIR/scripts/vps-install-cron.sh"
if [[ -f "$CRON_SCRIPT" ]]; then
  CAN_CRON=0
  if [[ "${EUID:-$(id -u)}" -eq 0 ]]; then
    CAN_CRON=1
  elif sudo -n test -w /etc/cron.d/ 2>/dev/null; then
    CAN_CRON=1
  fi
  if [[ "$CAN_CRON" -eq 1 ]]; then
    if [[ "${EUID:-$(id -u)}" -eq 0 ]]; then
      bash "$CRON_SCRIPT" || echo "WARN: instalación cron falló; continuar deploy..."
    else
      sudo -n bash "$CRON_SCRIPT" || echo "WARN: instalación cron falló; continuar deploy..."
    fi
  else
    echo "cron: manual — run sudo bash scripts/vps-install-cron.sh"
  fi
fi

pm2 status
