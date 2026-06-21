import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission, handleApiError, ApiError } from '@/lib/api-auth'
import { buildGraphAuthorizeUrl } from '@/lib/crm/adapters/email-graph'
import crypto from 'crypto'

const BASE_URL = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'

function signState(): string {
  const payload = JSON.stringify({ t: 'EMAIL_GRAPH', ts: Date.now() })
  const secret = process.env.INTEGRATION_SECRET ?? process.env.NEXTAUTH_SECRET
  if (!secret) throw new Error('INTEGRATION_SECRET no configurado')
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('base64url')
  return Buffer.from(JSON.stringify({ p: payload, s: sig })).toString('base64url')
}

export async function GET() {
  try {
    await requirePermission('config.manage_integrations')

    const canal = await prisma.canalIntegracion.findUnique({ where: { tipo: 'EMAIL_GRAPH' } })
    if (!canal) throw new ApiError(404, 'Canal EMAIL_GRAPH no encontrado')

    const redirectUri = `${BASE_URL}/api/integraciones/graph/callback`
    const state = signState()
    const url = buildGraphAuthorizeUrl(canal.config, redirectUri, state)

    return NextResponse.redirect(url)
  } catch (error) {
    return handleApiError(error)
  }
}
