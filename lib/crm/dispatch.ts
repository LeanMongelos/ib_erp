import { prisma } from '@/lib/prisma'
import { emitN8nEvento } from '@/lib/crm/n8n'
import { sendWhatsAppMessage } from '@/lib/crm/adapters/whatsapp'
import { sendMetaMessage } from '@/lib/crm/adapters/meta-messenger'
import { sendSmtpEmail } from '@/lib/crm/adapters/email-imap'
import { sendGraphEmail } from '@/lib/crm/adapters/email-graph'
import { decryptCanalConfig } from '@/lib/integraciones/canal-config'
import type { TipoCanalIntegracion } from '@prisma/client'

export async function despacharMensajeSaliente(mensajeId: string) {
  const mensaje = await prisma.mensajeCRM.findUnique({
    where: { id: mensajeId },
    include: {
      conversacion: {
        include: { canal: true, mensajes: { where: { direccion: 'ENTRANTE' }, take: 1, orderBy: { fecha: 'desc' } } },
      },
    },
  })

  if (!mensaje || mensaje.direccion !== 'SALIENTE') {
    return { ok: false, error: 'Mensaje no encontrado o no es saliente' }
  }

  const { conversacion } = mensaje
  const canal = conversacion.canal
  if (canal.estado !== 'CONECTADO' || !canal.activo) {
    return { ok: false, error: 'Canal no conectado', pendienteEnvio: true }
  }

  const destino = conversacion.externalId
  if (!destino) return { ok: false, error: 'Conversación sin externalId' }

  const config = decryptCanalConfig(canal.config)
  let result: { ok: boolean; error?: string; externalMsgId?: string }

  switch (canal.tipo as TipoCanalIntegracion) {
    case 'WHATSAPP':
      result = await sendWhatsAppMessage(config, destino, mensaje.contenido)
      break
    case 'FACEBOOK':
    case 'INSTAGRAM':
      result = await sendMetaMessage(canal.tipo, config, destino, mensaje.contenido)
      break
    case 'EMAIL_IMAP': {
      const subjectMatch = conversacion.preview?.match(/^Asunto: (.+)/)
      const subject = subjectMatch?.[1] ?? 'Consulta Ingeniería Biomédica'
      result = await sendSmtpEmail(config, conversacion.contactoHandle, subject, mensaje.contenido)
      break
    }
    case 'EMAIL_GRAPH': {
      const subjectMatch = conversacion.preview?.match(/^Asunto: (.+)/)
      const subject = subjectMatch?.[1] ?? 'Consulta Ingeniería Biomédica'
      result = await sendGraphEmail(canal.config, canal.id, conversacion.contactoHandle, subject, mensaje.contenido)
      break
    }
    default:
      return { ok: false, error: `Canal ${canal.tipo} sin adaptador de salida`, pendienteEnvio: true }
  }

  if (result.ok && result.externalMsgId) {
    await prisma.mensajeCRM.update({
      where: { id: mensajeId },
      data: { externalMsgId: result.externalMsgId },
    })
  }

  if (result.ok) {
    await emitN8nEvento('mensaje.nuevo', {
      mensajeId,
      conversacionId: conversacion.id,
      canal: canal.tipo,
      direccion: 'SALIENTE',
      contenido: mensaje.contenido,
    })
  }

  return result
}
