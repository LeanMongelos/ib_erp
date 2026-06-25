import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission, handleApiError, ApiError } from '@/lib/api-auth'
import { plain } from '@/lib/serialize'
import { crmSnippetUpdateSchema } from '@/lib/validation'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission('crm.manage_channels')
    const { id } = await params
    const data = crmSnippetUpdateSchema.parse(await req.json())

    const prev = await prisma.crmSnippet.findUnique({ where: { id } })
    if (!prev) throw new ApiError(404, 'Snippet no encontrado')

    const snippet = await prisma.crmSnippet.update({ where: { id }, data })
    return NextResponse.json(plain(snippet))
  } catch (error) {
    return handleApiError(error)
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission('crm.manage_channels')
    const { id } = await params

    const prev = await prisma.crmSnippet.findUnique({ where: { id } })
    if (!prev) throw new ApiError(404, 'Snippet no encontrado')

    await prisma.crmSnippet.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    return handleApiError(error)
  }
}
