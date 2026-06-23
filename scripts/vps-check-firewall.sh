#!/usr/bin/env bash
ufw status verbose 2>/dev/null || echo "ufw not active"
iptables -L INPUT -n 2>/dev/null | head -20 || true
ss -tlnp | grep -E ':80|:8080|:3000'
curl -s -o /dev/null -w "local8080:%{http_code}\n" http://127.0.0.1:8080/login
