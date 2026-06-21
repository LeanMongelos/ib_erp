import { prisma } from '@/lib/prisma'
import { emitN8nEvento } from '@/lib/crm/n8n'
import type { TipoCanalIntegracion } from '@prisma/client'

export type IngestarMensajeInput = {
  tipoCanal: TipoCanalIntegracion
  externalId: string
  contactoNombre: string
  contactoHandle: string
  contenido: string
  externalMsgId?: string
  tipo?: string
  emailRemitente?: string
}

async function vincularClientePorEmail(email?: string) {
  if (!email) return null
  const normalizado = email.trim().toLowerCase()
  const cliente = await prisma.cliente.findFirst({
    where: {
      OR: [
        { email: { equals: normalizado, mode: 'insensitive' } },
        { contactos: { some: { email: { equals: normalizado, mode: 'insensitive' } } } },
      ],
    },
    select: { id: true },
  })
  return cliente?.id ?? null
}

export async function ingestarMensajeEntrante(input: IngestarMensajeInput) {
  const canal = await prisma.canalIntegracion.findUnique({ where: { tipo: input.tipoCanal } })
  if (!canal) throw new Error(`Canal ${input.tipoCanal} no configurado`)

  if (input.externalMsgId) {
    const dup = await prisma.mensajeCRM.findFirst({
      where: { externalMsgId: input.externalMsgId },
      include: { conversacion: true },
    })
    if (dup) return { mensaje: dup, conversacion: dup.conversacion, duplicado: true }
  }

  let conversacion = await prisma.conversacionCRM.findFirst({
    where: { canalId: canal.id, externalId: input.externalId },
  })

  const clienteId = await vincularClientePorEmail(input.emailRemitente)
  const esNueva = !conversacion

  if (!conversacion) {
    conversacion = await prisma.conversacionCRM.create({
      data: {
        canalId: canal.id,
        externalId: input.externalId,
        contactoNombre: input.contactoNombre,
        contactoHandle: input.contactoHandle,
        preview: input.contenido.slice(0, 120),
        clienteId,
        sinLeer: 1,
        ultimoMensajeEn: new Date(),
      },
    })
  }

  const mensaje = await prisma.$transaction(async (tx) => {
    const m = await tx.mensajeCRM.create({
      data: {
        conversacionId: conversacion!.id,
        direccion: 'ENTRANTE',
        tipo: input.tipo ?? 'TEXTO',
        contenido: input.contenido,
        externalMsgId: input.externalMsgId,
      },
    })
    await tx.conversacionCRM.update({
      where: { id: conversacion!.id },
      data: {
        preview: input.contenido.slice(0, 120),
        ultimoMensajeEn: new Date(),
        sinLeer: { increment: 1 },
        ...(clienteId && !conversacion!.clienteId ? { clienteId } : {}),
        estado: 'ABIERTA',
      },
    })
    return m
  })

  await prisma.canalIntegracion.update({
    where: { id: canal.id },
    data: { ultimoSync: new Date(), errorMensaje: null },
  })

  const payload = {
    mensajeId: mensaje.id,
    conversacionId: conversacion.id,
    canal: input.tipoCanal,
    contactoNombre: input.contactoNombre,
    contactoHandle: input.contactoHandle,
    contenido: input.contenido,
  }

  if (esNueva) {
    await emitN8nEvento('conversacion.creada', payload)
  }
  await emitN8nEvento('mensaje.nuevo', { ...payload, direccion: 'ENTRANTE' })

  return { mensaje, conversacion, duplicado: false, esNueva }
}
