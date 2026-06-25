import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission, handleApiError, ApiError } from '@/lib/api-auth'
import { renderInformeOtPDF } from '@/lib/ots/render-informe-pdf'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission('servicio.read')
    const { id } = await params

    const ot = await prisma.ordenTrabajo.findUnique({
      where: { id },
      include: {
        cliente: { select: { nombre: true, ciudad: true } },
        equipo: { select: { nombre: true, modelo: true, numeroSerie: true } },
        tecnico: { select: { nombre: true } },
        repuestos: { select: { descripcion: true, cantidad: true, precioUnit: true } },
        historial: {
          orderBy: { creadoEn: 'asc' },
          select: { estado: true, nota: true, creadoEn: true },
        },
      },
    })
    if (!ot) throw new ApiError(404, 'Orden de trabajo no encontrada')

    const pdf = await renderInformeOtPDF({
      numero: ot.numero,
      tipo: ot.tipo,
      estado: ot.estado,
      prioridad: ot.prioridad,
      descripcion: ot.descripcion,
      diagnostico: ot.diagnostico,
      fechaApertura: ot.fechaApertura,
      fechaCierre: ot.fechaCierre,
      slaVence: ot.slaVence,
      cliente: ot.cliente,
      equipo: ot.equipo,
      tecnico: ot.tecnico,
      repuestos: ot.repuestos,
      historial: ot.historial,
    })

    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="informe-ot-${ot.numero}.pdf"`,
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}
