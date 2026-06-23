#!/usr/bin/env bash
set -euo pipefail
cat > /etc/caddy/Caddyfile <<'EOF'
:80 {
	reverse_proxy 127.0.0.1:3000
}
EOF
systemctl restart caddy
sleep 2
systemctl is-active caddy
curl -s -o /dev/null -w "local80:%{http_code}\n" http://127.0.0.1/login
curl -s -o /dev/null -w "public80:%{http_code}\n" http://149.50.152.115/login
