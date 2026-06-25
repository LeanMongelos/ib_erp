/**
 * Sincroniza presupuesto ERP con transiciones del embudo (venta ganada / cierre).
 */
import { prisma } from '@/lib/prisma'
import { ApiError } from '@/lib/api-auth'
import { calcularTotalesPresupuesto } from '@/lib/presupuestos/calcular-total-presupuesto'

const IVA = 21

function precioNetoDesdeTotal(montoTotal: number): number {
  return Math.round((montoTotal / (1 + IVA / 100)) * 100) / 100
}

/** Actualiza total del presupuesto vinculado y lo marca APROBADO al ganar el negocio. */
export async function aprobarPresupuestoNegocioGanado(
  presupuestoId: string,
  montoFinal: number,
): Promise<void> {
  const pres = await prisma.presupuesto.findUnique({
    where: { id: presupuestoId },
    include: { items: true, factura: true },
  })
  if (!pres) throw new ApiError(404, 'Presupuesto vinculado no encontrado')
  if (pres.factura) return

  const montoObjetivo = montoFinal > 0 ? montoFinal : pres.total
  const diff = Math.abs(montoObjetivo - pres.total)

  if (diff > 0.01 && pres.items.length > 0) {
    const item = pres.items[0]
    const precioNeto = precioNetoDesdeTotal(montoObjetivo)
    const { itemsCalculados, subtotal, iva, total, alicuotaIvaPct } = calcularTotalesPresupuesto({
      items: [{ descripcion: item.descripcion, cantidad: item.cantidad, precioUnit: precioNeto, inventarioId: item.inventarioId }],
      alicuotaIvaPct: pres.alicuotaIvaPct,
      condicionPago: pres.condicionPago,
    })

    await prisma.$transaction(async (tx) => {
      await tx.itemPresupuesto.deleteMany({ where: { presupuestoId } })
      await tx.presupuesto.update({
        where: { id: presupuestoId },
        data: {
          estado: 'APROBADO',
          subtotal,
          iva,
          total,
          alicuotaIvaPct,
          items: {
            create: itemsCalculados.map((i) => ({
              descripcion: i.descripcion,
              cantidad: i.cantidad,
              precioUnit: i.precioUnit,
              bonificacionPct: 0,
              alicuotaIvaPct: i.alicuotaIvaPct,
              subtotal: i.subtotal,
              inventarioId: i.inventarioId ?? null,
            })),
          },
        },
      })
    })
    return
  }

  if (pres.estado !== 'APROBADO') {
    await prisma.presupuesto.update({
      where: { id: presupuestoId },
      data: { estado: 'APROBADO' },
    })
  }
}

/** Valida y registra factura en datos del negocio al cerrar. */
export async function vincularFacturaNegocioCierre(opts: {
  presupuestoId: string | null
  clienteId: string | null
  facturaId?: string | null
  numeroFactura?: string | null
}): Promise<{ facturaId: string; numero: string }> {
  let factura = opts.facturaId
    ? await prisma.factura.findUnique({ where: { id: opts.facturaId } })
    : null

  if (!factura && opts.numeroFactura?.trim()) {
    factura = await prisma.factura.findFirst({
      where: { numero: opts.numeroFactura.trim() },
    })
  }

  if (!factura) {
    throw new ApiError(400, 'Seleccioná una factura del cliente o indicá un número válido')
  }

  if (opts.clienteId && factura.clienteId !== opts.clienteId) {
    throw new ApiError(400, 'La factura no pertenece al cliente del negocio')
  }

  if (opts.presupuestoId && factura.presupuestoId && factura.presupuestoId !== opts.presupuestoId) {
    throw new ApiError(400, 'La factura está vinculada a otro presupuesto')
  }

  if (opts.presupuestoId && !factura.presupuestoId) {
    await prisma.factura.update({
      where: { id: factura.id },
      data: { presupuestoId: opts.presupuestoId },
    })
    await prisma.presupuesto.update({
      where: { id: opts.presupuestoId },
      data: { estado: 'CONVERTIDO' },
    }).catch(() => null)
  }

  return { facturaId: factura.id, numero: factura.numero }
}
