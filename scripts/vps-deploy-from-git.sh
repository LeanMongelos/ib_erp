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

# Swap temporal si el VPS no tiene — evita SIGKILL (OOM) en next build.
ensure_build_swap() {
  if swapon --show 2>/dev/null | grep -q .; then
    echo "    Swap ya activo"
    return 0
  fi
  local swapfile="/swapfile-ibiomedica-build"
  echo "    Creando swap temporal 2G para build..."
  if fallocate -l 2G "$swapfile" 2>/dev/null || dd if=/dev/zero of="$swapfile" bs=1M count=2048 status=none; then
    chmod 600 "$swapfile"
    mkswap "$swapfile" >/dev/null
    swapon "$swapfile"
    BUILD_SWAP_CREATED=1
  else
    echo "WARN: no se pudo crear swap temporal"
  fi
}

teardown_build_swap() {
  if [[ "${BUILD_SWAP_CREATED:-0}" == "1" ]]; then
    swapoff /swapfile-ibiomedica-build 2>/dev/null || true
    rm -f /swapfile-ibiomedica-build
  fi
}

pause_nonessential_for_build() {
  echo "    Pausando PM2 y contenedores no esenciales (libera RAM)..."
  pm2 stop all 2>/dev/null || true
  docker stop ibiomedica_minio ibiomedica_redis ibiomedica_n8n 2>/dev/null || true
}

resume_after_build() {
  docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d minio redis n8n 2>/dev/null || true
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

echo "==> Docker Compose producción (127.0.0.1 — docker-compose.prod.yml)..."
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d postgres redis minio

echo "==> Esperando PostgreSQL..."
for i in $(seq 1 20); do
  if docker exec ibiomedica_db pg_isready -U admin -d ibiomedica_db >/dev/null 2>&1; then
    break
  fi
  sleep 3
done

echo "==> Dependencias..."
# Heap moderado: en VPS chico un límite alto + Docker + PM2 provoca SIGKILL (OOM) en next build.
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=2048}"
npm ci

echo "==> Validación entorno producción..."
FORCE_PROD=1 npm run validar:env-prod || {
  echo "ERROR: validación de entorno falló — corregí .env antes de continuar."
  exit 1
}

echo "==> Build..."
ensure_build_swap
pause_nonessential_for_build
trap 'teardown_build_swap; resume_after_build; on_deploy_error' ERR

bash scripts/vps-install-puppeteer-deps.sh
npx prisma generate
npx prisma migrate deploy

export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=1536}"
export NEXT_TELEMETRY_DISABLED=1
export NEXT_BUILD_CPUS="${NEXT_BUILD_CPUS:-1}"
echo "    NODE_OPTIONS=$NODE_OPTIONS NEXT_BUILD_CPUS=$NEXT_BUILD_CPUS"
npm run build

teardown_build_swap
resume_after_build
trap on_deploy_error ERR

echo "==> PM2 (reinicio antes de tests — evita caída si falla test:invariants)..."
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

echo "==> Test invariantes (sin DB)..."
npm run test:invariants

echo "==> PM2 (confirmación post-tests)..."
pm2 restart ibiomedica 2>/dev/null || true
for worker in worker-afip worker-cobranzas worker-crm-email worker-crm-graph; do
  pm2 describe "$worker" >/dev/null 2>&1 && pm2 restart "$worker" --update-env 2>/dev/null || true
done
pm2 save

echo "==> Post-deploy scripts..."
run_optional_step "Permisos RBAC nuevos (compras/tesoreria, idempotente)" \
  npx tsx --env-file=.env scripts/sync-permisos-post-deploy.ts

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

AFIP_CERT_DIR="$APP_DIR/storage/afip/20244408274"
if [[ -f "$AFIP_CERT_DIR/certificado.crt" && -f "$AFIP_CERT_DIR/clave.key" ]]; then
  run_optional_step "Certificado AFIP en storage → emisor BD" \
    npx tsx --env-file=.env scripts/instalar-certificado-afip-local.ts "20-24440827-4" --desde-storage --alias "IB - LM DIGITAL SOLUTION"
fi

run_optional_step "Eliminar emisor CUIT duplicado 30-70902717-0 (idempotente)" \
  npx tsx --env-file=.env scripts/eliminar-emisor-cuit.ts "30-70902717-0"

run_optional_step "Integridad post-deploy (reporte; no bloquea deploy)" \
  npm run integridad:prod

run_optional_step "Reparación segura I2/Pr3 (idempotente)" \
  npm run integridad:reparar -- --execute --only I2,Pr3

echo "==> Caddy (dominio + HTTPS, no sobrescribir con HTTP plano)..."
bash scripts/vps-caddy-apply.sh

run_optional_step "Hardening seguridad VPS (ufw, fail2ban, docker localhost)" \
  bash scripts/vps-harden-security.sh

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
