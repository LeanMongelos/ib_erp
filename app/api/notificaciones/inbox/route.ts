import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth, handleApiError } from '@/lib/api-auth'
import { plain } from '@/lib/serialize'
import { prisma } from '@/lib/prisma'
import { generarAlertasInbox, marcarAlertasLeidas, marcarTodasLeidas } from '@/lib/notificaciones/generar-inbox'
import { filtrarAlertasPorScope, parseInboxScope } from '@/lib/notificaciones/inbox-scope'

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth()
    const scope = parseInboxScope(req.nextUrl.searchParams.get('scope'))
    const alertas = filtrarAlertasPorScope(await generarAlertasInbox(), scope)
    const leidas = await prisma.notificacionLeida.findMany({
      where: { usuarioId: user.id },
      select: { clave: true },
    })
    const leidasSet = new Set(leidas.map((l) => l.clave))
    const items = alertas.map((a) => ({ ...a, leida: leidasSet.has(a.clave) }))
    const noLeidas = items.filter((i) => !i.leida).length
    return NextResponse.json(plain({ items, noLeidas, total: items.length }))
  } catch (error) {
    return handleApiError(error)
  }
}

const patchSchema = z.object({
  claves: z.array(z.string()).optional(),
  todas: z.boolean().optional(),
  scope: z.enum(['general', 'crm']).optional(),
})

export async function PATCH(req: NextRequest) {
  try {
    const user = await requireAuth()
    const body = patchSchema.parse(await req.json())

    if (body.todas) {
      const scope = body.scope ?? 'general'
      const alertas = filtrarAlertasPorScope(await generarAlertasInbox(), scope)
      await marcarTodasLeidas(user.id, alertas.map((a) => a.clave))
      return NextResponse.json({ ok: true })
    }

    if (body.claves?.length) {
      await marcarAlertasLeidas(user.id, body.claves)
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ ok: false }, { status: 400 })
  } catch (error) {
    return handleApiError(error)
  }
}
