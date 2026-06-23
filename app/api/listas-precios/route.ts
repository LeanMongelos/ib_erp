import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission, handleApiError } from '@/lib/api-auth'
import { listaPreciosCreateSchema } from '@/lib/validation'
import { registrarAuditoria, getIp } from '@/lib/audit'
import { plain } from '@/lib/serialize'

export async function GET() {
  try {
    await requirePermission('listas_precios.read')
    const listas = await prisma.listaPrecios.findMany({
      orderBy: [{ predeterminada: 'desc' }, { codigo: 'asc' }],
      include: { _count: { select: { items: true, clientes: true } } },
    })
    return NextResponse.json(plain(listas))
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requirePermission('listas_precios.manage')
    const data = listaPreciosCreateSchema.parse(await req.json())

    const lista = await prisma.$transaction(async (tx) => {
      if (data.predeterminada) {
        await tx.listaPrecios.updateMany({
          where: { tipo: data.tipo, moneda: data.moneda, predeterminada: true },
          data: { predeterminada: false },
        })
      }
      return tx.listaPrecios.create({ data })
    })

    await registrarAuditoria({
      usuarioId: actor.id,
      accion: 'lista_precios.create',
      entidad: 'ListaPrecios',
      entidadId: lista.id,
      despues: { codigo: lista.codigo, nombre: lista.nombre },
      ip: getIp(req),
    })

    return NextResponse.json(plain(lista), { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
