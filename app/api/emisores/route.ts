import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission, handleApiError } from '@/lib/api-auth'
import { emisorCreateSchema } from '@/lib/validation'
import { validarConfirmacionProduccion } from '@/lib/emisores/validar-produccion'
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
    const { confirmarProduccion, ...dataSinConfirm } = data

    const errConfirm = validarConfirmacionProduccion(
      dataSinConfirm.ambiente,
      'HOMOLOGACION',
      confirmarProduccion,
    )
    if (errConfirm) {
      return NextResponse.json({ error: errConfirm }, { status: 400 })
    }

    const emisor = await prisma.$transaction(async (tx) => {
      if (dataSinConfirm.predeterminado) {
        await tx.emisor.updateMany({ data: { predeterminado: false } })
      }
      return tx.emisor.create({ data: { ...dataSinConfirm, email: dataSinConfirm.email || null } })
    })

    await registrarAuditoria({
      usuarioId: actor.id,
      accion: 'emisor.create',
      entidad: 'Emisor',
      entidadId: emisor.id,
      despues: { razonSocial: dataSinConfirm.razonSocial, cuit: dataSinConfirm.cuit },
      ip: getIp(req),
    })

    return NextResponse.json(plain(emisor), { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
