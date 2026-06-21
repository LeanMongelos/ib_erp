import nodemailer from 'nodemailer'
import { ImapFlow } from 'imapflow'
import { prisma } from '@/lib/prisma'
import { decryptCanalConfig } from '@/lib/integraciones/canal-config'
import { ingestarMensajeEntrante } from '@/lib/crm/ingest'
import type { EmailImapConfig } from '@/lib/crm/config'

function normalizeSubject(subject: string) {
  return subject.replace(/^(re|fw|fwd):\s*/gi, '').trim().toLowerCase()
}

function threadKey(from: string, subject: string, inReplyTo?: string, references?: string) {
  const root =
    references?.split(/\s+/).find((r) => r.startsWith('<')) ??
    inReplyTo ??
    `${from}:${normalizeSubject(subject)}`
  return root.replace(/^<|>$/g, '')
}

function extractText(raw: string): string {
  const plain = raw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  return plain.slice(0, 4000)
}

export async function pollImapInbox(): Promise<number> {
  const canal = await prisma.canalIntegracion.findUnique({ where: { tipo: 'EMAIL_IMAP' } })
  if (!canal?.activo || canal.estado !== 'CONECTADO') return 0

  const c = decryptCanalConfig(canal.config) as EmailImapConfig
  if (!c.imapHost || !c.imapUser || !c.imapPassword) return 0

  const client = new ImapFlow({
    host: c.imapHost,
    port: Number(c.imapPort ?? 993),
    secure: Number(c.imapPort ?? 993) === 993,
    auth: { user: c.imapUser, pass: c.imapPassword },
    logger: false,
  })

  let processed = 0
  const lastUid = c.lastImapUid ?? 0

  try {
    await client.connect()
    const lock = await client.getMailboxLock('INBOX')
    try {
      const uids = await client.search({ uid: `${lastUid + 1}:*` }, { uid: true })
      if (!uids || uids.length === 0) return 0

      let maxUid = lastUid
      for await (const msg of client.fetch(uids, { envelope: true, source: true, uid: true }, { uid: true })) {
        if (!msg.envelope?.from?.[0]?.address) continue
        const from = msg.envelope.from[0]
        const email = from.address ?? ''
        const name = from.name ?? email.split('@')[0]
        const subject = msg.envelope.subject ?? '(sin asunto)'
        const envelope = msg.envelope
        const inReplyTo = envelope?.inReplyTo ?? undefined
        const references = (envelope as { references?: string[] })?.references?.join(' ')
        const key = threadKey(email, subject, inReplyTo, references)

        const raw = msg.source?.toString('utf8') ?? subject
        const text = extractText(raw) || subject

        await ingestarMensajeEntrante({
          tipoCanal: 'EMAIL_IMAP',
          externalId: key,
          contactoNombre: name,
          contactoHandle: email,
          contenido: `Asunto: ${subject}\n\n${text}`,
          externalMsgId: msg.envelope.messageId ?? `uid-${msg.uid}`,
          emailRemitente: email,
          tipo: 'EMAIL',
        })

        if (msg.uid && msg.uid > maxUid) maxUid = msg.uid
        processed += 1
      }

      if (maxUid > lastUid) {
        const configNuevo = { ...c, lastImapUid: maxUid }
        await prisma.canalIntegracion.update({
          where: { id: canal.id },
          data: { config: configNuevo as object, ultimoSync: new Date(), errorMensaje: null },
        })
      }
    } finally {
      lock.release()
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error de conexión IMAP'
    await prisma.canalIntegracion.update({
      where: { tipo: 'EMAIL_IMAP' },
      data: { estado: 'ERROR', errorMensaje: msg },
    })
    throw err
  } finally {
    await client.logout().catch(() => {})
  }

  return processed
}

export async function sendSmtpEmail(config: unknown, to: string, subject: string, text: string) {
  const c = decryptCanalConfig(config) as EmailImapConfig
  if (!c.smtpHost || !c.smtpUser) {
    return { ok: false, error: 'SMTP no configurado' }
  }

  const transporter = nodemailer.createTransport({
    host: c.smtpHost,
    port: Number(c.smtpPort ?? 587),
    secure: Number(c.smtpPort) === 465,
    auth: {
      user: c.smtpUser,
      pass: c.smtpPassword ?? c.imapPassword,
    },
  })

  try {
    const info = await transporter.sendMail({
      from: `"${c.fromName ?? 'Ingeniería Biomédica'}" <${c.fromEmail ?? c.smtpUser}>`,
      to,
      subject: subject.startsWith('Re:') ? subject : `Re: ${subject}`,
      text,
    })
    return { ok: true, externalMsgId: info.messageId }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Error de envío SMTP' }
  }
}

export async function testEmailConnection(config: unknown): Promise<{ ok: boolean; error?: string }> {
  const c = decryptCanalConfig(config) as EmailImapConfig
  if (!c.imapHost || !c.imapUser || !c.imapPassword) {
    return { ok: false, error: 'Faltan datos IMAP' }
  }

  const client = new ImapFlow({
    host: c.imapHost,
    port: Number(c.imapPort ?? 993),
    secure: Number(c.imapPort ?? 993) === 993,
    auth: { user: c.imapUser, pass: c.imapPassword },
    logger: false,
  })

  try {
    await client.connect()
    await client.logout()
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Error de conexión IMAP' }
  }

  if (c.smtpHost && c.smtpUser) {
    const transporter = nodemailer.createTransport({
      host: c.smtpHost,
      port: Number(c.smtpPort ?? 587),
      secure: Number(c.smtpPort) === 465,
      auth: { user: c.smtpUser, pass: c.smtpPassword ?? c.imapPassword },
    })
    try {
      await transporter.verify()
    } catch (err) {
      return { ok: false, error: `IMAP OK, SMTP falló: ${err instanceof Error ? err.message : 'error'}` }
    }
  }

  return { ok: true }
}
