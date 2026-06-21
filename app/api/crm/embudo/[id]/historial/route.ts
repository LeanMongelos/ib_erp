import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission, handleApiError, ApiError } from '@/lib/api-auth'
import { plain } from '@/lib/serialize'
import { etapaLabel } from '@/lib/crm/embudo-constants'
import type { EtapaKey } from '@/lib/crm/embudo-constants'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission('crm.read')
    const { id } = await params

    const negocio = await prisma.negocioEmbudo.findUnique({ where: { id } })
    if (!negocio) throw new ApiError(404, 'Negocio no encontrado')

    const historial = await prisma.historialEmbudo.findMany({
      where: { negocioId: id },
      orderBy: { creadoEn: 'desc' },
      include: {
        usuario: { select: { id: true, nombre: true } },
      },
    })

    const items = historial.map((h) => ({
      id: h.id,
      fecha: h.creadoEn,
      movimiento: h.retroceso
        ? `${etapaLabel(h.etapaDesde as EtapaKey)} → ${etapaLabel(h.etapaHasta as EtapaKey)} (retroceso)`
        : `${etapaLabel(h.etapaDesde as EtapaKey)} → ${etapaLabel(h.etapaHasta as EtapaKey)}`,
      usuario: h.usuario?.nombre ?? 'Sistema',
      notas: h.notas,
      datos: h.datos,
      retroceso: h.retroceso,
    }))

    return NextResponse.json(plain(items))
  } catch (error) {
    return handleApiError(error)
  }
}
