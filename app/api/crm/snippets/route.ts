import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission, handleApiError } from '@/lib/api-auth'
import { plain } from '@/lib/serialize'
import { crmSnippetCreateSchema, crmSnippetUpdateSchema } from '@/lib/validation'

export async function GET() {
  try {
    await requirePermission('crm.reply')
    const snippets = await prisma.crmSnippet.findMany({
      where: { activo: true },
      orderBy: [{ orden: 'asc' }, { titulo: 'asc' }],
    })
    return NextResponse.json(plain(snippets))
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(req: NextRequest) {
  try {
    await requirePermission('crm.manage_channels')
    const data = crmSnippetCreateSchema.parse(await req.json())
    const snippet = await prisma.crmSnippet.create({ data })
    return NextResponse.json(plain(snippet), { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
