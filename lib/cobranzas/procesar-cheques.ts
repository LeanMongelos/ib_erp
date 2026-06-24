import { prisma } from '@/lib/prisma'
import { sendSystemEmail } from '@/lib/mail/system-mail'
import { formatFecha, formatMonto } from '@/lib/utils'
import { getCobranzaNotifyEmails } from '@/lib/cobranzas/notify-vencimiento'

type ChequeAviso = {
  id: string
  numero: string
  banco: string | null
  monto: number
  fechaVencimiento: Date
  cliente: { nombre: string }
}

export async function enviarAvisoDepositoCheque(c: ChequeAviso): Promise<boolean> {
  const destinatarios = await getCobranzaNotifyEmails()
  const appUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'

  const subject = `[Cheques] Depositar — N° ${c.numero} vence ${formatFecha(c.fechaVencimiento)}`
  const text = [
    'Hay un cheque en cartera listo para depositar (fecha de vencimiento alcanzada o superada).',
    '',
    `Cliente: ${c.cliente.nombre}`,
    `N° cheque: ${c.numero}`,
    `Banco: ${c.banco ?? '—'}`,
    `Monto: ${formatMonto(c.monto)}`,
    `Fecha de vencimiento: ${formatFecha(c.fechaVencimiento)}`,
    '',
    `Cartera de cheques: ${appUrl}/cobranzas`,
    '',
    '— Ingeniería Biomédica ERP',
  ].join('\n')

  return sendSystemEmail({ to: destinatarios, subject, text })
}

export type ResultadoProcesarCheques = {
  revisados: number
  avisosEnviados: number
}

/** Cheques EN_CARTERA con vencimiento hoy o anterior — aviso idempotente por día. */
export async function procesarChequesADepositar(): Promise<ResultadoProcesarCheques> {
  const finHoy = new Date()
  finHoy.setHours(23, 59, 59, 999)

  const cheques = await prisma.chequeCobranza.findMany({
    where: {
      estado: 'EN_CARTERA',
      fechaVencimiento: { lte: finHoy },
      OR: [
        { recordatorioEnviadoEn: null },
        { recordatorioEnviadoEn: { lt: new Date(new Date().setHours(0, 0, 0, 0)) } },
      ],
    },
    include: { cliente: { select: { nombre: true } } },
    take: 50,
    orderBy: { fechaVencimiento: 'asc' },
  })

  let avisosEnviados = 0
  for (const c of cheques) {
    const ok = await enviarAvisoDepositoCheque(c)
    if (ok) {
      await prisma.chequeCobranza.update({
        where: { id: c.id },
        data: { recordatorioEnviadoEn: new Date() },
      })
      avisosEnviados++
    }
  }

  return { revisados: cheques.length, avisosEnviados }
}
