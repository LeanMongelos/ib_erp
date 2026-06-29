/**
 * Orden de venta (pedido) generada desde presupuesto aprobado.
 */
import { prisma } from '@/lib/prisma'
import { ApiError } from '@/lib/api-auth'
import { claveOrdenVenta, reservarSiguienteNumero } from '@/lib/numeracion'

export async function crearOrdenVentaDesdePresupuesto(presupuestoId: string) {
  const pres = await prisma.presupuesto.findUnique({
    where: { id: presupuestoId },
    include: { ordenVenta: true, factura: true },
  })
  if (!pres) throw new ApiError(404, 'Presupuesto no encontrado')
  if (pres.estado !== 'APROBADO' && pres.estado !== 'CONVERTIDO') {
    throw new ApiError(400, 'El presupuesto debe estar aprobado para generar la orden de venta')
  }
  if (pres.ordenVenta) return pres.ordenVenta

  const numero = await reservarSiguienteNumero(claveOrdenVenta())

  return prisma.ordenVenta.create({
    data: {
      numero,
      presupuestoId: pres.id,
      clienteId: pres.clienteId,
      observaciones: pres.observaciones,
    },
  })
}

export async function obtenerOrdenVentaConDetalle(id: string) {
  const ov = await prisma.ordenVenta.findUnique({
    where: { id },
    include: {
      presupuesto: {
        include: {
          items: { include: { inventario: { select: { id: true, sku: true, tipoArticulo: true, esSerializado: true, modoTrazabilidad: true } } } },
          cliente: { select: { id: true, nombre: true } },
        },
      },
      remitos: { include: { items: true }, orderBy: { creadoEn: 'desc' } },
      factura: { select: { id: true, numero: true, estado: true } },
    },
  })
  if (!ov) throw new ApiError(404, 'Orden de venta no encontrada')
  return ov
}
