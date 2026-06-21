import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requirePermission, handleApiError } from '@/lib/api-auth'
import type { PlantillaConfig } from '@/lib/plantillas/types'
import { configDefaultPorTipo, renderPreviewPlantilla } from '@/lib/plantillas/preview'

export const runtime = 'nodejs'
export const maxDuration = 60

const PREVIEW_TIMEOUT_MS = 45_000

async function pdfConTimeout(cfg: Parameters<typeof renderPreviewPlantilla>[0]) {
  return Promise.race([
    renderPreviewPlantilla(cfg),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Tiempo agotado generando PDF')), PREVIEW_TIMEOUT_MS),
    ),
  ])
}

const querySchema = z.object({
  tipo: z.enum(['FACTURA', 'PRESUPUESTO', 'REMITO']),
})

const bodySchema = z.object({
  config: z.record(z.string(), z.unknown()),
})

export async function GET(req: NextRequest) {
  try {
    await requirePermission('config.manage_billing_templates')
    const { tipo } = querySchema.parse(Object.fromEntries(new URL(req.url).searchParams))

    const guardada = await prisma.plantillaImpresion.findFirst({
      where: { tipo, predeterminado: true, activo: true },
    })

    const cfg = (guardada?.config as unknown as PlantillaConfig | undefined) ?? configDefaultPorTipo(tipo)
    const pdf = await pdfConTimeout(cfg)

    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="preview-${tipo.toLowerCase()}.pdf"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}

/** Vista previa con config en el body (editor visual sin guardar). */
export async function POST(req: NextRequest) {
  try {
    await requirePermission('config.manage_billing_templates')
    const { config } = bodySchema.parse(await req.json())
    const cfg = config as unknown as PlantillaConfig
    const pdf = await pdfConTimeout(cfg)

    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline; filename="preview-draft.pdf"',
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}
