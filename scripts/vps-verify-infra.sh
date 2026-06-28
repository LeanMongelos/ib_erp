#!/usr/bin/env bash
# Verificación de infraestructura VPS — health, PM2, cron, backups.
# Uso: npm run verify:infra  (o bash scripts/vps-verify-infra.sh en el VPS)
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

APP_URL="${NEXTAUTH_URL:-http://127.0.0.1:3000}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/ibiomedica}"
CRON_FILE="/etc/cron.d/ibiomedica-cron"
MAX_BACKUP_HOURS="${MAX_BACKUP_HOURS:-24}"

PASS=0
WARN=0
FAIL=0

pass() { echo "✅ PASS: $*"; PASS=$((PASS + 1)); }
warn() { echo "⚠️  WARN: $*"; WARN=$((WARN + 1)); }
fail() { echo "❌ FAIL: $*"; FAIL=$((FAIL + 1)); }

echo ""
echo "=== Verificación infraestructura iBiomédica ==="
echo "Fecha: $(date '+%Y-%m-%d %H:%M:%S %Z' 2>/dev/null || date)"
echo "Host: $(hostname 2>/dev/null || echo desconocido)"
echo ""

echo "--- 1. Health HTTP ---"
HEALTH_JSON="$(curl -sf "${APP_URL}/api/health" 2>/dev/null || true)"
if echo "$HEALTH_JSON" | grep -q '"ok"[[:space:]]*:[[:space:]]*true'; then
  pass "Health OK — ${APP_URL}/api/health"
  DB="$(echo "$HEALTH_JSON" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{console.log(JSON.parse(d).db??'?')}catch{console.log('?')}})" 2>/dev/null || echo "?")"
  REDIS="$(echo "$HEALTH_JSON" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{console.log(JSON.parse(d).redis??'?')}catch{console.log('?')}})" 2>/dev/null || echo "?")"
  echo "    db=$DB redis=$REDIS"
else
  fail "Health falló — verificar app en ${APP_URL}"
fi

echo ""
echo "--- 2. Procesos PM2 ---"
PM2_NAMES=(ibiomedica worker-afip worker-cobranzas worker-crm-email worker-crm-graph)
if command -v pm2 >/dev/null 2>&1; then
  PM2_JSON="$(pm2 jlist 2>/dev/null || echo '[]')"
  for name in "${PM2_NAMES[@]}"; do
    status="$(echo "$PM2_JSON" | node -e "
      const fs = require('fs');
      const raw = fs.readFileSync(0,'utf8').trim() || '[]';
      const list = JSON.parse(raw);
      const p = list.find(x => x.name === process.argv[1]);
      if (!p) { console.log('missing'); process.exit(0); }
      console.log(p.pm2_env?.status ?? 'desconocido');
    " "$name" 2>/dev/null || echo "error")"
    case "$status" in
      online) pass "$name: online" ;;
      missing)
        if [[ "$name" == "ibiomedica" ]]; then
          fail "$name no registrado en PM2"
        else
          warn "$name no registrado en PM2 (opcional según módulos activos)"
        fi
        ;;
      *)
        if [[ "$name" == "ibiomedica" ]]; then
          fail "$name: $status"
        else
          warn "$name: $status"
        fi
        ;;
    esac
  done
else
  warn "PM2 no disponible en este host (normal en dev local)"
fi

echo ""
echo "--- 3. Cron del sistema ---"
if [[ -f "$CRON_FILE" ]]; then
  pass "Cron instalado ($CRON_FILE)"
else
  warn "Cron no encontrado — en VPS: sudo APP_URL=https://erp-ibiomedica.com.ar bash scripts/vps-install-cron.sh"
fi

echo ""
echo "--- 4. Backup PostgreSQL ---"
if [[ -d "$BACKUP_DIR" ]]; then
  LATEST="$(find "$BACKUP_DIR" -maxdepth 1 -type f \( -name '*.sql.gz' -o -name '*.dump.gz' -o -name '*.gz' \) -printf '%T@ %p\n' 2>/dev/null | sort -rn | head -1 | cut -d' ' -f2-)"
  if [[ -z "$LATEST" ]]; then
    LATEST="$(ls -t "$BACKUP_DIR"/*.gz 2>/dev/null | head -1 || true)"
  fi
  if [[ -n "$LATEST" && -f "$LATEST" ]]; then
    AGE_HOURS="$(find "$LATEST" -mmin +0 -printf '%T@\n' 2>/dev/null | awk -v now="$(date +%s)" '{printf "%.0f", (now - $1) / 3600}' || echo 999)"
    BASENAME="$(basename "$LATEST")"
    if [[ "${AGE_HOURS:-999}" -le "$MAX_BACKUP_HOURS" ]]; then
      pass "Último backup: $BASENAME (hace ~${AGE_HOURS}h)"
    else
      warn "Backup antiguo: $BASENAME (hace ~${AGE_HOURS}h, máx ${MAX_BACKUP_HOURS}h)"
    fi
  else
    warn "Sin archivos de backup en $BACKUP_DIR"
  fi
else
  warn "Directorio de backup no existe ($BACKUP_DIR) — normal en dev local"
fi

echo ""
echo "--- 5. Seguridad red (UFW / puertos / fail2ban) ---"
if command -v ufw >/dev/null 2>&1; then
  if ufw status 2>/dev/null | grep -qi 'Status: active'; then
    pass "UFW activo"
  else
    warn "UFW inactivo — ejecutar: sudo bash scripts/vps-harden-security.sh"
  fi
else
  warn "UFW no instalado"
fi

if command -v ss >/dev/null 2>&1; then
  BAD_PORTS="$(ss -tlnH 2>/dev/null | awk '$4 ~ /0\.0\.0\.0:/ || $4 ~ /\[::\]:/ {print}' | grep -E ':5432|:5433|:6379|:6380|:9000|:9002|:3000' || true)"
  if [[ -z "$BAD_PORTS" ]]; then
    pass "Puertos internos no expuestos en 0.0.0.0"
  else
    fail "Servicios expuestos públicamente — ejecutar hardening"
    echo "$BAD_PORTS" | sed 's/^/    /'
  fi
fi

if command -v fail2ban-client >/dev/null 2>&1; then
  if fail2ban-client status sshd >/dev/null 2>&1; then
    pass "Fail2ban jail sshd activo"
  else
    warn "Fail2ban sin jail sshd — revisar scripts/vps/fail2ban-jail.local"
  fi
else
  warn "Fail2ban no instalado (opcional pero recomendado)"
fi

if [[ -f "$ROOT/.env" ]]; then
  if grep -q '^APP_URL=' "$ROOT/.env" 2>/dev/null; then
    pass "APP_URL definido en .env"
  else
    warn "APP_URL ausente — anti-CSRF desactivado en prod"
  fi
fi

echo ""
echo "=== Resumen infra ==="
echo "PASS: $PASS | WARN: $WARN | FAIL: $FAIL"
echo ""

if [[ "$FAIL" -gt 0 ]]; then
  echo "❌ Infra con errores bloqueantes — corregir FAIL antes de confiar en prod."
  exit 1
fi
if [[ "$WARN" -gt 0 ]]; then
  echo "⚠️  Infra con advertencias — revisar WARN."
  exit 0
fi
echo "✅ Infra OK"
exit 0
