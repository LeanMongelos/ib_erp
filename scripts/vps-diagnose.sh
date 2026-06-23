echo "=== PM2 ==="
pm2 status 2>&1 || true
echo "=== ss ports 80 3000 8080 ==="
ss -tlnp | grep -E ':80 |:3000|:8080|:443 ' || ss -tlnp
echo "=== curl 127.0.0.1:3000/login ==="
curl -sS -o /dev/null -w "%{http_code}\n" --connect-timeout 5 http://127.0.0.1:3000/login || echo curl_fail
echo "=== caddy status ==="
systemctl status caddy --no-pager 2>&1 | head -20
echo "=== caddy journal ==="
journalctl -u caddy --no-pager -n 30 2>&1
echo "=== Caddyfile ==="
cat /etc/caddy/Caddyfile 2>&1 || true
