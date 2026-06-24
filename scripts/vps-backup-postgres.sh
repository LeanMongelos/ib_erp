#!/usr/bin/env bash
# Backup PostgreSQL (pg_dump + gzip) — retención configurable, fallo seguro para cron.
#
# Variables opcionales:
#   BACKUP_DIR      — directorio destino (default /var/backups/ibiomedica)
#   RETENTION_DAYS  — días a conservar (default 30)
#   PG_CONTAINER    — contenedor Docker (default ibiomedica_db)
#   PG_USER         — usuario PostgreSQL (default admin)
#   PG_DB           — base de datos (default ibiomedica_db)
#   LOG_FILE        — log (default /var/log/ibiomedica-backup.log)
set -uo pipefail

BACKUP_DIR="${BACKUP_DIR:-/var/backups/ibiomedica}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
PG_CONTAINER="${PG_CONTAINER:-ibiomedica_db}"
PG_USER="${PG_USER:-admin}"
PG_DB="${PG_DB:-ibiomedica_db}"
LOG_FILE="${LOG_FILE:-/var/log/ibiomedica-backup.log}"

log() {
  local msg="[$(date -Iseconds)] $*"
  echo "$msg" >>"$LOG_FILE" 2>/dev/null || echo "$msg"
}

if ! mkdir -p "$BACKUP_DIR" 2>/dev/null; then
  log "ERROR: no se pudo crear $BACKUP_DIR"
  exit 0
fi

if ! command -v docker >/dev/null 2>&1; then
  log "WARN: docker no disponible; omitiendo backup"
  exit 0
fi

if ! docker ps --format '{{.Names}}' 2>/dev/null | grep -qx "$PG_CONTAINER"; then
  log "WARN: contenedor $PG_CONTAINER no está corriendo; omitiendo backup"
  exit 0
fi

STAMP="$(date +%Y%m%d_%H%M%S)"
OUTFILE="${BACKUP_DIR}/ibiomedica_${STAMP}.sql.gz"

if docker exec "$PG_CONTAINER" pg_dump -U "$PG_USER" "$PG_DB" 2>>"$LOG_FILE" | gzip >"$OUTFILE"; then
  SIZE="$(du -h "$OUTFILE" 2>/dev/null | cut -f1 || echo '?')"
  log "OK: backup $OUTFILE ($SIZE)"
  find "$BACKUP_DIR" -name 'ibiomedica_*.sql.gz' -mtime +"$RETENTION_DAYS" -delete 2>>"$LOG_FILE" || true
else
  log "ERROR: pg_dump falló para $PG_DB"
  rm -f "$OUTFILE" 2>/dev/null || true
fi

exit 0
