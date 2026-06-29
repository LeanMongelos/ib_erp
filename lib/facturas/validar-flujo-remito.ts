/**
 * Valida que un presupuesto siga el flujo remito → factura cuando corresponde.
 */
import { prisma } from '@/lib/prisma'

export async function mensajeFacturaRequiereRemito(params: {
  presupuestoId: string
  remitoId?: string | null
}): Promise<string | null> {
  if (params.remitoId) return null

  const pres = await prisma.presupuesto.findUnique({
    where: { id: params.presupuestoId },
    select: { otId: true },
  })
  if (!pres) return 'Presupuesto no encontrado'

  const ov = await prisma.ordenVenta.findUnique({
    where: { presupuestoId: params.presupuestoId },
    include: {
      remitos: { orderBy: { creadoEn: 'desc' } },
    },
  })

  const requiereRemito = Boolean(pres.otId || ov)
  if (!requiereRemito) return null

  if (!ov) {
    return 'Debe generar el remito de venta antes de facturar'
  }

  const emitido = ov.remitos.find((r) => r.estado === 'EMITIDO')
  if (emitido) {
    return `Debe facturar desde el remito emitido (${emitido.numero})`
  }

  if (ov.remitos.some((r) => r.estado === 'BORRADOR')) {
    return 'Debe asignar las series y emitir el remito antes de facturar'
  }

  return 'Debe generar y emitir el remito antes de facturar'
}

/** Remito emitido más reciente del presupuesto, si existe. */
export async function remitoEmitidoPresupuesto(presupuestoId: string) {
  const ov = await prisma.ordenVenta.findUnique({
    where: { presupuestoId },
    include: {
      remitos: {
        where: { estado: 'EMITIDO' },
        orderBy: { creadoEn: 'desc' },
        take: 1,
        select: { id: true, numero: true },
      },
    },
  })
  return ov?.remitos[0] ?? null
}
