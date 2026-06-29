import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission, handleApiError, ApiError } from '@/lib/api-auth'
import { plain } from '@/lib/serialize'

/** Redirige al formulario de facturación con datos del presupuesto (no crea factura automática). */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission('presupuestos.approve')
    const { id } = await params

    const pres = await prisma.presupuesto.findUnique({
      where: { id },
      include: { factura: true },
    })
    if (!pres) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
    if (pres.factura) throw new ApiError(400, 'Ya fue convertido a factura')

    if (pres.estado !== 'APROBADO') {
      if (!['BORRADOR', 'ENVIADO'].includes(pres.estado)) {
        throw new ApiError(400, `Estado ${pres.estado} no permite facturar`)
      }
      await prisma.presupuesto.update({ where: { id }, data: { estado: 'APROBADO' } })
    }

    return NextResponse.json({
      redirect: `/presupuestos/${id}`,
      presupuestoId: id,
      flujo: 'remito',
    })
  } catch (error) {
    return handleApiError(error)
  }
}
