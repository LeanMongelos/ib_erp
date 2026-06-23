#!/usr/bin/env bash
# Bootstrap iBiomédica ERP en VPS Ubuntu (DonWeb)
set -euo pipefail

APP_DIR="/opt/ibiomedica"
REPO="https://github.com/LeanMongelos/ib_erp.git"
PUBLIC_URL="${PUBLIC_URL:-http://149.50.152.115}"

echo "==> Actualizando sistema..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get upgrade -y -qq
apt-get install -y -qq git curl ca-certificates gnupg ufw build-essential

if ! command -v docker >/dev/null 2>&1; then
  echo "==> Instalando Docker..."
  curl -fsSL https://get.docker.com | sh
  systemctl enable docker
  systemctl start docker
fi

if ! command -v node >/dev/null 2>&1 || [[ "$(node -v | cut -d. -f1 | tr -d v)" -lt 20 ]]; then
  echo "==> Instalando Node.js 20..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y -qq nodejs
fi

npm install -g pm2 >/dev/null 2>&1 || true

echo "==> Firewall..."
ufw allow 5244/tcp comment 'SSH DonWeb' || true
ufw allow 80/tcp comment 'HTTP' || true
ufw allow 443/tcp comment 'HTTPS' || true
ufw --force enable || true

echo "==> Clonando / actualizando aplicación..."
mkdir -p "$APP_DIR"
# El código ya fue subido por vps-deploy-remote.js; si no existe, clonar repo
if [[ ! -f "$APP_DIR/package.json" ]]; then
  git clone "$REPO" "$APP_DIR"
  cd "$APP_DIR"
  git checkout master 2>/dev/null || git checkout main 2>/dev/null || true
else
  cd "$APP_DIR"
fi

echo "==> Docker Compose producción (solo localhost)..."
cat > docker-compose.prod.yml <<'EOF'
services:
  postgres:
    ports:
      - "127.0.0.1:5432:5432"
  redis:
    ports:
      - "127.0.0.1:6379:6379"
  minio:
    ports:
      - "127.0.0.1:9000:9000"
      - "127.0.0.1:9001:9001"
  n8n:
    ports:
      - "127.0.0.1:5678:5678"
EOF

if [[ ! -f .env ]]; then
  echo "==> Generando .env de producción..."
  NEXTAUTH_SECRET="$(openssl rand -base64 32)"
  INTEGRATION_SECRET="$(openssl rand -base64 32)"
  CRON_SECRET="$(openssl rand -base64 32)"
  N8N_API_KEY="$(openssl rand -base64 32)"
  cat > .env <<ENV
DATABASE_URL="postgresql://admin:admin123@127.0.0.1:5432/ibiomedica_db"
NEXTAUTH_SECRET="${NEXTAUTH_SECRET}"
NEXTAUTH_URL="${PUBLIC_URL}"
PORT=3000

STORAGE_DRIVER="s3"
STORAGE_DIR="./storage"
S3_ENDPOINT="http://127.0.0.1:9000"
S3_REGION="us-east-1"
S3_BUCKET="ibiomedica"
S3_ACCESS_KEY_ID="admin"
S3_SECRET_ACCESS_KEY="admin123456"
S3_FORCE_PATH_STYLE="true"

REDIS_URL="redis://127.0.0.1:6379"
INTEGRATION_SECRET="${INTEGRATION_SECRET}"
META_VERIFY_TOKEN="$(openssl rand -hex 16)"
N8N_API_KEY="${N8N_API_KEY}"
CRM_EMAIL_POLL_MS="120000"
CRON_SECRET="${CRON_SECRET}"
ENV
fi

echo "==> Levantando infra Docker..."
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d postgres redis minio

echo "==> Esperando PostgreSQL..."
for i in $(seq 1 30); do
  if docker exec ibiomedica_db pg_isready -U admin -d ibiomedica_db >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

echo "==> Dependencias y build..."
export NODE_OPTIONS="--max-old-space-size=3072"
npm ci
npx prisma generate
npx prisma migrate deploy

echo "==> Seed inicial (catálogos + admin demo — cambiar contraseña después)..."
npm run db:seed || true

npm run build

echo "==> PM2..."
pm2 delete ibiomedica 2>/dev/null || true
pm2 start npm --name ibiomedica -- start
pm2 save
pm2 startup systemd -u root --hp /root 2>/dev/null | tail -1 | bash || true

if ! command -v caddy >/dev/null 2>&1; then
  echo "==> Instalando Caddy..."
  apt-get install -y -qq debian-keyring debian-archive-keyring apt-transport-https
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -qq
  apt-get install -y -qq caddy
fi

cat > /etc/caddy/Caddyfile <<CADDY
${PUBLIC_URL#http://} {
  reverse_proxy 127.0.0.1:3000
}
CADDY

# Si PUBLIC_URL es IP, Caddy escucha :80 sin TLS automático en IP pura
if [[ "$PUBLIC_URL" == http://* ]]; then
  HOST="${PUBLIC_URL#http://}"
  cat > /etc/caddy/Caddyfile <<CADDY
:80 {
  reverse_proxy 127.0.0.1:3000
}
CADDY
fi

systemctl enable caddy
systemctl restart caddy

echo ""
echo "✅ Deploy completado"
echo "   URL: ${PUBLIC_URL}/login"
echo "   Admin demo: admin@ibiomedica.com / admin123  (CAMBIAR YA)"
echo "   App dir: ${APP_DIR}"
echo "   .env: ${APP_DIR}/.env"
