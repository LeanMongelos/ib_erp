/**
 * Smoke CRM producción: config de canales + último mensaje opcional en BD.
 * Uso: npm run smoke:crm
 */
import { prisma } from '../lib/prisma'
import {
  detectarWorkerCrmEmailPm2,
  detectarWorkerCrmGraphPm2,
} from '../lib/admin/go-live-status'
import { decryptCanalConfig } from '../lib/integraciones/canal-config'
import type { EmailImapConfig } from '../lib/crm/config'

async function main() {
  console.log('\n=== Smoke CRM inbox ===\n')

  const [imapCanal, graphCanal, n8nCanal, ultimoMensaje] = await Promise.all([
    prisma.canalIntegracion.findUnique({ where: { tipo: 'EMAIL_IMAP' } }),
    prisma.canalIntegracion.findUnique({ where: { tipo: 'EMAIL_GRAPH' } }),
    prisma.canalIntegracion.findUnique({ where: { tipo: 'N8N' } }),
    prisma.mensajeCRM.findFirst({
      orderBy: { fecha: 'desc' },
      select: {
        id: true,
        contenido: true,
        fecha: true,
        conversacion: {
          select: {
            contactoNombre: true,
            canal: { select: { tipo: true } },
          },
        },
      },
    }),
  ])

  let canalesActivos = 0

  if (imapCanal?.activo) {
    canalesActivos++
    const cfg = imapCanal.config ? (decryptCanalConfig(imapCanal.config) as EmailImapConfig) : null
    const credOk = Boolean(cfg?.imapHost && cfg?.imapUser && cfg?.imapPassword)
    console.log(`EMAIL_IMAP: activo=${imapCanal.activo} estado=${imapCanal.estado} credenciales=${credOk ? 'OK' : 'INCOMPLETAS'}`)
    const worker = detectarWorkerCrmEmailPm2()
    console.log(`  PM2: ${worker.msg}`)
  } else {
    console.log('EMAIL_IMAP: no activo (opcional)')
  }

  if (graphCanal?.activo) {
    canalesActivos++
    console.log(`EMAIL_GRAPH: activo=${graphCanal.activo} estado=${graphCanal.estado}`)
    const worker = detectarWorkerCrmGraphPm2()
    console.log(`  PM2: ${worker.msg}`)
  } else {
    console.log('EMAIL_GRAPH: no activo (opcional)')
  }

  if (n8nCanal?.activo || process.env.N8N_API_KEY?.trim()) {
    canalesActivos++
    console.log(`N8N: canal activo=${n8nCanal?.activo ?? false} N8N_API_KEY=${process.env.N8N_API_KEY?.trim() ? 'definida' : 'ausente'}`)
  } else {
    console.log('N8N: no configurado (opcional)')
  }

  if (ultimoMensaje) {
    const preview = ultimoMensaje.contenido.slice(0, 60).replace(/\n/g, ' ')
    const canal = ultimoMensaje.conversacion.canal.tipo
    console.log(`\nÚltimo mensaje CRM (${canal}): ${ultimoMensaje.conversacion.contactoNombre} — "${preview}…" — ${ultimoMensaje.fecha.toISOString()}`)
  } else if (canalesActivos > 0) {
    console.log('\n⊘ Sin mensajes en BD aún — normal tras recién configurar')
  } else {
    console.log('\n⊘ CRM email no activo — smoke omitido')
  }

  console.log('\n✅ Smoke CRM completado\n')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
