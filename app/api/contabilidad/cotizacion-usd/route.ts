import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth, handleApiError } from '@/lib/api-auth'
import { resolverCotizacionUsd } from '@/lib/moneda'

export async function GET() {
  try {
    await requireAuth()
    const cotizacionUsd = await resolverCotizacionUsd(prisma)
    return NextResponse.json({ cotizacionUsd })
  } catch (error) {
    return handleApiError(error)
  }
}
