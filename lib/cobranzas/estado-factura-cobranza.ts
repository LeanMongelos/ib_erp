/**
 * Recalcula estado de factura tras revertir imputación (cheque rechazado/anulado o pago anulado).
 */
import type { Prisma } from '@prisma/client'

type Tx = Prisma.TransactionClient

export function resolverEstadoFacturaTrasReversion(tieneCuotaVencida: boolean): 'VENCIDA' | 'EMITIDA' {
  return tieneCuotaVencida ? 'VENCIDA' : 'EMITIDA'
}

export async function recalcularEstadoFacturaTrasReversion(facturaId: string, tx: Tx) {
  const vencida = await tx.vencimientoCobranza.count({
    where: {
      facturaId,
      estado: { in: ['PENDIENTE', 'AVISO_ENVIADO'] },
      fechaVencimiento: { lt: new Date() },
    },
  })

  const factura = await tx.factura.findUnique({
    where: { id: facturaId },
    include: {
      pagos: {
        where: {
          pago: {
            anuladoEn: null,
            OR: [
              { medio: { not: 'CHEQUE' } },
              { cheque: { estado: 'DEPOSITADO' } },
            ],
          },
        },
      },
    },
  })
  if (!factura) return

  const pagadoTotal = factura.pagos.reduce((a, p) => a + Number(p.monto), 0)
  if (pagadoTotal >= Number(factura.total) - 0.01) {
    await tx.factura.update({
      where: { id: facturaId },
      data: { estado: 'PAGADA', fechaPago: new Date() },
    })
    return
  }

  const nuevoEstado = resolverEstadoFacturaTrasReversion(vencida > 0)
  await tx.factura.update({
    where: { id: facturaId },
    data: { estado: nuevoEstado, fechaPago: null },
  })
}
