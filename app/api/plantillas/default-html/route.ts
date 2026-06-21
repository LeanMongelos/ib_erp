import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission, handleApiError } from '@/lib/api-auth'
import { htmlDefaultPorTipo } from '@/lib/plantillas/html-templates'

const querySchema = z.object({
  tipo: z.enum(['FACTURA', 'PRESUPUESTO']),
})

export async function GET(req: NextRequest) {
  try {
    await requirePermission('config.manage_billing_templates')
    const { tipo } = querySchema.parse(Object.fromEntries(new URL(req.url).searchParams))
    return NextResponse.json({ html: htmlDefaultPorTipo(tipo) })
  } catch (error) {
    return handleApiError(error)
  }
}
