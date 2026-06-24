#!/usr/bin/env bash
# Restauración PostgreSQL desde backup gzip (VPS producción).
#
# Uso:
#   bash scripts/vps-restore-postgres.sh --dry-run     # lista el backup más reciente
#   bash scripts/vps-restore-postgres.sh --restore     # restaura (DESTRUCTIVO — pide confirmación)
#
# Variables (mismas que vps-backup-postgres.sh):
#   BACKUP_DIR      — directorio de backups (default /var/backups/ibiomedica)
#   PG_CONTAINER    — contenedor Docker (default ibiomedica_db)
#   PG_USER         — usuario PostgreSQL (default admin)
#   PG_DB           — base de datos (default ibiomedica_db)
set -uo pipefail

BACKUP_DIR="${BACKUP_DIR:-/var/backups/ibiomedica}"
PG_CONTAINER="${PG_CONTAINER:-ibiomedica_db}"
PG_USER="${PG_USER:-admin}"
PG_DB="${PG_DB:-ibiomedica_db}"

usage() {
  cat <<EOF
Restauración PostgreSQL — iBiomédica ERP

Pasos documentados (disaster recovery):
  1. Detener app y workers para evitar escrituras concurrentes:
       pm2 stop ibiomedica worker-afip worker-cobranzas worker-crm-email worker-crm-graph
  2. Listar backup disponible:
       bash scripts/vps-restore-postgres.sh --dry-run
  3. Restaurar (sobrescribe la BD actual):
       bash scripts/vps-restore-postgres.sh --restore
  4. Reiniciar servicios:
       pm2 start ibiomedica worker-afip worker-cobranzas --update-env
  5. Verificar:
       curl -sf https://erp-ibiomedica.com.ar/api/health
       npm run go-live:check

Opciones:
  --dry-run   Muestra el backup más reciente sin modificar datos
  --restore   Restaura el backup más reciente (pide escribir RESTAURAR)
  -h, --help  Esta ayuda
EOF
}

latest_backup() {
  if [[ ! -d "$BACKUP_DIR" ]]; then
    echo "ERROR: directorio $BACKUP_DIR no existe" >&2
    return 1
  fi
  local f
  f="$(find "$BACKUP_DIR" -maxdepth 1 -name 'ibiomedica_*.sql.gz' -type f 2>/dev/null | sort -r | head -1)"
  if [[ -z "$f" ]]; then
    echo "ERROR: no hay backups en $BACKUP_DIR" >&2
    return 1
  fi
  echo "$f"
}

cmd_dry_run() {
  local f size
  f="$(latest_backup)" || exit 1
  size="$(du -h "$f" 2>/dev/null | cut -f1 || echo '?')"
  echo "==> Backup más reciente (dry-run)"
  echo "    Archivo: $f"
  echo "    Tamaño:  $size"
  echo "    Contenedor destino: $PG_CONTAINER / BD: $PG_DB"
  echo ""
  echo "Para restaurar: bash scripts/vps-restore-postgres.sh --restore"
}

cmd_restore() {
  if ! command -v docker >/dev/null 2>&1; then
    echo "ERROR: docker no disponible" >&2
    exit 1
  fi
  if ! docker ps --format '{{.Names}}' 2>/dev/null | grep -qx "$PG_CONTAINER"; then
    echo "ERROR: contenedor $PG_CONTAINER no está corriendo" >&2
    exit 1
  fi

  local f
  f="$(latest_backup)" || exit 1
  echo "ADVERTENCIA: esto SOBRESCRIBE la base $PG_DB en $PG_CONTAINER."
  echo "Backup: $f"
  echo -n "Escribí RESTAURAR para continuar: "
  read -r confirm
  if [[ "$confirm" != "RESTAURAR" ]]; then
    echo "Cancelado."
    exit 1
  fi

  echo "==> Restaurando..."
  if gunzip -c "$f" | docker exec -i "$PG_CONTAINER" psql -U "$PG_USER" -d "$PG_DB" -v ON_ERROR_STOP=1; then
    echo "OK: restauración completada desde $f"
  else
    echo "ERROR: falló la restauración" >&2
    exit 1
  fi
}

case "${1:-}" in
  --dry-run) cmd_dry_run ;;
  --restore) cmd_restore ;;
  -h|--help|"") usage ;;
  *)
    echo "Opción desconocida: $1" >&2
    usage
    exit 1
    ;;
esac
