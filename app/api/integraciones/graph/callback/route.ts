import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { prisma } from '@/lib/prisma'

const BASE_URL = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'
import { exchangeGraphCode, saveGraphTokens } from '@/lib/crm/adapters/email-graph'

function verifyState(state: string): boolean {
  try {
    const { p, s } = JSON.parse(Buffer.from(state, 'base64url').toString('utf8')) as { p: string; s: string }
    const secret = process.env.INTEGRATION_SECRET ?? process.env.NEXTAUTH_SECRET
    if (!secret) return false
    const expected = crypto.createHmac('sha256', secret).update(p).digest('base64url')
    if (s !== expected) return false
    const { ts } = JSON.parse(p) as { ts: number }
    return Date.now() - ts < 15 * 60 * 1000
  } catch {
    return false
  }
}

export async function GET(req: NextRequest) {
  const redirectOk = `${BASE_URL}/configuracion/integraciones?graph=ok`
  const redirectErr = `${BASE_URL}/configuracion/integraciones?graph=error`

  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const oauthError = searchParams.get('error_description') ?? searchParams.get('error')

  if (oauthError) {
    return NextResponse.redirect(`${redirectErr}&msg=${encodeURIComponent(oauthError)}`)
  }
  if (!code || !state || !verifyState(state)) {
    return NextResponse.redirect(`${redirectErr}&msg=state_invalido`)
  }

  const canal = await prisma.canalIntegracion.findUnique({ where: { tipo: 'EMAIL_GRAPH' } })
  if (!canal) {
    return NextResponse.redirect(`${redirectErr}&msg=canal_no_encontrado`)
  }

  const redirectUri = `${BASE_URL}/api/integraciones/graph/callback`
  const tokens = await exchangeGraphCode(canal.config, code, redirectUri)

  if (!tokens.ok) {
    return NextResponse.redirect(`${redirectErr}&msg=${encodeURIComponent(tokens.error)}`)
  }

  await saveGraphTokens(canal.id, canal.config, tokens)
  await prisma.canalIntegracion.update({
    where: { id: canal.id },
    data: { estado: 'CONECTADO', errorMensaje: null, ultimoSync: new Date() },
  })

  return NextResponse.redirect(redirectOk)
}
