import { prisma } from '@/lib/prisma'
import type { AlertaInbox } from '@/lib/notificaciones/generar-inbox-types'

export const CLAVE_ALERTA_SIN_SERIE_PREFIX = 'inventario.sin_serie:'

export function esAlertaInventarioPersistente(clave: string): boolean {
  return clave.startsWith(CLAVE_ALERTA_SIN_SERIE_PREFIX)
}

/** Unidades EN_STOCK serializables sin número de serie cargado. */
export async function alertasUnidadesSinSerie(): Promise<AlertaInbox[]> {
  const unidades = await prisma.inventarioUnidad.findMany({
    where: {
      estado: 'EN_STOCK',
      OR: [{ numeroSerie: null }, { numeroSerie: '' }],
      inventario: {
        activo: true,
        modoTrazabilidad: { in: ['SERIE', 'SERIE_Y_LOTE'] },
      },
    },
    select: {
      id: true,
      inventarioId: true,
      inventario: { select: { nombre: true, sku: true } },
    },
  })

  const porProducto = new Map<
    string,
    { nombre: string; sku: string | null; unidadIds: string[] }
  >()

  for (const u of unidades) {
    const prev = porProducto.get(u.inventarioId) ?? {
      nombre: u.inventario.nombre,
      sku: u.inventario.sku,
      unidadIds: [],
    }
    prev.unidadIds.push(u.id)
    porProducto.set(u.inventarioId, prev)
  }

  const ahora = new Date().toISOString()

  return [...porProducto.entries()].map(([inventarioId, g]) => ({
    clave: `${CLAVE_ALERTA_SIN_SERIE_PREFIX}${inventarioId}`,
    categoria: 'inventario' as const,
    prioridad: (g.unidadIds.length >= 2 ? 'urgente' : 'importante') as AlertaInbox['prioridad'],
    titulo: `Sin N° serie — ${g.nombre}`,
    mensaje: `${g.unidadIds.length} unidad(es) en stock sin serializar${g.sku ? ` · ${g.sku}` : ''}`,
    href: `/inventario?item=${inventarioId}&tab=unidades&unidad=${g.unidadIds[0] ?? ''}`,
    fecha: ahora,
    persistente: true,
  }))
}
