#!/usr/bin/env bash
# Smoke operador post go-live / primera factura real.
# Uso: npm run post-go-live:smoke  (o bash scripts/post-go-live-smoke.sh en el VPS)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo ""
echo "=== Post go-live smoke iBiomédica ==="
echo "Fecha: $(date '+%Y-%m-%d %H:%M:%S %Z' 2>/dev/null || date)"
echo ""

export FORCE_PROD=1

echo "--- 1. Checklist go-live (entorno + emisores + integridad) ---"
npm run go-live:check

echo ""
echo "--- 2. Smoke AFIP homologación (si hay emisor HOMOLOGACION con cert) ---"
if npm run smoke:afip-homolog; then
  echo "✅ Smoke AFIP homolog OK"
else
  ec=$?
  echo "⊘ Smoke AFIP homolog omitido o falló (código ${ec}) — normal si solo hay PRODUCCION"
fi

echo ""
echo "--- 3. Health HTTP ---"
APP_URL="${NEXTAUTH_URL:-http://127.0.0.1:3000}"
HEALTH_JSON="$(curl -sf "${APP_URL}/api/health" 2>/dev/null || true)"
if echo "$HEALTH_JSON" | grep -q '"ok"[[:space:]]*:[[:space:]]*true'; then
  echo "✅ Health OK — ${APP_URL}/api/health"
else
  echo "❌ Health falló — verificar que la app esté levantada (${APP_URL})"
  exit 1
fi

echo ""
echo "--- 4. Workers PM2 ---"
if command -v pm2 >/dev/null 2>&1; then
  pm2 jlist 2>/dev/null | node -e "
    const fs = require('fs');
    let raw = '';
    try { raw = fs.readFileSync(0, 'utf8'); } catch { process.exit(0); }
    if (!raw.trim()) { console.log('⊘ PM2 jlist vacío'); process.exit(0); }
    const list = JSON.parse(raw);
    const names = ['ibiomedica', 'worker-afip', 'worker-cobranzas', 'worker-crm-email', 'worker-crm-graph'];
    for (const n of names) {
      const p = list.find((x) => x.name === n);
      if (!p) { console.log('⊘', n, '— no registrado en PM2'); continue; }
      const st = p.pm2_env?.status ?? 'desconocido';
      console.log(st === 'online' ? '✅' : '⚠️ ', n + ':', st);
    }
  " || pm2 status || true
else
  echo "⊘ PM2 no disponible en este host"
fi

echo ""
echo "=== Post go-live smoke completado ==="
echo ""
