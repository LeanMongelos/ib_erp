import type { Prisma, TipoNotificacionOC } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { hrefOc } from '@/lib/compras/oc-workflow/constants'
import { obtenerAprobadoresOC } from '@/lib/compras/oc-workflow/aprobadores'

type Db = Prisma.TransactionClient | typeof prisma

interface OcNotifContext {
  id: string
  numero: string
  justificacion?: string | null
  solicitanteId?: string | null
  creadoPorId?: string | null
  solicitante?: { nombre: string } | null
}

function destinatarioSolicitante(oc: OcNotifContext): string | null {
  return oc.solicitanteId ?? oc.creadoPorId ?? null
}

export async function notificarAprobadoresOcPendiente(
  oc: OcNotifContext,
  db: Db = prisma,
) {
  const aprobadores = await obtenerAprobadoresOC(db)
  const solicitante = oc.solicitante?.nombre ?? 'Solicitante'
  const motivo = oc.justificacion?.trim() || 'Sin detalle'

  for (const ap of aprobadores) {
    const pendiente = await db.notificacionUsuario.findFirst({
      where: {
        usuarioId: ap.id,
        ordenCompraId: oc.id,
        tipo: 'OC_PENDIENTE_APROBACION',
        resueltaEn: null,
      },
    })
    if (pendiente) continue

    await db.notificacionUsuario.create({
      data: {
        usuarioId: ap.id,
        tipo: 'OC_PENDIENTE_APROBACION',
        ordenCompraId: oc.id,
        titulo: `Aprobar OC ${oc.numero}`,
        mensaje: `${solicitante}: ${motivo.slice(0, 120)}`,
        href: hrefOc(oc.id),
        prioridad: 'urgente',
      },
    })
  }
}

export async function resolverNotificacionesAprobacionPendiente(
  ordenCompraId: string,
  db: Db = prisma,
) {
  await db.notificacionUsuario.updateMany({
    where: {
      ordenCompraId,
      tipo: 'OC_PENDIENTE_APROBACION',
      resueltaEn: null,
    },
    data: { resueltaEn: new Date() },
  })
}

export async function notificarSolicitanteOc(
  oc: OcNotifContext,
  tipo: Extract<TipoNotificacionOC, 'OC_APROBADA' | 'OC_RECHAZADA'>,
  actorNombre: string,
  extra?: { motivo?: string },
  db: Db = prisma,
) {
  const usuarioId = destinatarioSolicitante(oc)
  if (!usuarioId) return

  const titulo =
    tipo === 'OC_APROBADA'
      ? `OC ${oc.numero} aprobada`
      : `OC ${oc.numero} rechazada`

  const mensaje =
    tipo === 'OC_APROBADA'
      ? `${actorNombre} aprobó tu solicitud de compra.`
      : `${actorNombre} rechazó la OC${extra?.motivo ? `: ${extra.motivo}` : '.'}`

  await db.notificacionUsuario.create({
    data: {
      usuarioId,
      tipo,
      ordenCompraId: oc.id,
      titulo,
      mensaje,
      href: hrefOc(oc.id),
      prioridad: tipo === 'OC_RECHAZADA' ? 'urgente' : 'importante',
    },
  })
}

export async function marcarNotificacionUsuarioLeida(notificacionId: string, usuarioId: string) {
  await prisma.notificacionUsuario.updateMany({
    where: { id: notificacionId, usuarioId },
    data: { leidaEn: new Date() },
  })
}

export async function marcarNotificacionesOcLeidasPorClaves(claves: string[], usuarioId: string) {
  const ids = claves
    .filter((c) => c.startsWith('notif-oc:'))
    .map((c) => c.slice('notif-oc:'.length))
  if (ids.length === 0) return

  await prisma.notificacionUsuario.updateMany({
    where: {
      id: { in: ids },
      usuarioId,
      tipo: { in: ['OC_APROBADA', 'OC_RECHAZADA'] },
    },
    data: { leidaEn: new Date() },
  })
}
