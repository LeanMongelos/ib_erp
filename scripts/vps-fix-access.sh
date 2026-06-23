#!/usr/bin/env bash
set -euo pipefail

echo "=== PM2 ==="
pm2 status || true

echo "=== Ports ==="
ss -tlnp | grep -E ':80|:3000|:8080' || true

echo "=== App local ==="
curl -s -o /dev/null -w "app3000:%{http_code}\n" http://127.0.0.1:3000/login || echo "app3000:fail"

echo "=== Caddy status ==="
systemctl status caddy --no-pager -l 2>&1 | tail -15 || true
journalctl -u caddy -n 8 --no-pager 2>&1 || true

# Fix Caddy: DonWeb often blocks or occupies port 80 — use 8080 publicly
cat > /etc/caddy/Caddyfile <<'EOF'
:8080 {
	reverse_proxy 127.0.0.1:3000
}
EOF

systemctl enable caddy
systemctl restart caddy
sleep 2
systemctl is-active caddy || (journalctl -u caddy -n 10 --no-pager; exit 1)

echo "=== After fix ==="
curl -s -o /dev/null -w "caddy8080:%{http_code}\n" http://127.0.0.1:8080/login
curl -s -o /dev/null -w "public8080:%{http_code}\n" http://149.50.152.115:8080/login

pm2 status
