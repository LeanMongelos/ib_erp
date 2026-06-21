import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission, handleApiError } from '@/lib/api-auth'
import { emisorCreateSchema } from '@/lib/validation'
import { registrarAuditoria, getIp } from '@/lib/audit'
import { plain } from '@/lib/serialize'

export async function GET() {
  try {
    await requirePermission('emisores.read')
    const emisores = await prisma.emisor.findMany({
      where: { activo: true },
      orderBy: [{ predeterminado: 'desc' }, { razonSocial: 'asc' }],
    })
    return NextResponse.json(plain(emisores))
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requirePermission('emisores.create')
    const body = await req.json()
    const data = emisorCreateSchema.parse(body)

    const emisor = await prisma.$transaction(async (tx) => {
      // Solo un emisor puede ser predeterminado a la vez
      if (data.predeterminado) {
        await tx.emisor.updateMany({ data: { predeterminado: false } })
      }
      return tx.emisor.create({ data: { ...data, email: data.email || null } })
    })

    await registrarAuditoria({
      usuarioId: actor.id,
      accion: 'emisor.create',
      entidad: 'Emisor',
      entidadId: emisor.id,
      despues: { razonSocial: data.razonSocial, cuit: data.cuit },
      ip: getIp(req),
    })

    return NextResponse.json(plain(emisor), { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
