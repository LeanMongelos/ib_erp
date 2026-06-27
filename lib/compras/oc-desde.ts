import { prisma } from '@/lib/prisma'
import { ApiError } from '@/lib/api-auth'
import { calcularTotalesOC } from '@/lib/compras/oc'
import { resolverCotizacionUsd } from '@/lib/compras/oc-crud'
import { ocInclude } from '@/lib/compras/oc-include'
import { crearConNumeroUnico, siguienteNumeroOC } from '@/lib/sequences'
import { registrarOcCreada } from '@/lib/compras/oc-workflow/aprobacion'

async function crearOcConEvento(
  actorId: string,
  create: (numero: string) => ReturnType<typeof prisma.ordenCompra.create>,
) {
  const oc = await crearConNumeroUnico(siguienteNumeroOC, create)
  await registrarOcCreada(oc.id, actorId, oc.numero)
  return oc
}

export async function crearOcDesdeOT(otId: string, actorId: string) {
  const ot = await prisma.ordenTrabajo.findUnique({
    where: { id: otId },
    include: {
      repuestos: { include: { inventario: { select: { id: true, nombre: true } } } },
      cliente: { select: { id: true, nombre: true } },
    },
  })
  if (!ot) throw new ApiError(404, 'Orden de trabajo no encontrada')
  if (ot.repuestos.length === 0) {
    throw new ApiError(400, 'La OT no tiene repuestos cargados para generar OC')
  }

  const proveedor = await prisma.proveedor.findFirst({
    where: { activo: true, OR: [{ tipoCompra: 'REMITO' }, { tipoCompra: 'AMBOS' }] },
    orderBy: { razonSocial: 'asc' },
  })
  if (!proveedor) throw new ApiError(400, 'No hay proveedor activo para repuestos')

  const items = ot.repuestos.map((r) => ({
    descripcion: r.descripcion || r.inventario?.nombre || 'Repuesto OT',
    concepto: null as string | null,
    cantidad: r.cantidad,
    precioUnit: r.precioUnit,
    inventarioId: r.inventarioId,
  }))
  const { itemsCalc, subtotal, total } = calcularTotalesOC(items)
  const cotizacionUsd = await resolverCotizacionUsd(proveedor.moneda)

  const itemsCreate = itemsCalc.map((i, idx) => ({
    inventarioId: items[idx].inventarioId ?? null,
    concepto: items[idx].concepto ?? null,
    descripcion: items[idx].descripcion,
    cantidad: i.cantidad,
    precioUnit: i.precioUnit,
    subtotal: i.subtotal,
  }))

  return crearOcConEvento(actorId, (numero) =>
      prisma.ordenCompra.create({
        data: {
          numero,
          proveedorId: proveedor.id,
          estado: 'BORRADOR',
          subtotal,
          total,
          moneda: proveedor.moneda,
          cotizacionUsd,
          clasificacionOrigen: 'REPUESTO_OT',
          ordenTrabajoId: ot.id,
          clienteId: ot.clienteId,
          justificacion: `Repuestos OT ${ot.numero}`,
          solicitanteId: actorId,
          creadoPorId: actorId,
          items: { create: itemsCreate },
        },
        include: ocInclude,
      }),
  )
}

export async function crearOcDesdePresupuesto(presupuestoId: string, actorId: string) {
  const pres = await prisma.presupuesto.findUnique({
    where: { id: presupuestoId },
    include: {
      items: { include: { inventario: { select: { id: true, nombre: true } } } },
      cliente: { select: { id: true, nombre: true } },
    },
  })
  if (!pres) throw new ApiError(404, 'Presupuesto no encontrado')
  if (pres.items.length === 0) throw new ApiError(400, 'El presupuesto no tiene ítems')

  const tieneStock = pres.items.some((i) => i.inventarioId)
  const proveedor = await prisma.proveedor.findFirst({
    where: {
      activo: true,
      OR: [{ tipoCompra: tieneStock ? 'REMITO' : 'CONCEPTOS' }, { tipoCompra: 'AMBOS' }],
    },
    orderBy: { razonSocial: 'asc' },
  })
  if (!proveedor) throw new ApiError(400, 'No hay proveedor activo para este presupuesto')

  const items = pres.items.map((i) => ({
    descripcion: i.descripcion,
    concepto: null as string | null,
    cantidad: i.cantidad,
    precioUnit: i.precioUnit,
    precioLista: i.precioUnit,
    bonificacionPct: i.bonificacionPct,
    inventarioId: i.inventarioId,
  }))
  const { itemsCalc, subtotal, total } = calcularTotalesOC(items)
  const cotizacionUsd = pres.cotizacionUsd ?? (await resolverCotizacionUsd(pres.moneda))

  const itemsCreate = itemsCalc.map((i, idx) => ({
    inventarioId: items[idx].inventarioId ?? null,
    concepto: items[idx].concepto ?? null,
    descripcion: items[idx].descripcion,
    cantidad: i.cantidad,
    precioUnit: i.precioUnit,
    precioLista: items[idx].precioLista ?? null,
    bonificacionPct: items[idx].bonificacionPct ?? 0,
    subtotal: i.subtotal,
  }))

  return crearOcConEvento(actorId, (numero) =>
      prisma.ordenCompra.create({
        data: {
          numero,
          proveedorId: proveedor.id,
          estado: 'BORRADOR',
          subtotal,
          total,
          moneda: pres.moneda,
          cotizacionUsd,
          clasificacionOrigen: tieneStock ? 'EQUIPO_VENTA' : 'SERVICIO',
          presupuestoId: pres.id,
          ordenTrabajoId: pres.otId,
          clienteId: pres.clienteId,
          justificacion: `Compra vinculada a presupuesto ${pres.numero}`,
          solicitanteId: actorId,
          creadoPorId: actorId,
          items: { create: itemsCreate },
        },
        include: ocInclude,
      }),
  )
}

export async function crearOcDesdePlantilla(plantillaId: string, actorId: string) {
  const plantilla = await prisma.plantillaOC.findUnique({
    where: { id: plantillaId },
    include: { items: true, proveedor: true },
  })
  if (!plantilla || !plantilla.activa) throw new ApiError(404, 'Plantilla no encontrada o inactiva')

  const items = plantilla.items.map((i) => ({
    descripcion: i.descripcion,
    concepto: i.concepto,
    cantidad: i.cantidad,
    precioUnit: i.precioUnit,
    inventarioId: i.inventarioId,
  }))
  const { itemsCalc, subtotal, total } = calcularTotalesOC(items)
  const cotizacionUsd = await resolverCotizacionUsd(plantilla.moneda)

  const itemsCreate = itemsCalc.map((i, idx) => ({
    inventarioId: items[idx].inventarioId ?? null,
    concepto: items[idx].concepto ?? null,
    descripcion: items[idx].descripcion,
    cantidad: i.cantidad,
    precioUnit: i.precioUnit,
    subtotal: i.subtotal,
  }))

  return crearOcConEvento(actorId, (numero) =>
      prisma.ordenCompra.create({
        data: {
          numero,
          proveedorId: plantilla.proveedorId,
          estado: 'BORRADOR',
          subtotal,
          total,
          moneda: plantilla.moneda,
          cotizacionUsd,
          clasificacionOrigen: plantilla.clasificacionOrigen,
          justificacion: plantilla.justificacionDefault ?? `Desde plantilla ${plantilla.nombre}`,
          observaciones: plantilla.descripcionDefault,
          solicitanteId: actorId,
          creadoPorId: actorId,
          plantillaOcId: plantilla.id,
          items: { create: itemsCreate },
        },
        include: ocInclude,
      }),
  )
}
