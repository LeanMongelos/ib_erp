/**
 * Exportación Excel de logs del sistema (mismos filtros que GET /api/logs).
 */
import { NivelLog } from '@prisma/client'
import * as XLSX from 'xlsx'
import { etiquetaNivelLog, etiquetaOrigenLog } from '@/lib/config/config-labels'
import { LOG_RETENTION_DAYS, rangoDiaLocal } from '@/lib/error-log'
import { formatFechaHora } from '@/lib/utils'

export const LOGS_EXPORT_MAX = 5000

const NIVELES = Object.values(NivelLog)

export type LogsFilterParams = {
  q?: string
  nivel?: string
  origen?: string
  usuarioId?: string
  dia?: string
}

export type SystemLogExportRow = {
  id: string
  fecha: Date
  nivel: string
  origen: string
  ruta: string | null
  metodo: string | null
  mensaje: string
  stack: string | null
  ip: string | null
  metadata: unknown
  usuarioId: string | null
  usuario: { nombre: string; email: string } | null
}

export function parseLogsFilterParams(searchParams: URLSearchParams): LogsFilterParams {
  return {
    q: searchParams.get('q')?.trim() || undefined,
    nivel: searchParams.get('nivel')?.trim() || undefined,
    origen: searchParams.get('origen')?.trim() || undefined,
    usuarioId: searchParams.get('usuarioId')?.trim() || undefined,
    dia: searchParams.get('dia')?.trim() || undefined,
  }
}

/** Misma lógica de filtro que GET /api/logs. */
export function buildLogsWhere(params: LogsFilterParams): Record<string, unknown> {
  const desde = new Date()
  desde.setDate(desde.getDate() - LOG_RETENTION_DAYS)
  desde.setHours(0, 0, 0, 0)

  const where: Record<string, unknown> = { fecha: { gte: desde } }
  if (params.nivel && NIVELES.includes(params.nivel as NivelLog)) {
    where.nivel = params.nivel
  }
  if (params.origen) where.origen = params.origen
  if (params.usuarioId) where.usuarioId = params.usuarioId
  if (params.dia) where.fecha = rangoDiaLocal(params.dia)
  if (params.q) {
    where.OR = [
      { mensaje: { contains: params.q, mode: 'insensitive' } },
      { ruta: { contains: params.q, mode: 'insensitive' } },
      { origen: { contains: params.q, mode: 'insensitive' } },
      { stack: { contains: params.q, mode: 'insensitive' } },
    ]
  }
  return where
}

export function nombreArchivoLogsExport(params: LogsFilterParams): string {
  const parts = ['logs-sistema']
  if (params.dia) parts.push(params.dia)
  else parts.push(new Date().toISOString().slice(0, 10))
  if (params.nivel) parts.push(params.nivel.toLowerCase())
  if (params.origen) parts.push(params.origen.replace(/[^a-z0-9_-]/gi, '_'))
  return `${parts.join('-')}.xlsx`
}

function metadataTexto(metadata: unknown): string {
  if (metadata == null) return ''
  try {
    return JSON.stringify(metadata)
  } catch {
    return String(metadata)
  }
}

export function systemLogsToXlsx(
  logs: SystemLogExportRow[],
  meta?: { totalFiltrados: number; exportados: number },
): Buffer {
  const wb = XLSX.utils.book_new()

  const info: string[][] = [
    ['Logs del sistema — iBiomédica ERP'],
    [`Generado: ${formatFechaHora(new Date())}`],
    [
      meta
        ? `Exportados: ${meta.exportados} de ${meta.totalFiltrados} con filtros actuales (máx. ${LOGS_EXPORT_MAX})`
        : `Registros: ${logs.length}`,
    ],
    ['Columnas útiles para diagnóstico: mensaje, stack, metadata'],
    [],
  ]
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(info), 'info')

  const filas = logs.map((l) => ({
    fecha: formatFechaHora(l.fecha),
    nivel: etiquetaNivelLog(l.nivel),
    nivel_codigo: l.nivel,
    origen: etiquetaOrigenLog(l.origen),
    origen_codigo: l.origen,
    metodo: l.metodo ?? '',
    ruta: l.ruta ?? '',
    mensaje: l.mensaje,
    stack: l.stack ?? '',
    ip: l.ip ?? '',
    usuario: l.usuario?.nombre ?? '',
    email_usuario: l.usuario?.email ?? '',
    metadata: metadataTexto(l.metadata),
    id: l.id,
  }))

  const ws = XLSX.utils.json_to_sheet(filas)
  ws['!cols'] = [
    { wch: 18 },
    { wch: 12 },
    { wch: 10 },
    { wch: 14 },
    { wch: 14 },
    { wch: 8 },
    { wch: 28 },
    { wch: 50 },
    { wch: 40 },
    { wch: 14 },
    { wch: 22 },
    { wch: 22 },
    { wch: 36 },
    { wch: 28 },
  ]
  XLSX.utils.book_append_sheet(wb, ws, 'logs')

  return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }))
}
