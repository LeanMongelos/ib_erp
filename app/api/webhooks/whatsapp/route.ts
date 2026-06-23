import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { parseCanalConfig, type WhatsAppConfig } from '@/lib/crm/config'
import { decryptCanalConfig } from '@/lib/integraciones/canal-config'
import { procesarWhatsAppWebhook } from '@/lib/crm/adapters/whatsapp'
import { resolveVerifyToken, verifyMetaChallenge, verifyMetaSignature } from '@/lib/crm/webhook-verify'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  const expected = await resolveVerifyToken(['WHATSAPP'])
  const ok = verifyMetaChallenge(mode, token, challenge, expected)
  if (ok) return new NextResponse(ok, { status: 200 })
  return NextResponse.json({ error: 'Verificación fallida' }, { status: 403 })
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  let body: unknown
  try {
    body = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const canal = await prisma.canalIntegracion.findUnique({ where: { tipo: 'WHATSAPP' } })
  const config = parseCanalConfig<WhatsAppConfig>(decryptCanalConfig(canal?.config))
  const signature = req.headers.get('x-hub-signature-256')

  if (!config.appSecret) {
    return NextResponse.json({ error: 'Canal no configurado' }, { status: 503 })
  }
  if (!verifyMetaSignature(rawBody, signature, config.appSecret)) {
    return NextResponse.json({ error: 'Firma inválida' }, { status: 401 })
  }

  try {
    const ingested = await procesarWhatsAppWebhook(body)
    return NextResponse.json({ ok: true, procesados: ingested.length })
  } catch (err) {
    console.error('[webhook/whatsapp]', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
