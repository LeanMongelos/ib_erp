#!/usr/bin/env bash
# Deploy de producción: git pull + build + PM2 + Caddy
set -euo pipefail

APP_DIR="/opt/ibiomedica"
BRANCH="${DEPLOY_BRANCH:-master}"
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

echo "==> Build..."
export NODE_OPTIONS=--max-old-space-size=3072
npm ci
bash scripts/vps-install-puppeteer-deps.sh
npx prisma generate
npx prisma migrate deploy
npm run build

echo "==> Test invariantes (sin DB)..."
npm run test:invariants

echo "==> PM2..."
pm2 restart ibiomedica 2>/dev/null || pm2 start npm --name ibiomedica -- start
for worker in worker-afip worker-cobranzas; do
  if pm2 describe "$worker" >/dev/null 2>&1; then
    echo "    reiniciando $worker..."
    pm2 restart "$worker" --update-env
  else
    echo "    $worker: no registrado en PM2; omitiendo."
  fi
done
pm2 save

echo "==> Migración emails @ib.com + cierre de sesiones (idempotente)..."
npx tsx --env-file=.env scripts/migrate-emails-ib-com.ts --execute || {
  echo "WARN: migración emails falló; revisar logs."
}

echo "==> Backfill plantillaId en facturas/presupuestos (idempotente)..."
npx tsx --env-file=.env scripts/backfill-plantillas-documentos.ts --execute || {
  echo "WARN: backfill plantillas falló; revisar logs."
}

echo "==> Contraseñas go-live ib2026 (excluye Leandro, idempotente)..."
npx tsx --env-file=.env scripts/reset-passwords-ib2026.ts --execute || {
  echo "WARN: reset contraseñas falló; revisar logs."
}

echo "==> Limpieza datos demo (go-live, idempotente)..."
npx tsx --env-file=.env scripts/prod-limpieza-demo.ts || {
  echo "WARN: limpieza demo falló; revisar logs. Continuando deploy..."
}

echo "==> Tracking backfill (idempotente, obligatorio)..."
npx tsx --env-file=.env scripts/sync-tracking-demo.ts

echo "==> Listas de precios (MIN-ARS / MAY-ARS, idempotente)..."
npx tsx --env-file=.env scripts/sync-listas-precios.ts

echo "==> Integridad post-deploy..."
npm run integridad:prod

echo "==> Caddy (dominio + HTTPS, no sobrescribir con HTTP plano)..."
bash scripts/vps-caddy-apply.sh

sleep 2
curl -s -o /dev/null -w "deploy_ok:%{http_code}\n" http://127.0.0.1:3000/login

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
