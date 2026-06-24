/**
 * Cartera de cheques recibidos en cobranzas.
 * El cheque imputa deuda al recibirlo; la factura pasa a PAGADA solo al depositar.
 */
import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'
import { imputarPagoAVencimientos, revertirImputacionVencimientos } from '@/lib/cobranzas/vencimientos'
import { recalcularEstadoFacturaTrasReversion } from '@/lib/cobranzas/estado-factura-cobranza'

type Tx = Prisma.TransactionClient

export async function confirmarFacturasPagadasPorImputaciones(
  facturaIds: string[],
  tx: Tx,
) {
  for (const facturaId of facturaIds) {
    const factura = await tx.factura.findUnique({
      where: { id: facturaId },
      include: { pagos: true },
    })
    if (!factura) continue

    const pagadoTotal = factura.pagos.reduce((a, p) => a + Number(p.monto), 0)
    const chequesPendientes = await tx.chequeCobranza.count({
      where: {
        estado: 'EN_CARTERA',
        pago: { imputaciones: { some: { facturaId } } },
      },
    })

    if (chequesPendientes > 0) continue

    if (pagadoTotal >= Number(factura.total) - 0.01) {
      await tx.factura.update({
        where: { id: facturaId },
        data: { estado: 'PAGADA', fechaPago: new Date() },
      })
    }
  }
}

export async function marcarChequeDepositado(chequeId: string) {
  return prisma.$transaction(async (tx) => {
    const cheque = await tx.chequeCobranza.findUnique({
      where: { id: chequeId },
      include: { pago: { include: { imputaciones: true } } },
    })
    if (!cheque) throw new Error('Cheque no encontrado')
    if (cheque.estado !== 'EN_CARTERA') throw new Error('El cheque no está en cartera')

    await tx.chequeCobranza.update({
      where: { id: chequeId },
      data: { estado: 'DEPOSITADO', fechaDeposito: new Date() },
    })

    const facturaIds = cheque.pago.imputaciones.map((i) => i.facturaId)
    await confirmarFacturasPagadasPorImputaciones(facturaIds, tx)

    return tx.chequeCobranza.findUnique({
      where: { id: chequeId },
      include: {
        cliente: { select: { nombre: true } },
        pago: { include: { imputaciones: { include: { factura: { select: { numero: true } } } } } },
      },
    })
  })
}

export async function marcarChequeRechazado(chequeId: string) {
  return prisma.$transaction(async (tx) => {
    const cheque = await tx.chequeCobranza.findUnique({
      where: { id: chequeId },
      include: { pago: { include: { imputaciones: true } } },
    })
    if (!cheque) throw new Error('Cheque no encontrado')
    if (cheque.estado !== 'EN_CARTERA') throw new Error('El cheque no está en cartera')

    for (const imp of cheque.pago.imputaciones) {
      await revertirImputacionVencimientos(imp.facturaId, imp.monto, tx)
      await recalcularEstadoFacturaTrasReversion(imp.facturaId, tx)
    }

    await tx.chequeCobranza.update({
      where: { id: chequeId },
      data: { estado: 'RECHAZADO' },
    })

    return cheque
  })
}

export async function marcarChequeAnulado(chequeId: string) {
  return prisma.$transaction(async (tx) => {
    const cheque = await tx.chequeCobranza.findUnique({
      where: { id: chequeId },
      include: { pago: { include: { imputaciones: true } } },
    })
    if (!cheque) throw new Error('Cheque no encontrado')
    if (cheque.estado !== 'EN_CARTERA') throw new Error('El cheque no está en cartera')

    for (const imp of cheque.pago.imputaciones) {
      await revertirImputacionVencimientos(imp.facturaId, imp.monto, tx)
      await recalcularEstadoFacturaTrasReversion(imp.facturaId, tx)
    }

    await tx.chequeCobranza.update({
      where: { id: chequeId },
      data: { estado: 'ANULADO' },
    })

    return cheque
  })
}

async function validarChequeUnico(
  numero: string,
  banco: string | null | undefined,
  tx: Tx,
) {
  const bancoNorm = (banco ?? '').trim()
  const existente = await tx.chequeCobranza.findFirst({
    where: {
      numero: numero.trim(),
      banco: bancoNorm,
      estado: { in: ['EN_CARTERA', 'DEPOSITADO'] },
    },
  })
  if (existente) {
    throw new Error(`Ya existe un cheque activo con número ${numero} en ${bancoNorm || 'sin banco'}`)
  }
}

export async function crearChequeConPago(
  data: {
    clienteId: string
    monto: number
    referencia?: string | null
    notas?: string | null
    imputaciones: Array<{ facturaId: string; monto: number }>
    cheque: {
      numero: string
      banco?: string | null
      titular?: string | null
      fechaVencimiento: Date
    }
  },
  tx: Tx,
) {
  await validarChequeUnico(data.cheque.numero, data.cheque.banco, tx)

  const nuevo = await tx.pago.create({
    data: {
      clienteId: data.clienteId,
      monto: data.monto,
      medio: 'CHEQUE',
      referencia: data.referencia ?? data.cheque.numero,
      notas: data.notas ?? null,
      imputaciones: {
        create: data.imputaciones.map((i) => ({
          facturaId: i.facturaId,
          monto: i.monto,
        })),
      },
    },
    include: {
      cliente: true,
      imputaciones: { include: { factura: true } },
    },
  })

  await tx.chequeCobranza.create({
    data: {
      pagoId: nuevo.id,
      clienteId: data.clienteId,
      numero: data.cheque.numero,
      banco: (data.cheque.banco ?? '').trim(),
      titular: data.cheque.titular ?? null,
      monto: data.monto,
      fechaVencimiento: data.cheque.fechaVencimiento,
    },
  })

  for (const imp of data.imputaciones) {
    await imputarPagoAVencimientos(imp.facturaId, imp.monto, tx)
  }

  return nuevo
}
