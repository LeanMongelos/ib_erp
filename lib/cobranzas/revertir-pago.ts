/**
 * Reversión de pagos no-cheque (transferencia, efectivo, tarjeta, otro).
 * Los cheques usan lib/cobranzas/cheques.ts.
 */
import { prisma } from '@/lib/prisma'
import { ApiError } from '@/lib/api-auth'
import { revertirImputacionVencimientos } from '@/lib/cobranzas/vencimientos'
import { recalcularEstadoFacturaTrasReversion } from '@/lib/cobranzas/estado-factura-cobranza'
import { anularMovimientoPorPago } from '@/lib/tesoreria/movimientos'

const MEDIOS_REVERSIBLES = ['TRANSFERENCIA', 'EFECTIVO', 'TARJETA', 'OTRO'] as const

export async function revertirPagoNoCheque(pagoId: string) {
  const pago = await prisma.pago.findUnique({
    where: { id: pagoId },
    include: {
      imputaciones: true,
      cheque: true,
    },
  })

  if (!pago) throw new ApiError(404, 'Pago no encontrado')
  if (pago.anuladoEn) throw new ApiError(400, 'El pago ya está anulado')
  if (pago.medio === 'CHEQUE' || pago.cheque) {
    throw new ApiError(400, 'Los pagos con cheque se gestionan desde la cartera de cheques')
  }
  if (!(MEDIOS_REVERSIBLES as readonly string[]).includes(pago.medio)) {
    throw new ApiError(400, `No se puede revertir el medio de pago ${pago.medio}`)
  }

  const facturaIds = [...new Set(pago.imputaciones.map((i) => i.facturaId))]
  const facturas = await prisma.factura.findMany({
    where: { id: { in: facturaIds } },
    select: { id: true, numero: true, estado: true },
  })

  for (const f of facturas) {
    if (f.estado === 'ANULADA') {
      throw new ApiError(400, `La factura ${f.numero} está anulada`)
    }
    if (f.estado === 'PAGADA' && pago.imputaciones.some((i) => i.facturaId === f.id)) {
      // permitido: revertir es justamente para desbloquear anulación
    }
  }

  return prisma.$transaction(async (tx) => {
    for (const imp of pago.imputaciones) {
      await revertirImputacionVencimientos(imp.facturaId, imp.monto, tx)
      await recalcularEstadoFacturaTrasReversion(imp.facturaId, tx)
    }

    await anularMovimientoPorPago(pagoId, tx)

    const anulado = await tx.pago.update({
      where: { id: pagoId },
      data: { anuladoEn: new Date() },
      include: {
        cliente: { select: { nombre: true } },
        imputaciones: { include: { factura: { select: { numero: true } } } },
      },
    })

    return anulado
  })
}
