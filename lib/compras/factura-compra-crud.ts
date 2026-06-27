import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { ApiError } from '@/lib/api-auth'
import { crearConNumeroUnico, siguienteNumeroFacturaCompra } from '@/lib/sequences'
import {
  calcularFechaVencimientoDefault,
  calcularTotalesFacturaCompra,
  derivarRecepcionCompleta,
  puedeAnularFacturaCompra,
  puedeEditarFacturaCompra,
  puedeRegistrarFacturaCompra,
  validarReglasFacturaCompra,
  type LineaFacturaCompraInput,
} from '@/lib/compras/factura-compra'
import { cuotaUnicaDefault, validarSumaCuotas, type CuotaPagoInput } from '@/lib/compras/cuotas-ap'
import { requiereConstatacionParaRegistrar } from '@/lib/compras/config'
import { registrarEventoFcOc } from '@/lib/compras/oc-workflow/hooks'

export const fcInclude = {
  proveedor: { select: { id: true, razonSocial: true, cuit: true, tipoCompra: true, moneda: true } },
  ordenCompra: { select: { id: true, numero: true, estado: true, moneda: true } },
  tipoComprobanteAfip: { select: { id: true, codigoAfip: true, letra: true, descripcion: true } },
  creadoPor: { select: { id: true, nombre: true } },
  items: true,
  vencimientos: { orderBy: { numeroCuota: 'asc' as const } },
} satisfies Prisma.FacturaCompraInclude

export interface CrearFacturaCompraInput {
  proveedorId: string
  tipo: 'REMITO' | 'CONCEPTOS'
  fecha: Date
  fechaVencimiento?: Date | null
  puntoVenta: number
  numeroComprobante: number
  tipoComprobanteAfipId?: string | null
  moneda?: string
  ordenCompraId?: string | null
  fcSinRecepcion?: boolean
  notaFcSinRecepcion?: string | null
  notaMonedaOc?: string | null
  cae?: string | null
  caeVencimiento?: Date | null
  items: LineaFacturaCompraInput[]
  cuotas?: CuotaPagoInput[]
  registrar?: boolean
}

async function cargarOc(ordenCompraId: string | null | undefined) {
  if (!ordenCompraId) return null
  return prisma.ordenCompra.findUnique({
    where: { id: ordenCompraId },
    include: { items: true },
  })
}

async function validarProveedorYOc(
  proveedorId: string,
  tipo: CrearFacturaCompraInput['tipo'],
  ordenCompraId: string | null | undefined,
  fcSinRecepcion?: boolean,
  notaFcSinRecepcion?: string | null,
  moneda?: string,
  notaMonedaOc?: string | null,
) {
  const proveedor = await prisma.proveedor.findFirst({ where: { id: proveedorId, activo: true } })
  if (!proveedor) throw new ApiError(404, 'Proveedor no encontrado o inactivo')

  const oc = await cargarOc(ordenCompraId)
  if (ordenCompraId && !oc) throw new ApiError(404, 'Orden de compra no encontrada')
  if (oc && oc.proveedorId !== proveedorId) {
    throw new ApiError(400, 'La orden de compra no pertenece al proveedor seleccionado')
  }

  const errorRegla = validarReglasFacturaCompra({
    tipo,
    ordenCompraId,
    fcSinRecepcion,
    notaFcSinRecepcion,
    moneda: moneda ?? oc?.moneda ?? proveedor.moneda ?? 'ARS',
    notaMonedaOc,
    oc: oc
      ? { id: oc.id, proveedorId: oc.proveedorId, estado: oc.estado, moneda: oc.moneda, items: oc.items }
      : null,
  })
  if (errorRegla) throw new ApiError(400, errorRegla)

  return { proveedor, oc }
}

function mapItemsCreate(itemsCalc: ReturnType<typeof calcularTotalesFacturaCompra>['itemsCalc']) {
  return itemsCalc.map((i) => ({
    descripcion: i.descripcion,
    concepto: i.concepto ?? null,
    cantidad: i.cantidad,
    precioUnitario: i.precioUnitario,
    precioLista: i.precioLista ?? null,
    bonificacionPct: i.bonificacionPct ?? 0,
    alicuotaIvaPct: i.alicuotaIvaPct ?? 21,
    neto: i.neto,
    iva: i.iva,
    inventarioId: i.inventarioId ?? null,
    itemOrdenCompraId: i.itemOrdenCompraId ?? null,
  }))
}

function resolverCuotas(
  total: number,
  fecha: Date,
  fechaVencimiento: Date | null | undefined,
  cuotasInput?: CuotaPagoInput[],
): CuotaPagoInput[] {
  if (cuotasInput?.length) {
    if (!validarSumaCuotas(cuotasInput, total)) {
      throw new ApiError(400, 'La suma de cuotas debe coincidir con el total de la factura')
    }
    return cuotasInput
  }
  const fv = calcularFechaVencimientoDefault(fecha, fechaVencimiento)
  return cuotaUnicaDefault(fv, total)
}

async function sincronizarVencimientosBorrador(
  tx: Prisma.TransactionClient,
  facturaCompraId: string,
  cuotas: CuotaPagoInput[],
) {
  await tx.vencimientoPago.deleteMany({ where: { facturaCompraId } })
  await tx.vencimientoPago.createMany({
    data: cuotas.map((c) => ({
      facturaCompraId,
      numeroCuota: c.numeroCuota,
      fecha: c.fecha,
      monto: c.monto,
      saldo: c.monto,
      pagado: false,
    })),
  })
}

export async function crearFacturaCompra(actorId: string, input: CrearFacturaCompraInput) {
  const { proveedor, oc } = await validarProveedorYOc(
    input.proveedorId,
    input.tipo,
    input.ordenCompraId,
    input.fcSinRecepcion,
    input.notaFcSinRecepcion,
    input.moneda,
    input.notaMonedaOc,
  )

  const monedaFc = input.moneda ?? oc?.moneda ?? proveedor.moneda ?? 'ARS'

  const { neto, iva, total, itemsCalc } = calcularTotalesFacturaCompra(input.items)
  const recepcionCompleta = derivarRecepcionCompleta(oc?.items) || input.fcSinRecepcion === true
  const cuotas = resolverCuotas(total, input.fecha, input.fechaVencimiento, input.cuotas)

  const fc = await crearConNumeroUnico(
    siguienteNumeroFacturaCompra,
    (numero) =>
      prisma.$transaction(async (tx) => {
        const created = await tx.facturaCompra.create({
          data: {
            numero,
            proveedorId: input.proveedorId,
            tipo: input.tipo,
            estado: 'BORRADOR',
            fecha: input.fecha,
            fechaVencimiento: input.fechaVencimiento ?? null,
            puntoVenta: input.puntoVenta,
            numeroComprobante: input.numeroComprobante,
            tipoComprobanteAfipId: input.tipoComprobanteAfipId ?? null,
            neto,
            iva,
            total,
            moneda: monedaFc,
            ordenCompraId: input.ordenCompraId ?? null,
            recepcionCompleta,
            fcSinRecepcion: input.fcSinRecepcion ?? false,
            notaFcSinRecepcion: input.notaFcSinRecepcion?.trim() || null,
            notaMonedaOc: input.notaMonedaOc?.trim() || null,
            cae: input.cae?.trim() || null,
            caeVencimiento: input.caeVencimiento ?? null,
            creadoPorId: actorId,
            items: { create: mapItemsCreate(itemsCalc) },
          },
          include: fcInclude,
        })
        await sincronizarVencimientosBorrador(tx, created.id, cuotas)
        return tx.facturaCompra.findUniqueOrThrow({ where: { id: created.id }, include: fcInclude })
      }),
  )

  if (input.registrar) {
    return registrarFacturaCompra(actorId, fc.id)
  }
  return fc
}

export async function actualizarFacturaCompraBorrador(
  id: string,
  input: Omit<CrearFacturaCompraInput, 'registrar'>,
) {
  const existente = await prisma.facturaCompra.findUnique({ where: { id }, include: { items: true } })
  if (!existente) throw new ApiError(404, 'Factura de compra no encontrada')
  if (!puedeEditarFacturaCompra(existente.estado)) {
    throw new ApiError(400, 'Solo se pueden editar facturas en borrador')
  }

  const { proveedor, oc } = await validarProveedorYOc(
    input.proveedorId,
    input.tipo,
    input.ordenCompraId,
    input.fcSinRecepcion,
    input.notaFcSinRecepcion,
    input.moneda,
    input.notaMonedaOc,
  )

  const monedaFc = input.moneda ?? oc?.moneda ?? proveedor.moneda ?? 'ARS'

  const { neto, iva, total, itemsCalc } = calcularTotalesFacturaCompra(input.items)
  const recepcionCompleta = derivarRecepcionCompleta(oc?.items) || input.fcSinRecepcion === true
  const cuotas = resolverCuotas(total, input.fecha, input.fechaVencimiento, input.cuotas)

  return prisma.$transaction(async (tx) => {
    await tx.itemFacturaCompra.deleteMany({ where: { facturaCompraId: id } })
    const fc = await tx.facturaCompra.update({
      where: { id },
      data: {
        proveedorId: input.proveedorId,
        tipo: input.tipo,
        fecha: input.fecha,
        fechaVencimiento: input.fechaVencimiento ?? null,
        puntoVenta: input.puntoVenta,
        numeroComprobante: input.numeroComprobante,
        tipoComprobanteAfipId: input.tipoComprobanteAfipId ?? null,
        neto,
        iva,
        total,
        moneda: monedaFc,
        ordenCompraId: input.ordenCompraId ?? null,
        recepcionCompleta,
        fcSinRecepcion: input.fcSinRecepcion ?? false,
        notaFcSinRecepcion: input.notaFcSinRecepcion?.trim() || null,
        notaMonedaOc: input.notaMonedaOc?.trim() || null,
        cae: input.cae?.trim() || null,
        caeVencimiento: input.caeVencimiento ?? null,
        items: { create: mapItemsCreate(itemsCalc) },
      },
      include: fcInclude,
    })
    await sincronizarVencimientosBorrador(tx, id, cuotas)
    return tx.facturaCompra.findUniqueOrThrow({ where: { id }, include: fcInclude })
  })
}

export async function registrarFacturaCompra(actorId: string, id: string) {
  const fc = await prisma.facturaCompra.findUnique({
    where: { id },
    include: { items: true, vencimientos: true, ordenCompra: { include: { items: true } } },
  })
  if (!fc) throw new ApiError(404, 'Factura de compra no encontrada')
  if (!puedeRegistrarFacturaCompra(fc.estado)) {
    throw new ApiError(400, 'La factura ya fue registrada o anulada')
  }

  if (requiereConstatacionParaRegistrar()) {
    if (fc.constatacionResultado !== 'A') {
      throw new ApiError(400, 'La factura debe estar constatada en AFIP (resultado A) antes de registrar')
    }
  }

  const oc = fc.ordenCompra
  const errorRegla = validarReglasFacturaCompra({
    tipo: fc.tipo,
    ordenCompraId: fc.ordenCompraId,
    fcSinRecepcion: fc.fcSinRecepcion,
    notaFcSinRecepcion: fc.notaFcSinRecepcion,
    moneda: fc.moneda,
    notaMonedaOc: fc.notaMonedaOc,
    oc: oc
      ? { id: oc.id, proveedorId: oc.proveedorId, estado: oc.estado, moneda: oc.moneda, items: oc.items }
      : null,
  })
  if (errorRegla) throw new ApiError(400, errorRegla)

  const recepcionCompleta = derivarRecepcionCompleta(oc?.items) || fc.fcSinRecepcion

  return prisma.$transaction(async (tx) => {
    if (fc.vencimientos.length === 0) {
      const fechaVenc = calcularFechaVencimientoDefault(fc.fecha, fc.fechaVencimiento)
      await tx.vencimientoPago.create({
        data: {
          facturaCompraId: id,
          numeroCuota: 1,
          fecha: fechaVenc,
          monto: fc.total,
          saldo: fc.total,
          pagado: false,
        },
      })
    } else if (!validarSumaCuotas(fc.vencimientos, fc.total)) {
      throw new ApiError(400, 'La suma de cuotas debe coincidir con el total de la factura')
    }

    const updated = await tx.facturaCompra.update({
      where: { id },
      data: {
        estado: 'REGISTRADA',
        registradaEn: new Date(),
        recepcionCompleta,
        creadoPorId: fc.creadoPorId ?? actorId,
      },
      include: fcInclude,
    })

    await registrarEventoFcOc(
      fc.ordenCompraId,
      fc.numero,
      id,
      fc.total,
      'OC_FC_REGISTRADA',
      actorId,
      tx,
    )

    return updated
  })
}

export async function anularFacturaCompra(actorId: string, id: string) {
  const fc = await prisma.facturaCompra.findUnique({ where: { id } })
  if (!fc) throw new ApiError(404, 'Factura de compra no encontrada')
  if (!puedeAnularFacturaCompra(fc.estado)) {
    throw new ApiError(400, 'Solo se pueden anular facturas registradas')
  }

  return prisma.$transaction(async (tx) => {
    await tx.vencimientoPago.updateMany({
      where: { facturaCompraId: id, pagado: false },
      data: { saldo: 0 },
    })
    const updated = await tx.facturaCompra.update({
      where: { id },
      data: {
        estado: 'ANULADA',
        anuladaEn: new Date(),
        creadoPorId: fc.creadoPorId ?? actorId,
      },
      include: fcInclude,
    })

    await registrarEventoFcOc(
      fc.ordenCompraId,
      fc.numero,
      id,
      fc.total,
      'OC_FC_ANULADA',
      actorId,
      tx,
    )

    return updated
  })
}
