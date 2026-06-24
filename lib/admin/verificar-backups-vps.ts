/**
 * Verifica frescura de backups PostgreSQL en el VPS (dry-run lógico).
 * Equivalente a vps-restore-postgres.sh --dry-run con control de antigüedad.
 */

import fs from 'fs'
import path from 'path'

const BACKUP_GLOB_PREFIX = 'ibiomedica_'
const BACKUP_SUFFIX = '.sql.gz'

export type ResultadoVerificacionBackup = {
  ok: boolean
  mensaje: string
  archivo?: string
  diasDesdeUltimo?: number
}

function directorioBackups(): string {
  return process.env.BACKUP_DIR?.trim() || '/var/backups/ibiomedica'
}

function listarBackups(dir: string): string[] {
  if (!fs.existsSync(dir)) return []
  return fs
    .readdirSync(dir)
    .filter((f) => f.startsWith(BACKUP_GLOB_PREFIX) && f.endsWith(BACKUP_SUFFIX))
    .map((f) => path.join(dir, f))
}

export function verificarFreshnessBackupVps(maxDias = 7): ResultadoVerificacionBackup {
  const dir = directorioBackups()
  const archivos = listarBackups(dir)

  if (archivos.length === 0) {
    return {
      ok: false,
      mensaje: `Sin backups en ${dir} — ejecutar vps-backup-postgres.sh o revisar cron`,
    }
  }

  let masReciente = archivos[0]!
  let mtimeMs = 0

  for (const archivo of archivos) {
    try {
      const stat = fs.statSync(archivo)
      if (stat.mtimeMs > mtimeMs) {
        mtimeMs = stat.mtimeMs
        masReciente = archivo
      }
    } catch {
      /* omitir archivos inaccesibles */
    }
  }

  if (mtimeMs === 0) {
    return { ok: false, mensaje: `No se pudo leer metadata de backups en ${dir}` }
  }

  const diasDesdeUltimo = Math.floor((Date.now() - mtimeMs) / (24 * 60 * 60 * 1000))

  if (diasDesdeUltimo > maxDias) {
    return {
      ok: false,
      mensaje: `Último backup (${path.basename(masReciente)}) tiene ${diasDesdeUltimo} días — máximo ${maxDias}`,
      archivo: masReciente,
      diasDesdeUltimo,
    }
  }

  return {
    ok: true,
    mensaje: `Backup reciente OK: ${path.basename(masReciente)} (${diasDesdeUltimo} día(s))`,
    archivo: masReciente,
    diasDesdeUltimo,
  }
}
