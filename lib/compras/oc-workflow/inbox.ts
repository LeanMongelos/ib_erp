import type { AlertaInbox, PrioridadAlerta } from '@/lib/notificaciones/generar-inbox-types'
import { prisma } from '@/lib/prisma'

export type AlertaInboxConLeida = AlertaInbox & { leida: boolean }

function prioridadFromString(p: string): PrioridadAlerta {
  if (p === 'urgente') return 'urgente'
  if (p === 'info') return 'info'
  return 'importante'
}

/** Notificaciones persistidas de OC → formato campanita. */
export async function listarNotificacionesOcInbox(usuarioId: string): Promise<AlertaInboxConLeida[]> {
  const rows = await prisma.notificacionUsuario.findMany({
    where: {
      usuarioId,
      OR: [
        { tipo: 'OC_PENDIENTE_APROBACION', resueltaEn: null },
        { tipo: { in: ['OC_APROBADA', 'OC_RECHAZADA'] }, leidaEn: null },
      ],
    },
    orderBy: { creadaEn: 'desc' },
    take: 30,
  })

  return rows.map((n) => ({
    clave: `notif-oc:${n.id}`,
    categoria: 'compras' as const,
    prioridad: prioridadFromString(n.prioridad),
    titulo: n.titulo,
    mensaje: n.mensaje,
    href: n.href,
    fecha: n.creadaEn.toISOString(),
    leida: n.tipo === 'OC_PENDIENTE_APROBACION' ? false : !!n.leidaEn,
  }))
}
