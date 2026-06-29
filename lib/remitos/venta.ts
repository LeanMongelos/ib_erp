/**
 * Remito de venta: toma ítems del presupuesto y permite asignar números de serie.
 */
import { prisma } from '@/lib/prisma'
import { ApiError } from '@/lib/api-auth'
import { claveRemito, reservarSiguienteNumero } from '@/lib/numeracion'
import { trazabilidadActiva } from '@/lib/inventario/unidades'
import {
  remitoPendientesEmision,
  type ItemRemitoEmisionCheck,
} from '@/lib/remitos/validacion-emision'

export type { ItemRemitoEmisionCheck } from '@/lib/remitos/validacion-emision'
export {
  itemRemitoPendienteSerie,
  remitoListoParaEmitir,
  remitoPendientesEmision,
} from '@/lib/remitos/validacion-emision'

function requiereAsignacionSerie(modoTrazabilidad: string | null | undefined, esSerializado: boolean): boolean {
  if (trazabilidadActiva(modoTrazabilidad as 'NINGUNA' | 'SERIE' | 'LOTE' | 'SERIE_Y_LOTE')) return true
  return esSerializado
}

export async function crearRemitoDesdeOrdenVenta(ordenVentaId: string) {
  const ov = await prisma.ordenVenta.findUnique({
    where: { id: ordenVentaId },
    include: {
      presupuesto: {
        include: {
          items: {
            include: {
              inventario: {
                select: {
                  id: true,
                  sku: true,
                  tipoArticulo: true,
                  esSerializado: true,
                  modoTrazabilidad: true,
                },
              },
            },
            orderBy: { id: 'asc' },
          },
        },
      },
    },
  })
  if (!ov) throw new ApiError(404, 'Orden de venta no encontrada')
  if (ov.estado === 'FACTURADA' || ov.estado === 'CANCELADA') {
    throw new ApiError(400, 'La orden de venta no admite nuevos remitos')
  }

  const numero = await reservarSiguienteNumero(claveRemito())
  const lineas: Array<{
    orden: number
    presupuestoItemId: string
    inventarioId: string | null
    codigo: string | null
    descripcion: string
    cantidad: number
  }> = []

  let orden = 0
  for (const item of ov.presupuesto.items) {
    const inv = item.inventario
    const serializado = inv
      ? requiereAsignacionSerie(inv.modoTrazabilidad, inv.esSerializado) || inv.tipoArticulo === 'EQUIPO'
      : false
    const repeticiones = serializado ? Math.max(1, item.cantidad) : 1
    for (let u = 0; u < repeticiones; u++) {
      lineas.push({
        orden: orden++,
        presupuestoItemId: item.id,
        inventarioId: item.inventarioId,
        codigo: item.codigo,
        descripcion: item.descripcion,
        cantidad: serializado ? 1 : item.cantidad,
      })
    }
  }

  const remito = await prisma.$transaction(async (tx) => {
    const creado = await tx.remitoVenta.create({
      data: {
        numero,
        presupuestoId: ov.presupuestoId,
        ordenVentaId: ov.id,
        clienteId: ov.clienteId,
        observaciones: `Remito de OV ${ov.numero}`,
        items: {
          create: lineas,
        },
      },
      include: { items: { orderBy: { orden: 'asc' } } },
    })

    await tx.ordenVenta.update({
      where: { id: ov.id },
      data: { estado: 'PARCIALMENTE_REMITIDA' },
    })

    return creado
  })

  return remito
}

export async function crearRemitoDesdePresupuesto(presupuestoId: string) {
  const ov = await prisma.ordenVenta.findUnique({ where: { presupuestoId } })
  if (ov) return crearRemitoDesdeOrdenVenta(ov.id)

  const creada = await import('@/lib/ventas/orden-venta').then((m) =>
    m.crearOrdenVentaDesdePresupuesto(presupuestoId),
  )
  return crearRemitoDesdeOrdenVenta(creada.id)
}

export async function obtenerRemitoVenta(id: string) {
  const remito = await prisma.remitoVenta.findUnique({
    where: { id },
    include: {
      cliente: { select: { id: true, nombre: true, cuit: true, direccion: true, ciudad: true } },
      ordenVenta: {
        include: {
          presupuesto: {
            include: {
              items: {
                include: {
                  inventario: {
                    select: { id: true, sku: true, nombre: true, tipoArticulo: true, modoTrazabilidad: true, esSerializado: true },
                  },
                },
              },
            },
          },
        },
      },
      items: {
        orderBy: { orden: 'asc' },
        include: {
          inventario: { select: { id: true, sku: true, nombre: true, modoTrazabilidad: true, tipoArticulo: true } },
          inventarioUnidad: {
            select: {
              id: true,
              numeroSerie: true,
              deposito: { select: { id: true, nombre: true } },
            },
          },
          equipo: { select: { id: true, nombre: true, numeroSerie: true } },
        },
      },
      factura: { select: { id: true, numero: true } },
    },
  })
  if (!remito) throw new ApiError(404, 'Remito no encontrado')
  return remito
}

export async function asignarSerieItemRemito(
  itemRemitoId: string,
  data: { inventarioUnidadId?: string | null; equipoId?: string | null; numeroSerie?: string | null },
) {
  const item = await prisma.itemRemito.findUnique({
    where: { id: itemRemitoId },
    include: {
      remito: true,
      inventario: { select: { id: true, modoTrazabilidad: true } },
    },
  })
  if (!item) throw new ApiError(404, 'Ítem de remito no encontrado')
  if (item.remito.estado !== 'BORRADOR') {
    throw new ApiError(400, 'Solo se pueden asignar series en remitos en borrador')
  }

  let inventarioUnidadId: string | null = null
  let numeroSerie: string | null = data.numeroSerie?.trim() || null
  let equipoId: string | null = data.equipoId?.trim() || null

  if (data.inventarioUnidadId) {
    const unidad = await prisma.inventarioUnidad.findUnique({
      where: { id: data.inventarioUnidadId },
      include: { equipo: { select: { id: true, clienteId: true } } },
    })
    if (!unidad) throw new ApiError(404, 'Unidad de inventario no encontrada')
    if (item.inventarioId && unidad.inventarioId !== item.inventarioId) {
      throw new ApiError(400, 'La unidad no corresponde al producto del ítem')
    }
    if (unidad.estado !== 'EN_STOCK' && unidad.estado !== 'RESERVADO') {
      throw new ApiError(400, 'La unidad no está disponible para asignar')
    }
    inventarioUnidadId = unidad.id
    numeroSerie = unidad.numeroSerie
    if (unidad.equipoId) equipoId = unidad.equipoId
  } else if (equipoId) {
    const eq = await prisma.equipo.findUnique({
      where: { id: equipoId },
      select: { id: true, numeroSerie: true, clienteId: true, inventarioId: true },
    })
    if (!eq) throw new ApiError(404, 'Equipo no encontrado')
    if (item.inventarioId && eq.inventarioId && eq.inventarioId !== item.inventarioId) {
      throw new ApiError(400, 'El equipo no corresponde al producto del ítem')
    }
    if (eq.clienteId !== item.remito.clienteId) {
      throw new ApiError(400, 'El equipo debe pertenecer al cliente del remito')
    }
    numeroSerie = eq.numeroSerie
  }

  return prisma.itemRemito.update({
    where: { id: itemRemitoId },
    data: { inventarioUnidadId, numeroSerie, equipoId },
    include: {
      inventarioUnidad: {
        select: { id: true, numeroSerie: true, deposito: { select: { nombre: true } } },
      },
      equipo: { select: { id: true, nombre: true, numeroSerie: true } },
    },
  })
}

export async function emitirRemitoVenta(remitoId: string) {
  const remito = await obtenerRemitoVenta(remitoId)
  if (remito.estado !== 'BORRADOR') throw new ApiError(400, 'El remito ya fue emitido')

  const pendientes = remitoPendientesEmision(remito.items)
  if (pendientes.length > 0) {
    throw new ApiError(
      400,
      `Falta asignar número de serie en «${pendientes[0]}»${pendientes.length > 1 ? ` (+${pendientes.length - 1} más)` : ''}`,
    )
  }

  await prisma.$transaction(async (tx) => {
    for (const item of remito.items) {
      if (item.inventarioUnidadId) {
        await tx.inventarioUnidad.update({
          where: { id: item.inventarioUnidadId },
          data: { estado: 'RESERVADO' },
        })
      }
    }
    await tx.remitoVenta.update({
      where: { id: remitoId },
      data: { estado: 'EMITIDO', fechaEmision: new Date() },
    })
    if (remito.ordenVentaId) {
      await tx.ordenVenta.update({
        where: { id: remito.ordenVentaId },
        data: { estado: 'REMITIDA' },
      })
    }
  })

  return obtenerRemitoVenta(remitoId)
}

export async function listarUnidadesDisponiblesParaRemito(
  inventarioId: string,
  clienteId: string,
) {
  const unidadesStock = await prisma.inventarioUnidad.findMany({
    where: {
      inventarioId,
      estado: { in: ['EN_STOCK', 'RESERVADO'] },
    },
    include: {
      deposito: { select: { id: true, nombre: true, tipo: true } },
    },
    orderBy: [{ numeroSerie: 'asc' }],
  })

  const equiposCliente = await prisma.equipo.findMany({
    where: {
      clienteId,
      inventarioId,
      estado: { in: ['ACTIVO', 'EN_REPARACION'] },
    },
    select: {
      id: true,
      nombre: true,
      numeroSerie: true,
      unidadInventario: {
        select: {
          id: true,
          numeroSerie: true,
          deposito: { select: { id: true, nombre: true } },
        },
      },
    },
    orderBy: { numeroSerie: 'asc' },
  })

  return { unidadesStock, equiposCliente }
}

/** Datos para prefilled factura desde remito emitido. */
export async function itemsFacturaDesdeRemito(remitoId: string) {
  const remito = await prisma.remitoVenta.findUnique({
    where: { id: remitoId },
    include: {
      factura: { select: { id: true } },
      items: {
        orderBy: { orden: 'asc' },
        include: {
          presupuestoItem: true,
        },
      },
      ordenVenta: {
        include: {
          presupuesto: { select: { id: true, clienteId: true, moneda: true, alicuotaIvaPct: true } },
        },
      },
    },
  })
  if (!remito) throw new ApiError(404, 'Remito no encontrado')
  if (remito.estado !== 'EMITIDO' && remito.estado !== 'FACTURADO') {
    throw new ApiError(400, 'El remito debe estar emitido para facturar')
  }
  if (remito.factura) throw new ApiError(400, 'Este remito ya tiene factura')

  const pres = remito.ordenVenta?.presupuesto
  if (!pres) throw new ApiError(400, 'Remito sin presupuesto vinculado')

  return {
    clienteId: remito.clienteId,
    presupuestoId: pres.id,
    ordenVentaId: remito.ordenVentaId,
    remitoId: remito.id,
    moneda: pres.moneda,
    alicuotaIvaPct: pres.alicuotaIvaPct,
    items: remito.items.map((item) => {
      const pi = item.presupuestoItem
      const precioUnit = pi?.precioUnit ?? 0
      const bonificacionPct = pi?.bonificacionPct ?? 0
      const alicuotaIvaPct = pi?.alicuotaIvaPct ?? pres.alicuotaIvaPct
      const subtotal = item.cantidad * precioUnit * (1 - bonificacionPct / 100)
      return {
        codigo: item.codigo ?? pi?.codigo ?? null,
        descripcion: item.descripcion,
        descripcionLarga: pi?.descripcionLarga ?? null,
        fotoUrl: pi?.fotoUrl ?? null,
        cantidad: item.cantidad,
        precioUnit,
        bonificacionPct,
        alicuotaIvaPct,
        subtotal,
        inventarioId: item.inventarioId,
        numeroSerie: item.numeroSerie,
        inventarioUnidadId: item.inventarioUnidadId,
        proximoPreventivo: pi?.proximoPreventivo?.toISOString() ?? null,
      }
    }),
  }
}
