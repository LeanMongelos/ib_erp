import { prisma } from '@/lib/prisma'

/** Marca facturas EMITIDA como VENCIDA si tienen cuota impaga vencida. Idempotente. */
export async function marcarFacturasVencidasPorCuota(): Promise<number> {
  const ahora = new Date()

  const rows = await prisma.vencimientoCobranza.findMany({
    where: {
      estado: { in: ['PENDIENTE', 'AVISO_ENVIADO'] },
      fechaVencimiento: { lt: ahora },
      factura: { estado: 'EMITIDA' },
    },
    select: { facturaId: true },
    distinct: ['facturaId'],
  })

  if (rows.length === 0) return 0

  const ids = rows.map((r) => r.facturaId)
  const result = await prisma.factura.updateMany({
    where: { id: { in: ids }, estado: 'EMITIDA' },
    data: { estado: 'VENCIDA' },
  })

  return result.count
}
