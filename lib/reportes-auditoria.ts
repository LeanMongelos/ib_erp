import { endOfDay, format, parseISO, startOfDay } from 'date-fns'
import { es } from 'date-fns/locale'
import { prisma } from '@/lib/prisma'
import { etiquetaAccion } from '@/lib/config/config-labels'

export const AUDITORIA_EXPORT_MAX_ROWS = 10_000

export type RangoAuditoria = {
  desde: Date
  hasta: Date
}

export function parseRangoAuditoria(
  desdeStr: string | null,
  hastaStr: string | null,
): RangoAuditoria | { error: string } {
  if (!desdeStr?.trim() || !hastaStr?.trim()) {
    return { error: 'Los parámetros "desde" y "hasta" son obligatorios (yyyy-MM-dd)' }
  }

  const parsedDesde = parseISO(desdeStr.trim())
  const parsedHasta = parseISO(hastaStr.trim())

  if (Number.isNaN(parsedDesde.getTime())) {
    return { error: 'Parámetro "desde" inválido (use yyyy-MM-dd)' }
  }
  if (Number.isNaN(parsedHasta.getTime())) {
    return { error: 'Parámetro "hasta" inválido (use yyyy-MM-dd)' }
  }

  const desde = startOfDay(parsedDesde)
  const hasta = endOfDay(parsedHasta)

  if (desde.getTime() > hasta.getTime()) {
    return { error: '"desde" no puede ser posterior a "hasta"' }
  }

  return { desde, hasta }
}

export async function obtenerAuditLogsRango(rango: RangoAuditoria) {
  const logs = await prisma.auditLog.findMany({
    where: {
      fecha: { gte: rango.desde, lte: rango.hasta },
    },
    orderBy: [{ fecha: 'desc' }, { id: 'desc' }],
    take: AUDITORIA_EXPORT_MAX_ROWS,
  })

  const usuarioIds = [...new Set(logs.map((l) => l.usuarioId).filter(Boolean))] as string[]
  const usuarios =
    usuarioIds.length > 0
      ? await prisma.usuario.findMany({
          where: { id: { in: usuarioIds } },
          select: { id: true, nombre: true, email: true },
        })
      : []
  const usuarioMap = new Map(usuarios.map((u) => [u.id, u]))

  return logs.map((l) => ({
    ...l,
    usuario: l.usuarioId ? usuarioMap.get(l.usuarioId) ?? null : null,
  }))
}

function escCsv(val: string | number | null | undefined): string {
  const s = val == null ? '' : String(val)
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

export function auditoriaToCsv(
  logs: Awaited<ReturnType<typeof obtenerAuditLogsRango>>,
  rango: RangoAuditoria,
): string {
  const labelDesde = format(rango.desde, 'yyyy-MM-dd')
  const labelHasta = format(rango.hasta, 'yyyy-MM-dd')
  const headers = [
    'Fecha',
    'Usuario',
    'Email',
    'Accion',
    'Accion legible',
    'Entidad',
    'Entidad ID',
    'IP',
  ]

  const rows = logs.map((l) =>
    [
      format(l.fecha, 'yyyy-MM-dd HH:mm:ss'),
      l.usuario?.nombre ?? 'Sistema',
      l.usuario?.email ?? '',
      l.accion,
      etiquetaAccion(l.accion),
      l.entidad,
      l.entidadId ?? '',
      l.ip ?? '',
    ]
      .map(escCsv)
      .join(','),
  )

  const meta = `# Auditoria ${labelDesde} a ${labelHasta} — ${logs.length} registro(s) (max ${AUDITORIA_EXPORT_MAX_ROWS})`

  return [meta, headers.join(','), ...rows].join('\n')
}

export function nombreArchivoAuditoria(rango: RangoAuditoria): string {
  const labelDesde = format(rango.desde, 'yyyy-MM-dd')
  const labelHasta = format(rango.hasta, 'yyyy-MM-dd')
  const mes = format(rango.desde, 'MMMM yyyy', { locale: es })
  return `auditoria-${labelDesde}_${labelHasta}-${mes.replace(/\s/g, '-')}.csv`
}
