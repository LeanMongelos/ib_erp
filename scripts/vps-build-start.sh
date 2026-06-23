#!/usr/bin/env bash
set -euo pipefail
cd /opt/ibiomedica
export NODE_OPTIONS=--max-old-space-size=3072
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
cat > /etc/caddy/Caddyfile << 'CADDYEOF'
:80 {
	reverse_proxy 127.0.0.1:3000
}
CADDYEOF
systemctl enable caddy
systemctl restart caddy
sleep 4
curl -s -o /dev/null -w "login:%{http_code}\n" http://127.0.0.1:3000/login
curl -s -o /dev/null -w "public:%{http_code}\n" http://149.50.152.115/login
pm2 status
