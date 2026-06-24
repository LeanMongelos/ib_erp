import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth, requirePermission, handleApiError, ApiError } from '@/lib/api-auth'
import { clienteCreateSchema, tipoClienteEnum } from '@/lib/validation'
import { registrarAuditoria, getIp } from '@/lib/audit'
import { crearClienteConSucursales } from '@/lib/clientes/crear-cliente'

export async function GET(req: NextRequest) {
  try {
    await requirePermission('clientes.read')

    const { searchParams } = new URL(req.url)
    const search = searchParams.get('q')?.trim() ?? ''
    const tipoRaw = searchParams.get('tipo') ?? ''
    // Solo aceptamos un tipo válido; cualquier otro valor se ignora
    const tipo = tipoClienteEnum.safeParse(tipoRaw).success ? tipoRaw : ''

    const clientes = await prisma.cliente.findMany({
      where: {
        activo: true,
        ...(search && {
          OR: [
            { nombre:   { contains: search, mode: 'insensitive' } },
            { ciudad:   { contains: search, mode: 'insensitive' } },
            { contacto: { contains: search, mode: 'insensitive' } },
          ],
        }),
        ...(tipo && { tipo: tipo as any }),
      },
      include: { _count: { select: { equipos: true, ots: true } } },
      orderBy: { nombre: 'asc' },
    })
    return NextResponse.json(clientes)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requirePermission('clientes.create')

    const body = await req.json()
    const data = clienteCreateSchema.parse(body)

    let cliente
    try {
      cliente = await crearClienteConSucursales(data)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'No se pudo crear el cliente'
      if (msg.includes('sucursal')) throw new ApiError(400, msg)
      throw e
    }

    await registrarAuditoria({
      usuarioId: actor.id,
      accion: 'cliente.create',
      entidad: 'Cliente',
      entidadId: cliente.id,
      despues: {
        nombre: cliente.nombre,
        tipo: cliente.tipo,
        cuit: cliente.cuit,
        sucursales: cliente.sucursales.length,
      },
      ip: getIp(req),
    })

    return NextResponse.json(cliente, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
