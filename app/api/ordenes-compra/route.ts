import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission, handleApiError } from '@/lib/api-auth'
import { ordenCompraCreateSchema } from '@/lib/validation'
import { siguienteNumeroOC, crearConNumeroUnico } from '@/lib/sequences'
import { plain } from '@/lib/serialize'
import { registrarAuditoria, getIp } from '@/lib/audit'

function calcularTotalesOC(items: { cantidad: number; precioUnit: number }[]) {
  const itemsCalc = items.map((i) => ({
    ...i,
    subtotal: Math.round(i.cantidad * i.precioUnit * 100) / 100,
  }))
  const subtotal = itemsCalc.reduce((a, i) => a + i.subtotal, 0)
  return { itemsCalc, subtotal, total: subtotal }
}

export async function GET() {
  try {
    await requirePermission('compras.read')
    const ordenes = await prisma.ordenCompra.findMany({
      orderBy: { creadoEn: 'desc' },
      include: {
        proveedor: { select: { razonSocial: true } },
        items: true,
      },
    })
    return NextResponse.json(plain(ordenes))
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requirePermission('compras.create')
    const data = ordenCompraCreateSchema.parse(await req.json())
    const { itemsCalc, subtotal, total } = calcularTotalesOC(data.items)

    const oc = await crearConNumeroUnico(
      siguienteNumeroOC,
      (numero) =>
        prisma.ordenCompra.create({
          data: {
            numero,
            proveedorId: data.proveedorId,
            observaciones: data.observaciones ?? null,
            subtotal,
            total,
            estado: 'BORRADOR',
            items: {
              create: itemsCalc.map((i, idx) => ({
                inventarioId: data.items[idx].inventarioId ?? null,
                descripcion: data.items[idx].descripcion,
                cantidad: i.cantidad,
                precioUnit: i.precioUnit,
                subtotal: i.subtotal,
              })),
            },
          },
          include: { proveedor: true, items: true },
        }),
    )

    await registrarAuditoria({
      usuarioId: actor.id,
      accion: 'oc.create',
      entidad: 'OrdenCompra',
      entidadId: oc.id,
      ip: getIp(req),
    })

    return NextResponse.json(plain(oc), { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
