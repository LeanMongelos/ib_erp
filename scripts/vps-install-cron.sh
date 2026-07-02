#!/usr/bin/env bash
# Instala /etc/cron.d/ibiomedica-cron en el VPS (requiere root).
# Ejecutar en el servidor: sudo bash scripts/vps-install-cron.sh
#
# Variables opcionales:
#   APP_DIR     — ruta del repo (default /opt/ibiomedica)
#   CRON_USER   — usuario Unix del cron (default: deploy si existe, si no root)
#   APP_URL     — URL pública HTTPS (default https://erp-ibiomedica.com.ar)
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/ibiomedica}"
# Usar 'deploy' solo si el usuario existe; si no, 'root' (evita cron muerto: un
# usuario inexistente hace que NINGUNA tarea programada corra, en silencio).
CRON_USER="${CRON_USER:-$(id deploy >/dev/null 2>&1 && echo deploy || echo root)}"
APP_URL="${APP_URL:-https://erp-ibiomedica.com.ar}"
CRON_FILE="/etc/cron.d/ibiomedica-cron"

if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
  echo "ERROR: ejecutá con sudo: sudo bash $0"
  exit 1
fi

if [[ ! -f "$APP_DIR/.env" ]]; then
  echo "ADVERTENCIA: no se encontró $APP_DIR/.env — asegurate de definir CRON_SECRET ahí."
fi

cat > "$CRON_FILE" <<EOF
# iBiomédica ERP — tareas programadas
# Generado por scripts/vps-install-cron.sh — no editar a mano sin respaldo.
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

# Backup PostgreSQL — diario 03:00 (fallo seguro, no rompe cron)
0 3 * * * ${CRON_USER} bash ${APP_DIR}/scripts/vps-backup-postgres.sh >> /var/log/ibiomedica-backup.log 2>&1

# Copia off-site del último dump — diario 03:30 (requiere BACKUP_OFFSITE_* en .env)
30 3 * * * ${CRON_USER} bash -c 'set -a; source ${APP_DIR}/.env; set +a; bash ${APP_DIR}/scripts/vps-backup-offsite.sh' >> /var/log/ibiomedica-backup.log 2>&1

# Purga logs técnicos (>15 días) — diario 04:00
0 4 * * * ${CRON_USER} cd ${APP_DIR} && npm run logs:purge >> /var/log/ibiomedica-cron.log 2>&1

# OT SLA vencidas — cada hora (HTTP con CRON_SECRET)
0 * * * * ${CRON_USER} bash -c 'set -a; source ${APP_DIR}/.env; set +a; curl -sf -X POST ${APP_URL}/api/cron/ots-vencidas -H "Authorization: Bearer \$CRON_SECRET"' >> /var/log/ibiomedica-cron.log 2>&1

# Presupuestos con vigencia vencida — diario 05:00
0 5 * * * ${CRON_USER} bash -c 'set -a; source ${APP_DIR}/.env; set +a; curl -sf -X POST ${APP_URL}/api/cron/presupuestos-vencidos -H "Authorization: Bearer \$CRON_SECRET"' >> /var/log/ibiomedica-cron.log 2>&1

# Vencimientos cobranza — diario 06:00
0 6 * * * ${CRON_USER} bash -c 'set -a; source ${APP_DIR}/.env; set +a; curl -sf -X POST ${APP_URL}/api/cron/cobranzas-vencimientos -H "Authorization: Bearer \$CRON_SECRET"' >> /var/log/ibiomedica-cron.log 2>&1

# Cuotas alquiler (generar mes + marcar vencidas) — diario 06:15
15 6 * * * ${CRON_USER} bash -c 'set -a; source ${APP_DIR}/.env; set +a; curl -sf -X POST ${APP_URL}/api/cron/alquiler-cuotas -H "Authorization: Bearer \$CRON_SECRET"' >> /var/log/ibiomedica-cron.log 2>&1

# Emails preventivo próximo — diario 06:30
30 6 * * * ${CRON_USER} bash -c 'set -a; source ${APP_DIR}/.env; set +a; curl -sf -X POST ${APP_URL}/api/cron/notificaciones-operativas -H "Authorization: Bearer \$CRON_SECRET"' >> /var/log/ibiomedica-cron.log 2>&1

# Alertas stock mínimo — diario 07:00
0 7 * * * ${CRON_USER} bash -c 'set -a; source ${APP_DIR}/.env; set +a; curl -sf -X POST ${APP_URL}/api/cron/stock-minimo -H "Authorization: Bearer \$CRON_SECRET"' >> /var/log/ibiomedica-cron.log 2>&1

# Resumen semanal admin — domingo 08:00
0 8 * * 0 ${CRON_USER} bash -c 'set -a; source ${APP_DIR}/.env; set +a; curl -sf -X POST ${APP_URL}/api/cron/resumen-semanal -H "Authorization: Bearer \$CRON_SECRET"' >> /var/log/ibiomedica-cron.log 2>&1
EOF

chmod 644 "$CRON_FILE"
echo "==> Escrito $CRON_FILE"
echo "    APP_DIR=$APP_DIR  CRON_USER=$CRON_USER  APP_URL=$APP_URL"
echo ""
echo "Genera /etc/cron.d/ibiomedica-cron con:"
echo "  - backup PostgreSQL (03:00) → scripts/vps-backup-postgres.sh"
echo "  - backup off-site (03:30) → scripts/vps-backup-offsite.sh (BACKUP_OFFSITE_* en .env)"
echo "  - logs:purge (04:00), OT SLA (cada hora), presupuestos (05:00), cobranzas (06:00), alquiler cuotas (06:15), notif. operativas (06:30), stock mínimo (07:00), resumen semanal (dom 08:00)"
echo ""
echo "Verificá CRON_SECRET en $APP_DIR/.env y probá manualmente:"
echo "  curl -sf -X POST ${APP_URL}/api/cron/ots-vencidas -H \"Authorization: Bearer \$CRON_SECRET\""
echo ""
echo "Alternativa local (sin HTTP):"
echo "  cd ${APP_DIR} && npm run cron:ots-vencidas"
echo "  cd ${APP_DIR} && npm run cron:presupuestos-vencidos"
echo "  cd ${APP_DIR} && npm run cron:alquiler-cuotas"
