import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'
import {
  calcularFechaVencimiento,
  formatCondicionPago,
  repartirMontoCuotas,
} from '@/lib/cobranzas/plazos'

type Tx = Prisma.TransactionClient

export async function sincronizarVencimientosCobranza(
  facturaId: string,
  plazosDias: number[],
  tx?: Tx,
) {
  const db = tx ?? prisma
  if (plazosDias.length === 0) return []

  const factura = await db.factura.findUnique({ where: { id: facturaId } })
  if (!factura) throw new Error('Factura no encontrada')

  await db.vencimientoCobranza.deleteMany({
    where: {
      facturaId,
      estado: { in: ['PENDIENTE', 'AVISO_ENVIADO'] },
    },
  })

  const montos = repartirMontoCuotas(Number(factura.total), plazosDias.length)
  const fechaEmision = factura.fechaEmision

  await db.vencimientoCobranza.createMany({
    data: plazosDias.map((dias, i) => ({
      facturaId,
      numeroCuota: i + 1,
      diasDesdeEmision: dias,
      fechaVencimiento: calcularFechaVencimiento(fechaEmision, dias),
      monto: montos[i],
      estado: 'PENDIENTE' as const,
    })),
  })

  const ultimoVenc = calcularFechaVencimiento(
    fechaEmision,
    plazosDias[plazosDias.length - 1],
  )

  await db.factura.update({
    where: { id: facturaId },
    data: {
      fechaVencimiento: ultimoVenc,
      condicionPago: formatCondicionPago(plazosDias),
    },
  })

  return db.vencimientoCobranza.findMany({
    where: { facturaId },
    orderBy: { numeroCuota: 'asc' },
  })
}

export async function imputarPagoAVencimientos(
  facturaId: string,
  montoPagado: number,
  tx?: Tx,
) {
  const db = tx ?? prisma
  let restante = montoPagado

  const vencimientos = await db.vencimientoCobranza.findMany({
    where: {
      facturaId,
      estado: { in: ['PENDIENTE', 'AVISO_ENVIADO'] },
    },
    orderBy: { numeroCuota: 'asc' },
  })

  for (const v of vencimientos) {
    if (restante <= 0.009) break
    if (restante >= Number(v.monto) - 0.01) {
      await db.vencimientoCobranza.update({
        where: { id: v.id },
        data: { estado: 'COBRADO', cobradoEn: new Date() },
      })
      restante -= Number(v.monto)
    }
  }
}

export async function anularVencimientosPendientes(facturaId: string, tx?: Tx) {
  const db = tx ?? prisma
  await db.vencimientoCobranza.updateMany({
    where: {
      facturaId,
      estado: { in: ['PENDIENTE', 'AVISO_ENVIADO'] },
    },
    data: { estado: 'ANULADO' },
  })
}
