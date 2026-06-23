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
git reset --hard "origin/$BRANCH"

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
npx prisma generate
npx prisma migrate deploy
npm run build

echo "==> PM2..."
pm2 restart ibiomedica 2>/dev/null || pm2 start npm --name ibiomedica -- start
pm2 save

echo "==> Caddy..."
cat > /etc/caddy/Caddyfile <<'CADDYEOF'
:80 {
	reverse_proxy 127.0.0.1:3000
}
CADDYEOF
systemctl restart caddy

sleep 2
curl -s -o /dev/null -w "deploy_ok:%{http_code}\n" http://127.0.0.1/login
pm2 status
