import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth, handleApiError } from '@/lib/api-auth'
import { plain } from '@/lib/serialize'
import { prisma } from '@/lib/prisma'
import { generarAlertasInbox, marcarAlertasLeidas, marcarTodasLeidas } from '@/lib/notificaciones/generar-inbox'
import { filtrarAlertasPorScope, parseInboxScope } from '@/lib/notificaciones/inbox-scope'
import { listarNotificacionesOcInbox, type AlertaInboxConLeida } from '@/lib/compras/oc-workflow/inbox'
import { marcarNotificacionesOcLeidasPorClaves } from '@/lib/compras/oc-workflow/notificaciones'
import type { AlertaInbox } from '@/lib/notificaciones/generar-inbox-types'

type InboxItem = AlertaInbox & { leida: boolean }

function mergeInboxItems(
  computadas: AlertaInbox[],
  persistidas: AlertaInboxConLeida[],
  leidasSet: Set<string>,
): InboxItem[] {
  const porClave = new Map<string, InboxItem>()

  for (const a of computadas) {
    porClave.set(a.clave, { ...a, leida: leidasSet.has(a.clave) })
  }
  for (const n of persistidas) {
    porClave.set(n.clave, n)
  }

  return [...porClave.values()].sort((a, b) => b.fecha.localeCompare(a.fecha))
}

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth()
    const scope = parseInboxScope(req.nextUrl.searchParams.get('scope'))
    const alertas = filtrarAlertasPorScope(
      await generarAlertasInbox({ usuarioId: user.id, permisos: user.permissions }),
      scope,
    )
    const persistidas =
      scope === 'crm' ? [] : await listarNotificacionesOcInbox(user.id)

    const leidas = await prisma.notificacionLeida.findMany({
      where: { usuarioId: user.id },
      select: { clave: true },
    })
    const leidasSet = new Set(leidas.map((l) => l.clave))
    const items = mergeInboxItems(alertas, persistidas, leidasSet)
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
      const alertas = filtrarAlertasPorScope(
        await generarAlertasInbox({ usuarioId: user.id, permisos: user.permissions }),
        scope,
      )
      const persistidas = scope === 'crm' ? [] : await listarNotificacionesOcInbox(user.id)
      const clavesComputadas = alertas.map((a) => a.clave)
      const clavesPersistidas = persistidas.filter((n) => !n.leida).map((n) => n.clave)
      await marcarTodasLeidas(user.id, clavesComputadas)
      await marcarNotificacionesOcLeidasPorClaves(clavesPersistidas, user.id)
      return NextResponse.json({ ok: true })
    }

    if (body.claves?.length) {
      const ocClaves = body.claves.filter((c) => c.startsWith('notif-oc:'))
      const otras = body.claves.filter((c) => !c.startsWith('notif-oc:'))
      if (otras.length) await marcarAlertasLeidas(user.id, otras)
      if (ocClaves.length) await marcarNotificacionesOcLeidasPorClaves(ocClaves, user.id)
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ ok: false }, { status: 400 })
  } catch (error) {
    return handleApiError(error)
  }
}
