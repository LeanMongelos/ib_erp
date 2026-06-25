/**
 * Detecta conversaciones ABIERTA sin respuesta del staff ≥ 2 h y emite cliente.sin_respuesta_2h.
 * Idempotente por mensaje entrante (SystemLog) — no re-emite hasta un nuevo mensaje del cliente.
 */

import { subHours } from 'date-fns'
import { NivelLog } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { registrarError } from '@/lib/error-log'
import { emitN8nEvento, getN8nConfig } from '@/lib/crm/n8n'

const ORIGEN = 'crm-sin-respuesta-2h'
const HORAS_SIN_RESPUESTA = 2

function claveEvento(conversacionId: string, mensajeId: string): string {
  return `${ORIGEN}:${conversacionId}:${mensajeId}`
}

async function yaEmitido(clave: string): Promise<boolean> {
  const prev = await prisma.systemLog.findFirst({
    where: { origen: ORIGEN, mensaje: { startsWith: `${clave}:` } },
    select: { id: true },
  })
  return Boolean(prev)
}

async function marcarEmitido(clave: string, metadata: Record<string, unknown>): Promise<void> {
  await registrarError({
    nivel: NivelLog.INFO,
    origen: ORIGEN,
    mensaje: `${clave}:ok`,
    metadata,
  })
}

export type ResultadoSinRespuesta2h = {
  revisadas: number
  emitidas: number
}

export async function procesarConversacionesSinRespuesta2h(): Promise<ResultadoSinRespuesta2h> {
  const config = await getN8nConfig()
  if (!config?.webhookUrlN8n) return { revisadas: 0, emitidas: 0 }

  const limite = subHours(new Date(), HORAS_SIN_RESPUESTA)

  const candidatas = await prisma.conversacionCRM.findMany({
    where: {
      estado: 'ABIERTA',
      ultimoMensajeEn: { lte: limite },
    },
    include: {
      canal: { select: { tipo: true, nombre: true } },
      cliente: { select: { id: true, nombre: true } },
      asignado: { select: { id: true, nombre: true } },
      mensajes: {
        orderBy: { fecha: 'desc' },
        take: 1,
        select: { id: true, direccion: true, fecha: true, contenido: true },
      },
    },
  })

  let emitidas = 0

  for (const conv of candidatas) {
    const ultimo = conv.mensajes[0]
    if (!ultimo || ultimo.direccion !== 'ENTRANTE') continue

    const clave = claveEvento(conv.id, ultimo.id)
    if (await yaEmitido(clave)) continue

    await emitN8nEvento('cliente.sin_respuesta_2h', {
      conversacionId: conv.id,
      mensajeId: ultimo.id,
      canal: conv.canal.tipo,
      canalNombre: conv.canal.nombre,
      contactoNombre: conv.contactoNombre,
      contactoHandle: conv.contactoHandle,
      preview: conv.preview,
      ultimoMensajeEn: conv.ultimoMensajeEn.toISOString(),
      clienteId: conv.clienteId,
      clienteNombre: conv.cliente?.nombre ?? null,
      asignadoId: conv.asignadoId,
      asignadoNombre: conv.asignado?.nombre ?? null,
      horasSinRespuesta: HORAS_SIN_RESPUESTA,
    })

    await marcarEmitido(clave, { conversacionId: conv.id, mensajeId: ultimo.id })
    emitidas++
  }

  return { revisadas: candidatas.length, emitidas }
}
