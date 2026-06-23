#!/usr/bin/env bash
set -euo pipefail
cat > /etc/caddy/Caddyfile << 'CADDYEOF'
:80 {
	reverse_proxy 127.0.0.1:3000
}
CADDYEOF
caddy validate --config /etc/caddy/Caddyfile
systemctl restart caddy
sleep 2
systemctl is-active caddy
ss -tlnp | grep ':80 ' || true
echo "local80:$(curl -sS -o /dev/null -w '%{http_code}' --connect-timeout 5 http://127.0.0.1/login)"
echo "local3000:$(curl -sS -o /dev/null -w '%{http_code}' --connect-timeout 5 http://127.0.0.1:3000/login)"
echo "public:$(curl -sS -o /dev/null -w '%{http_code}' --connect-timeout 10 http://149.50.152.115/login)"

