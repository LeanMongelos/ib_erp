#!/usr/bin/env bash
set -euo pipefail
echo "=== PM2 ==="
pm2 status
echo "=== Docker ==="
docker ps --format 'table {{.Names}}\t{{.Status}}'
echo "=== HTTP ==="
curl -s -o /dev/null -w "login3000:%{http_code}\n" http://127.0.0.1:3000/login
curl -s -o /dev/null -w "login80:%{http_code}\n" http://127.0.0.1/login
curl -s -o /dev/null -w "health:%{http_code}\n" http://127.0.0.1:3000/api/health || echo "health:missing"
echo "=== DB ==="
docker exec ibiomedica_db pg_isready -U admin -d ibiomedica_db
cd /opt/ibiomedica
npx prisma migrate status 2>&1 | tail -3
echo "=== Git deployed ==="
git log -1 --oneline
echo "=== .env exists (not content) ==="
test -f .env && echo "yes" || echo "no"
