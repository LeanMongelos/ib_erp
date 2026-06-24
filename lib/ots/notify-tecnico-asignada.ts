/**
 * Notifica al técnico por email cuando se le asigna una OT.
 * No bloquea el PATCH; deduplicación vía SystemLog.
 */

import { NivelLog } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { registrarError } from '@/lib/error-log'
import { sendSystemEmail } from '@/lib/mail/system-mail'

const ORIGEN = 'ot-tecnico-asignada'
const PREFIX = 'tecnico-ot-asignada:'

function aplicarPlantilla(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? '')
}

async function yaNotificado(otId: string, tecnicoId: string): Promise<boolean> {
  const clave = `${PREFIX}${otId}:${tecnicoId}:ok`
  const prev = await prisma.systemLog.findFirst({
    where: { origen: ORIGEN, mensaje: clave },
    select: { id: true },
  })
  return Boolean(prev)
}

async function marcarEnviado(otId: string, tecnicoId: string, email: string): Promise<void> {
  await registrarError({
    nivel: NivelLog.INFO,
    origen: ORIGEN,
    mensaje: `${PREFIX}${otId}:${tecnicoId}:ok`,
    metadata: { otId, tecnicoId, email },
  })
}

async function marcarFallo(otId: string, tecnicoId: string, detalle: string): Promise<void> {
  await registrarError({
    nivel: NivelLog.WARN,
    origen: ORIGEN,
    mensaje: `${PREFIX}${otId}:${tecnicoId}:fail`,
    metadata: { otId, tecnicoId, detalle },
  })
}

/** Envía aviso al técnico recién asignado. Idempotente por OT+técnico. */
export async function notifyTecnicoOtAsignada(otId: string, tecnicoId: string): Promise<void> {
  if (!tecnicoId?.trim()) return
  if (await yaNotificado(otId, tecnicoId)) return

  const [ot, tecnico] = await Promise.all([
    prisma.ordenTrabajo.findUnique({
      where: { id: otId },
      select: {
        numero: true,
        tipo: true,
        prioridad: true,
        descripcion: true,
        cliente: { select: { nombre: true, ciudad: true } },
        equipo: { select: { nombre: true, numeroSerie: true } },
      },
    }),
    prisma.usuario.findUnique({
      where: { id: tecnicoId },
      select: { nombre: true, email: true, activo: true },
    }),
  ])

  if (!ot || !tecnico?.activo) return
  const email = tecnico.email?.trim()
  if (!email) return

  const appUrl = (process.env.NEXTAUTH_URL ?? 'https://erp-ibiomedica.com.ar').replace(/\/$/, '')
  const equipoLabel = ot.equipo
    ? `${ot.equipo.nombre}${ot.equipo.numeroSerie ? ` (S/N ${ot.equipo.numeroSerie})` : ''}`
    : '—'

  const vars: Record<string, string> = {
    numero: ot.numero,
    tecnico: tecnico.nombre,
    cliente: ot.cliente.nombre,
    ciudad: ot.cliente.ciudad ?? '—',
    tipo: ot.tipo,
    prioridad: ot.prioridad,
    equipo: equipoLabel,
    descripcion: ot.descripcion,
    url: `${appUrl}/servicio-tecnico/${otId}`,
  }

  const plantilla = await prisma.plantillaNotificacion.findUnique({
    where: { codigo: 'OT_ASIGNADA' },
  })

  const subject =
    plantilla?.activo !== false && plantilla?.asunto
      ? aplicarPlantilla(plantilla.asunto, vars)
      : `OT ${vars.numero} asignada — ${vars.cliente}`

  const cuerpoDefault = [
    `Hola ${vars.tecnico},`,
    '',
    `Se te asignó la orden de trabajo ${vars.numero} (${vars.tipo}).`,
    '',
    `Cliente: ${vars.cliente} (${vars.ciudad})`,
    `Equipo: ${vars.equipo}`,
    `Prioridad: ${vars.prioridad}`,
    `Descripción: ${vars.descripcion}`,
    '',
    `Ver OT: ${vars.url}`,
    '',
    '— Ingeniería Biomédica ERP',
  ].join('\n')

  const text =
    plantilla?.activo !== false && plantilla?.cuerpo
      ? aplicarPlantilla(plantilla.cuerpo, vars)
      : cuerpoDefault

  const ok = await sendSystemEmail({ to: email, subject, text })
  if (ok) {
    await marcarEnviado(otId, tecnicoId, email)
  } else {
    await marcarFallo(otId, tecnicoId, 'SMTP no disponible o error de envío')
  }
}
