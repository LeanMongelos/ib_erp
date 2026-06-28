import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { parseCanalConfig, type MetaPageConfig } from '@/lib/crm/config'
import { decryptCanalConfig } from '@/lib/integraciones/canal-config'
import { procesarMetaWebhook } from '@/lib/crm/adapters/meta-messenger'
import { resolveVerifyToken, verifyMetaChallenge, verifyMetaSignature } from '@/lib/crm/webhook-verify'
import { assertWebhookRateLimit } from '@/lib/security/webhook-guard'

export async function GET(req: NextRequest) {
  await assertWebhookRateLimit(req.headers)
  const { searchParams } = new URL(req.url)
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  const expected = await resolveVerifyToken(['FACEBOOK', 'INSTAGRAM'])
  const ok = verifyMetaChallenge(mode, token, challenge, expected)
  if (ok) return new NextResponse(ok, { status: 200 })
  return NextResponse.json({ error: 'Verificación fallida' }, { status: 403 })
}

export async function POST(req: NextRequest) {
  await assertWebhookRateLimit(req.headers)
  const rawBody = await req.text()
  let body: unknown
  try {
    body = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const canales = await prisma.canalIntegracion.findMany({
    where: { tipo: { in: ['FACEBOOK', 'INSTAGRAM'] } },
  })
  const appSecret = canales
    .map((c) => parseCanalConfig<MetaPageConfig>(decryptCanalConfig(c.config)).appSecret)
    .find(Boolean)

  const signature = req.headers.get('x-hub-signature-256')
  if (!appSecret) {
    return NextResponse.json({ error: 'Canal no configurado' }, { status: 503 })
  }
  if (!verifyMetaSignature(rawBody, signature, appSecret)) {
    return NextResponse.json({ error: 'Firma inválida' }, { status: 401 })
  }

  try {
    const ingested = await procesarMetaWebhook(body)
    return NextResponse.json({ ok: true, procesados: ingested.length })
  } catch (err) {
    console.error('[webhook/meta]', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
