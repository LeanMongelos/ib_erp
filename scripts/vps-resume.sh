#!/usr/bin/env bash
set -euo pipefail
cd /opt/ibiomedica

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

if grep -q '@127.0.0.1:5432' .env 2>/dev/null; then
  sed -i 's|@127.0.0.1:5432|@127.0.0.1:5433|' .env
fi

if grep -q 'redis://127.0.0.1:6379' .env 2>/dev/null; then
  sed -i 's|redis://127.0.0.1:6379|redis://127.0.0.1:6380|' .env
fi

docker compose -f docker-compose.yml -f docker-compose.prod.yml down || true
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d postgres redis minio

for i in $(seq 1 20); do
  if docker exec ibiomedica_db pg_isready -U admin -d ibiomedica_db >/dev/null 2>&1; then break; fi
  sleep 3
done

export NODE_OPTIONS=--max-old-space-size=3072
npm ci
npx prisma generate
npx prisma migrate deploy
npm run db:seed || true
npm run build

pm2 delete ibiomedica 2>/dev/null || true
pm2 start npm --name ibiomedica -- start
pm2 save

if ! command -v caddy >/dev/null 2>&1; then
  apt-get update -qq
  apt-get install -y -qq debian-keyring debian-archive-keyring apt-transport-https curl gnupg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -qq
  apt-get install -y -qq caddy
fi

cat > /etc/caddy/Caddyfile <<'CADDYEOF'
:80 {
	reverse_proxy 127.0.0.1:3000
}
CADDYEOF
systemctl enable caddy
systemctl restart caddy

sleep 5
curl -s -o /dev/null -w "login_http:%{http_code}\n" http://127.0.0.1:3000/login
docker ps --format 'table {{.Names}}\t{{.Status}}'
pm2 status
