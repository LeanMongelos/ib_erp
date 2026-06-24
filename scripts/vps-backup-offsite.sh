#!/usr/bin/env bash
# Copia el backup PostgreSQL más reciente a destino off-site (S3 o rsync).
# Ejecutar tras vps-backup-postgres.sh (cron 03:30).
#
# Variables (en .env o entorno):
#   BACKUP_DIR                  — origen local (default /var/backups/ibiomedica)
#   BACKUP_OFFSITE_RSYNC_TARGET — destino rsync, ej. user@backup:/ibiomedica/
#   BACKUP_OFFSITE_S3_BUCKET    — bucket S3 (requiere aws cli)
#   BACKUP_OFFSITE_S3_PREFIX    — prefijo en bucket (default ibiomedica/backups)
#   LOG_FILE                    — log (default /var/log/ibiomedica-backup.log)
#
# Prioridad: S3 si aws + bucket; si no, rsync; si ninguno, WARN y exit 0.
set -uo pipefail

BACKUP_DIR="${BACKUP_DIR:-/var/backups/ibiomedica}"
RSYNC_TARGET="${BACKUP_OFFSITE_RSYNC_TARGET:-${RSYNC_TARGET:-}}"
S3_BUCKET="${BACKUP_OFFSITE_S3_BUCKET:-${S3_BUCKET:-}}"
S3_PREFIX="${BACKUP_OFFSITE_S3_PREFIX:-${S3_PREFIX:-ibiomedica/backups}}"
LOG_FILE="${LOG_FILE:-/var/log/ibiomedica-backup.log}"

log() {
  local msg="[$(date -Iseconds)] [offsite] $*"
  echo "$msg" >>"$LOG_FILE" 2>/dev/null || echo "$msg"
}

if [[ ! -d "$BACKUP_DIR" ]]; then
  log "WARN: directorio $BACKUP_DIR inexistente — omitiendo off-site"
  exit 0
fi

LATEST=""
while IFS= read -r f; do
  LATEST="$f"
  break
done < <(find "$BACKUP_DIR" -maxdepth 1 -name 'ibiomedica_*.sql.gz' -type f -printf '%T@ %p\n' 2>/dev/null | sort -rn | head -1 | cut -d' ' -f2-)

if [[ -z "$LATEST" ]]; then
  LATEST="$(ls -t "$BACKUP_DIR"/ibiomedica_*.sql.gz 2>/dev/null | head -1 || true)"
fi

if [[ -z "$LATEST" || ! -f "$LATEST" ]]; then
  log "WARN: no hay dump local en $BACKUP_DIR — omitiendo off-site"
  exit 0
fi

BASENAME="$(basename "$LATEST")"

if [[ -n "$S3_BUCKET" ]] && command -v aws >/dev/null 2>&1; then
  DEST="s3://${S3_BUCKET%/}/${S3_PREFIX%/}/${BASENAME}"
  if aws s3 cp "$LATEST" "$DEST" >>"$LOG_FILE" 2>&1; then
    log "OK: subido a $DEST"
  else
    log "ERROR: aws s3 cp falló para $BASENAME"
  fi
  exit 0
fi

if [[ -n "$RSYNC_TARGET" ]]; then
  if command -v rsync >/dev/null 2>&1; then
    if rsync -az "$LATEST" "${RSYNC_TARGET%/}/" >>"$LOG_FILE" 2>&1; then
      log "OK: rsync $BASENAME → $RSYNC_TARGET"
    else
      log "ERROR: rsync falló hacia $RSYNC_TARGET"
    fi
  else
    log "WARN: rsync no instalado — no se pudo copiar off-site"
  fi
  exit 0
fi

log "WARN: off-site no configurado — definir BACKUP_OFFSITE_RSYNC_TARGET o BACKUP_OFFSITE_S3_BUCKET"
exit 0
