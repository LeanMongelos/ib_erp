import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission, handleApiError } from '@/lib/api-auth'
import { plain } from '@/lib/serialize'

export async function GET(req: NextRequest) {
  try {
    await requirePermission('crm.read')
    const { searchParams } = new URL(req.url)
    const canal = searchParams.get('canal')
    const estado = searchParams.get('estado')
    const asignadoId = searchParams.get('asignadoId')
    const sinAsignar = searchParams.get('sinAsignar') === 'true'

    const conversaciones = await prisma.conversacionCRM.findMany({
      where: {
        ...(estado && estado !== 'TODOS' && { estado: estado as 'ABIERTA' | 'PENDIENTE' | 'CERRADA' }),
        ...(canal && canal !== 'TODOS' && { canal: { tipo: canal as any } }),
        ...(sinAsignar ? { asignadoId: null } : asignadoId ? { asignadoId } : {}),
      },
      orderBy: { ultimoMensajeEn: 'desc' },
      include: {
        canal: { select: { tipo: true, nombre: true } },
        cliente: { select: { id: true, nombre: true } },
        asignado: { select: { id: true, nombre: true } },
      },
    })

    return NextResponse.json(plain(conversaciones))
  } catch (error) {
    return handleApiError(error)
  }
}
