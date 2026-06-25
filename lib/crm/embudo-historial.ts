import type { EtapaEmbudo, Prisma, TipoEventoEmbudo } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import type { EtapaKey } from '@/lib/crm/embudo-constants'
import { etapaLabel } from '@/lib/crm/embudo-constants'

export type EventoEmbudoRow = {
  id: string
  tipo: TipoEventoEmbudo
  etapaDesde: EtapaEmbudo | null
  etapaHasta: EtapaEmbudo | null
  retroceso: boolean
  datos: unknown
  notas: string | null
  creadoEn: Date
  usuarioId: string | null
  usuario?: { id: string; nombre: string } | null
  negocio?: {
    id: string
    numero: number
    nombre: string
    cliente: string
    vendedor: string
    etapa: EtapaEmbudo
    activo: boolean
  } | null
}

export function etiquetaEventoEmbudo(row: Pick<EventoEmbudoRow, 'tipo' | 'etapaDesde' | 'etapaHasta' | 'retroceso'>): string {
  switch (row.tipo) {
    case 'CREACION':
      return 'Negocio creado'
    case 'EDICION':
      return 'Datos del negocio editados'
    case 'ELIMINACION':
      return 'Negocio eliminado del pipeline'
    case 'REACTIVACION':
      if (row.etapaDesde && row.etapaHasta && row.etapaDesde !== row.etapaHasta) {
        return `Negocio reactivado (${etapaLabel(row.etapaDesde as EtapaKey)} → ${etapaLabel(row.etapaHasta as EtapaKey)})`
      }
      return 'Negocio reactivado en el pipeline'
    case 'MOVIMIENTO':
    default:
      if (row.etapaHasta === 'PERDIDO') return 'Marcado como perdido'
      if (row.etapaHasta === 'CIERRE') return 'Negocio ganado (cierre)'
      if (row.etapaDesde && row.etapaHasta) {
        if (row.retroceso) {
          return `${etapaLabel(row.etapaDesde as EtapaKey)} → ${etapaLabel(row.etapaHasta as EtapaKey)} (retroceso)`
        }
        return `${etapaLabel(row.etapaDesde as EtapaKey)} → ${etapaLabel(row.etapaHasta as EtapaKey)}`
      }
      return 'Movimiento de etapa'
  }
}

export function mapEventoEmbudoDTO(h: EventoEmbudoRow) {
  return {
    id: h.id,
    tipo: h.tipo,
    fecha: h.creadoEn,
    movimiento: etiquetaEventoEmbudo(h),
    usuario: h.usuario?.nombre ?? 'Sistema',
    usuarioId: h.usuarioId,
    notas: h.notas,
    datos: h.datos,
    retroceso: h.retroceso,
    etapaDesde: h.etapaDesde,
    etapaHasta: h.etapaHasta,
    negocio: h.negocio
      ? {
          id: h.negocio.id,
          numero: h.negocio.numero,
          nombre: h.negocio.nombre,
          cliente: h.negocio.cliente,
          vendedor: h.negocio.vendedor,
          etapa: h.negocio.etapa,
          activo: h.negocio.activo,
        }
      : null,
  }
}

export async function registrarEventoEmbudo(data: {
  negocioId: string
  tipo: TipoEventoEmbudo
  etapaDesde?: EtapaEmbudo | null
  etapaHasta?: EtapaEmbudo | null
  retroceso?: boolean
  datos?: Record<string, unknown>
  notas?: string | null
  usuarioId?: string | null
}) {
  return prisma.historialEmbudo.create({
    data: {
      negocioId: data.negocioId,
      tipo: data.tipo,
      etapaDesde: data.etapaDesde ?? null,
      etapaHasta: data.etapaHasta ?? null,
      retroceso: data.retroceso ?? false,
      datos: (data.datos ?? {}) as Prisma.InputJsonValue,
      notas: data.notas ?? null,
      usuarioId: data.usuarioId ?? null,
    },
  })
}

const CAMPOS_EDICION = ['nombre', 'cliente', 'productoServicio', 'monto', 'vendedor', 'urgencia', 'notas', 'proximaAccionFecha'] as const

export function diffEdicionNegocio(
  antes: Record<string, unknown>,
  despues: Record<string, unknown>,
): Record<string, { antes: unknown; despues: unknown }> {
  const cambios: Record<string, { antes: unknown; despues: unknown }> = {}
  for (const k of CAMPOS_EDICION) {
    const a = antes[k]
    const d = despues[k]
    if (d === undefined) continue
    const aNorm = a instanceof Date ? a.toISOString() : a
    const dNorm = d instanceof Date ? d.toISOString() : d
    if (JSON.stringify(aNorm) !== JSON.stringify(dNorm)) {
      cambios[k] = { antes: aNorm ?? null, despues: dNorm ?? null }
    }
  }
  return cambios
}
