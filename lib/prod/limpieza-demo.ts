/**
 * Limpieza de datos demo para go-live (preserva usuarios, RBAC, emisores, plantillas, catálogos).
 * Idempotente: puede ejecutarse más de una vez sin romper el sistema.
 */
import { prisma } from '@/lib/prisma'
import { CLIENTE_EVENTUAL_ID, ensureClienteEventual } from '@/lib/clientes/eventual'
import { ensureSecuenciasActuales } from '@/lib/numeracion'
import { seedListasPrecios } from '@/lib/precios/seed-listas-precios'

export const LIMPIEZA_DEMO_MARCA = 'LIMPIEZA_DEMO_V1'

export type LimpiezaDemoResult = {
  conversaciones: number
  negociosEmbudo: number
  facturas: number
  presupuestos: number
  pagos: number
  ordenesTrabajo: number
  equipos: number
  clientes: number
  proveedores: number
  inventario: number
  movimientosStock: number
  ordenesCompra: number
}

/** Borra datos transaccionales/demo; mantiene configuración del sistema. */
export async function limpiarDatosDemo(): Promise<LimpiezaDemoResult> {
  const counts: LimpiezaDemoResult = {
    conversaciones: 0,
    negociosEmbudo: 0,
    facturas: 0,
    presupuestos: 0,
    pagos: 0,
    ordenesTrabajo: 0,
    equipos: 0,
    clientes: 0,
    proveedores: 0,
    inventario: 0,
    movimientosStock: 0,
    ordenesCompra: 0,
  }

  await prisma.$transaction(async (tx) => {
    await tx.notificacionLeida.deleteMany()
    const historialEmbudo = (await tx.historialEmbudo.deleteMany()).count
    counts.negociosEmbudo = (await tx.negocioEmbudo.deleteMany()).count + historialEmbudo
    counts.conversaciones = (await tx.mensajeCRM.deleteMany()).count
    counts.conversaciones += (await tx.conversacionCRM.deleteMany()).count

    await tx.pagoFactura.deleteMany()
    await tx.vencimientoCobranza.deleteMany()

    await tx.itemFactura.updateMany({ data: { equipoGeneradoId: null } })
    await tx.itemFactura.deleteMany()
    counts.facturas = (await tx.factura.deleteMany()).count

    await tx.itemPresupuesto.deleteMany()
    counts.presupuestos = (await tx.presupuesto.deleteMany()).count

    counts.pagos = (await tx.pago.deleteMany()).count

    await tx.repuestoOT.deleteMany()
    await tx.historialOT.deleteMany()
    await tx.eventoTracking.deleteMany()
    counts.ordenesTrabajo = (await tx.ordenTrabajo.deleteMany()).count

    await tx.planMantenimiento.deleteMany()
    await tx.historiaClinicaEntrada.deleteMany()
    await tx.equipoAccesorio.deleteMany()
    await tx.equipoComponente.deleteMany()
    counts.equipos = (await tx.equipo.deleteMany()).count

    counts.movimientosStock = (await tx.movimientoStock.deleteMany()).count
    counts.ordenesCompra = (await tx.itemOrdenCompra.deleteMany()).count
    counts.ordenesCompra += (await tx.ordenCompra.deleteMany()).count

    await tx.proveedorProducto.deleteMany()
    await tx.contactoProveedor.deleteMany()
    await tx.condicionComercialProveedor.deleteMany()
    counts.proveedores = (await tx.proveedor.deleteMany()).count

    await tx.listaPreciosItem.deleteMany()
    await tx.inventarioKitItem.deleteMany()
    counts.inventario = (await tx.inventario.deleteMany()).count

    counts.clientes = (
      await tx.cliente.deleteMany({
        where: { id: { not: CLIENTE_EVENTUAL_ID } },
      })
    ).count
  })

  await ensureClienteEventual()
  await ensureSecuenciasActuales()
  await seedListasPrecios(prisma)

  await prisma.systemLog.create({
    data: {
      nivel: 'INFO',
      origen: 'prod-limpieza-demo',
      mensaje: `Limpieza demo completada (${LIMPIEZA_DEMO_MARCA})`,
      metadata: counts,
    },
  })

  return counts
}

export async function yaSeLimpioDemo(): Promise<boolean> {
  const prev = await prisma.systemLog.findFirst({
    where: { mensaje: { contains: LIMPIEZA_DEMO_MARCA } },
    select: { id: true },
  })
  return Boolean(prev)
}
