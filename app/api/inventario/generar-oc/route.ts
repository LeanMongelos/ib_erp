import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requirePermission, handleApiError, ApiError } from '@/lib/api-auth'
import { getFaltantesStock } from '@/lib/inventario'
import { siguienteNumeroOC, crearConNumeroUnico } from '@/lib/sequences'
import { plain } from '@/lib/serialize'
import { registrarAuditoria, getIp } from '@/lib/audit'

const generarSchema = z.object({
  proveedorId: z.string().min(1),
})

export async function POST(req: NextRequest) {
  try {
    const actor = await requirePermission('compras.create')
    const { proveedorId } = generarSchema.parse(await req.json())

    const proveedor = await prisma.proveedor.findUnique({ where: { id: proveedorId } })
    if (!proveedor) throw new ApiError(404, 'Proveedor no encontrado')

    const faltantes = await getFaltantesStock()
    const productosProv = await prisma.proveedorProducto.findMany({
      where: { proveedorId },
      include: { inventario: true },
    })

    const items: { inventarioId: string; descripcion: string; cantidad: number; precioUnit: number }[] = []

    for (const f of faltantes) {
      const prod = productosProv.find((p) => p.inventarioId === f.id)
      if (!prod?.costo) continue
      items.push({
        inventarioId: f.id,
        descripcion: f.nombre,
        cantidad: f.faltante,
        precioUnit: prod.costo,
      })
    }

    if (items.length === 0) {
      throw new ApiError(400, 'No hay ítems faltantes para este proveedor')
    }

    const subtotal = items.reduce((a, i) => a + i.cantidad * i.precioUnit, 0)

    const oc = await crearConNumeroUnico(
      siguienteNumeroOC,
      (numero) =>
        prisma.ordenCompra.create({
          data: {
            numero,
            proveedorId,
            observaciones: 'Generada automáticamente por faltantes de stock',
            subtotal,
            total: subtotal,
            estado: 'BORRADOR',
            items: {
              create: items.map((i) => ({
                inventarioId: i.inventarioId,
                descripcion: i.descripcion,
                cantidad: i.cantidad,
                precioUnit: i.precioUnit,
                subtotal: i.cantidad * i.precioUnit,
              })),
            },
          },
          include: { proveedor: true, items: true },
        }),
    )

    await registrarAuditoria({
      usuarioId: actor.id,
      accion: 'oc.generar_faltantes',
      entidad: 'OrdenCompra',
      entidadId: oc.id,
      ip: getIp(req),
    })

    return NextResponse.json(plain(oc), { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
