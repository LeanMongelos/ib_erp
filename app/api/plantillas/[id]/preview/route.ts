import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission, handleApiError, ApiError } from '@/lib/api-auth'
import type { PlantillaConfig } from '@/lib/plantillas/types'
import { renderPreviewPlantilla } from '@/lib/plantillas/preview'

export const runtime = 'nodejs'

async function pdfConTimeout(cfg: Parameters<typeof renderPreviewPlantilla>[0]) {
  return Promise.race([
    renderPreviewPlantilla(cfg),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Tiempo agotado generando PDF')), 45_000),
    ),
  ])
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission('config.manage_billing_templates')
    const { id } = await params

    const plantilla = await prisma.plantillaImpresion.findUnique({ where: { id } })
    if (!plantilla) throw new ApiError(404, 'Plantilla no encontrada')

    const cfg = plantilla.config as unknown as PlantillaConfig
    const pdf = await pdfConTimeout(cfg)

    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="preview-${plantilla.tipo.toLowerCase()}.pdf"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}
