import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'
import { ApiError } from '@/lib/api-auth'
import { resolverCuentaTesoreriaParaPago } from '@/lib/tesoreria/cuenta-default'
import {
  anularMovimientoPorPagoProveedor,
  registrarEgresoDesdePagoProveedor,
} from '@/lib/tesoreria/registrar-egreso-pago-proveedor'
import { imputarMontoAVencimiento, revertirImputacionVencimiento } from '@/lib/compras/imputacion-vencimiento'
import { anularChequeEmitido, crearChequeEmitido } from '@/lib/compras/cheque-emitido'
import { validarMonedaUnicaImputaciones } from '@/lib/compras/moneda-compra'
import { evaluarPagoCompletoOc, registrarEventoPagoOc } from '@/lib/compras/oc-workflow/hooks'

export const pagoProveedorInclude = {
  proveedor: { select: { id: true, razonSocial: true, cuit: true } },
  facturaCompra: { select: { id: true, numero: true, total: true } },
  cuentaTesoreria: { select: { id: true, nombre: true, tipo: true } },
  creadoPor: { select: { id: true, nombre: true } },
  imputaciones: {
    include: {
      vencimientoPago: {
        include: { facturaCompra: { select: { id: true, numero: true } } },
      },
    },
  },
  chequeEmitido: true,
  movimientoTesoreria: { select: { id: true, tipo: true, monto: true, anuladoEn: true } },
} satisfies Prisma.PagoProveedorInclude

export interface ImputacionPagoInput {
  vencimientoPagoId: string
  monto: number
}

export interface RegistrarPagoProveedorInput {
  proveedorId: string
  monto: number
  moneda?: string
  fecha?: Date
  medio: 'TRANSFERENCIA' | 'EFECTIVO' | 'CHEQUE' | 'TARJETA' | 'OTRO'
  cuentaTesoreriaId?: string | null
  referencia?: string | null
  notas?: string | null
  facturaCompraId?: string | null
  imputaciones: ImputacionPagoInput[]
  cheque?: {
    numero: string
    banco?: string | null
    fechaEmision?: Date
    fechaDebito?: Date | null
  }
}

async function validarImputaciones(
  proveedorId: string,
  montoPago: number,
  imputaciones: ImputacionPagoInput[],
  monedaPago: string | undefined,
  tx: Prisma.TransactionClient,
): Promise<{ vencimientos: Awaited<ReturnType<typeof tx.vencimientoPago.findMany>>; moneda: string }> {
  if (imputaciones.length === 0) {
    throw new ApiError(400, 'Indicá al menos una imputación')
  }

  const montoImputado = imputaciones.reduce((a, i) => a + i.monto, 0)
  if (Math.abs(montoImputado - montoPago) > 0.01) {
    throw new ApiError(400, 'La suma de imputaciones debe coincidir con el monto del pago')
  }

  const vencIds = imputaciones.map((i) => i.vencimientoPagoId)
  const vencimientos = await tx.vencimientoPago.findMany({
    where: { id: { in: vencIds } },
    include: {
      facturaCompra: {
        select: { id: true, proveedorId: true, estado: true, numero: true, moneda: true },
      },
    },
  })

  if (vencimientos.length !== vencIds.length) {
    throw new ApiError(400, 'Uno o más vencimientos no existen')
  }

  for (const imp of imputaciones) {
    const venc = vencimientos.find((v) => v.id === imp.vencimientoPagoId)!
    if (venc.facturaCompra.proveedorId !== proveedorId) {
      throw new ApiError(400, `El vencimiento de ${venc.facturaCompra.numero} no pertenece al proveedor`)
    }
    if (venc.facturaCompra.estado !== 'REGISTRADA') {
      throw new ApiError(400, `La factura ${venc.facturaCompra.numero} no está registrada`)
    }
    if (imp.monto > venc.saldo + 0.01) {
      throw new ApiError(400, `El monto excede el saldo de ${venc.facturaCompra.numero}`)
    }
  }

  const monedas = vencimientos.map((v) => v.facturaCompra.moneda || 'ARS')
  const errorMoneda = validarMonedaUnicaImputaciones(monedas, monedaPago)
  if (errorMoneda) throw new ApiError(400, errorMoneda)

  const moneda = monedaPago ?? monedas[0] ?? 'ARS'

  return { vencimientos, moneda }
}

export async function registrarPagoProveedor(actorId: string, input: RegistrarPagoProveedorInput) {
  const proveedor = await prisma.proveedor.findFirst({
    where: { id: input.proveedorId, activo: true },
  })
  if (!proveedor) throw new ApiError(404, 'Proveedor no encontrado o inactivo')

  if (input.medio === 'CHEQUE' && !input.cheque?.numero?.trim()) {
    throw new ApiError(400, 'Completá los datos del cheque')
  }

  if (input.medio !== 'CHEQUE' && input.cuentaTesoreriaId) {
    await resolverCuentaTesoreriaParaPago(input.medio, input.cuentaTesoreriaId)
  }

  if (input.medio === 'CHEQUE' && input.cuentaTesoreriaId) {
    await resolverCuentaTesoreriaParaPago('CHEQUE', input.cuentaTesoreriaId)
  }

  const fecha = input.fecha ?? new Date()
  if (Number.isNaN(fecha.getTime())) throw new ApiError(400, 'Fecha inválida')

  return prisma.$transaction(async (tx) => {
    const { moneda } = await validarImputaciones(
      input.proveedorId,
      input.monto,
      input.imputaciones,
      input.moneda,
      tx,
    )

    const primeraFcId = (
      await tx.vencimientoPago.findUnique({
        where: { id: input.imputaciones[0].vencimientoPagoId },
        select: { facturaCompraId: true },
      })
    )?.facturaCompraId

    const pago = await tx.pagoProveedor.create({
      data: {
        proveedorId: input.proveedorId,
        facturaCompraId: input.facturaCompraId ?? primeraFcId ?? null,
        monto: input.monto,
        moneda,
        fecha,
        medio: input.medio,
        cuentaTesoreriaId: input.medio !== 'CHEQUE' ? input.cuentaTesoreriaId ?? null : input.cuentaTesoreriaId ?? null,
        referencia: input.referencia?.trim() || null,
        notas: input.notas?.trim() || null,
        creadoPorId: actorId,
        imputaciones: {
          create: input.imputaciones.map((i) => ({
            vencimientoPagoId: i.vencimientoPagoId,
            monto: i.monto,
          })),
        },
      },
    })

    for (const imp of input.imputaciones) {
      await imputarMontoAVencimiento(imp.vencimientoPagoId, imp.monto, tx)
    }

    if (input.medio === 'CHEQUE') {
      const cuentaId = input.cuentaTesoreriaId
      if (!cuentaId) throw new ApiError(400, 'Seleccioná la cuenta bancaria para el cheque')
      await crearChequeEmitido(
        {
          pagoProveedorId: pago.id,
          proveedorId: input.proveedorId,
          numero: input.cheque!.numero,
          banco: input.cheque!.banco,
          monto: input.monto,
          fechaEmision: input.cheque!.fechaEmision ?? fecha,
          fechaDebito: input.cheque!.fechaDebito ?? null,
          cuentaTesoreriaId: cuentaId,
        },
        tx,
      )
    } else {
      await registrarEgresoDesdePagoProveedor(pago.id, actorId, tx, input.cuentaTesoreriaId)
    }

    const vencimientosOc = await tx.vencimientoPago.findMany({
      where: { id: { in: input.imputaciones.map((i) => i.vencimientoPagoId) } },
      select: { facturaCompra: { select: { ordenCompraId: true } } },
    })
    const ocIds = [
      ...new Set(
        vencimientosOc.map((v) => v.facturaCompra?.ordenCompraId).filter((id): id is string => Boolean(id)),
      ),
    ]
    for (const ordenCompraId of ocIds) {
      const completo = await evaluarPagoCompletoOc(ordenCompraId, tx)
      await registrarEventoPagoOc(ordenCompraId, pago.id, input.monto, actorId, completo, tx)
    }

    return tx.pagoProveedor.findUnique({
      where: { id: pago.id },
      include: pagoProveedorInclude,
    })
  })
}

export async function anularPagoProveedor(actorId: string, pagoId: string) {
  return prisma.$transaction(async (tx) => {
    const pago = await tx.pagoProveedor.findUnique({
      where: { id: pagoId },
      include: {
        imputaciones: true,
        chequeEmitido: true,
        movimientoTesoreria: true,
      },
    })
    if (!pago) throw new ApiError(404, 'Pago a proveedor no encontrado')
    if (pago.estado === 'ANULADO' || pago.anuladoEn) {
      throw new ApiError(400, 'El pago ya está anulado')
    }

    if (pago.chequeEmitido?.estado === 'DEBITADO') {
      throw new ApiError(400, 'No se puede anular un pago con cheque ya debitado')
    }

    for (const imp of pago.imputaciones) {
      await revertirImputacionVencimiento(imp.vencimientoPagoId, imp.monto, tx)
    }

    await anularMovimientoPorPagoProveedor(pagoId, tx)

    if (pago.chequeEmitido && pago.chequeEmitido.estado === 'EMITIDO') {
      await tx.chequeEmitido.update({
        where: { id: pago.chequeEmitido.id },
        data: { estado: 'ANULADO' },
      })
    }

    return tx.pagoProveedor.update({
      where: { id: pagoId },
      data: {
        estado: 'ANULADO',
        anuladoEn: new Date(),
        creadoPorId: pago.creadoPorId || actorId,
      },
      include: pagoProveedorInclude,
    })
  })
}

export async function listarPagosProveedor(filtros?: {
  proveedorId?: string
  estado?: 'REGISTRADO' | 'ANULADO'
}) {
  return prisma.pagoProveedor.findMany({
    where: {
      ...(filtros?.proveedorId && { proveedorId: filtros.proveedorId }),
      ...(filtros?.estado && { estado: filtros.estado }),
    },
    orderBy: { fecha: 'desc' },
    include: pagoProveedorInclude,
  })
}

export async function obtenerPagoProveedor(id: string) {
  const pago = await prisma.pagoProveedor.findUnique({
    where: { id },
    include: pagoProveedorInclude,
  })
  if (!pago) throw new ApiError(404, 'Pago a proveedor no encontrado')
  return pago
}
