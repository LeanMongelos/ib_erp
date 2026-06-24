/**
 * Lógica compartida del checklist go-live (script CLI + API admin).
 */

import { execSync } from 'child_process'
import fs from 'fs'
import { prisma } from '@/lib/prisma'
import { validarEnvProd, type EnvCheck } from '@/lib/env/validar-prod'
import {
  adminNotifyEmailDefinido,
  smtpEnvConfigurado,
  validarAlertasEnvProd,
} from '@/lib/env/alertas-prod'
import {
  emisorTieneCertificados,
  estadoPreparacionAfip,
} from '@/lib/afip/validar-emision'
import { getAdminNotifyEmails } from '@/lib/mail/system-mail'
import { decryptCanalConfig } from '@/lib/integraciones/canal-config'
import type { EmailImapConfig } from '@/lib/crm/config'
import type { EmailGraphConfig } from '@/lib/crm/adapters/email-graph'

export type GoLiveNivel = 'pass' | 'warn' | 'fail'

export type GoLiveItem = {
  seccion: string
  nivel: GoLiveNivel
  msg: string
  codigo?: string
}

export type WorkerAfipStatus = {
  detectado: boolean
  online?: boolean
  estado?: string
  msg: string
}

export type GoLiveStatus = {
  fecha: string
  items: GoLiveItem[]
  resumen: { pass: number; warn: number; fail: number }
  listo: boolean
  workerAfip: WorkerAfipStatus
}

function envToNivel(c: EnvCheck): GoLiveNivel {
  if (c.nivel === 'ok') return 'pass'
  if (c.nivel === 'warn') return 'warn'
  return 'fail'
}

function addItem(items: GoLiveItem[], seccion: string, nivel: GoLiveNivel, msg: string, codigo?: string) {
  items.push({ seccion, nivel, msg, codigo })
}

function detectarWorkerPm2(workerName: string): WorkerAfipStatus {
  try {
    const out = execSync('pm2 jlist', { encoding: 'utf8', timeout: 4000 })
    const list = JSON.parse(out) as Array<{
      name?: string
      pm2_env?: { status?: string }
    }>
    const worker = list.find((p) => p.name === workerName)
    if (!worker) {
      return { detectado: false, msg: `${workerName} no registrado en PM2` }
    }
    const estado = worker.pm2_env?.status ?? 'desconocido'
    const online = estado === 'online'
    return {
      detectado: true,
      online,
      estado,
      msg: online ? `${workerName} online` : `${workerName} ${estado}`,
    }
  } catch {
    return { detectado: false, msg: 'PM2 no disponible en este host' }
  }
}

export function detectarWorkerAfipPm2(): WorkerAfipStatus {
  return detectarWorkerPm2('worker-afip')
}

export function detectarWorkerCobranzasPm2(): WorkerAfipStatus {
  return detectarWorkerPm2('worker-cobranzas')
}

export function detectarWorkerCrmEmailPm2(): WorkerAfipStatus {
  return detectarWorkerPm2('worker-crm-email')
}

export function detectarWorkerCrmGraphPm2(): WorkerAfipStatus {
  return detectarWorkerPm2('worker-crm-graph')
}

function envParcialPrefijo(env: NodeJS.ProcessEnv, prefix: string, ignorar: string[] = []): boolean {
  const keys = Object.keys(env).filter(
    (k) => k.startsWith(prefix) && !ignorar.includes(k) && String(env[k] ?? '').trim(),
  )
  if (keys.length === 0) return false
  const requeridas = Object.keys(env).filter((k) => k.startsWith(prefix) && !ignorar.includes(k))
  const definidas = requeridas.filter((k) => String(env[k] ?? '').trim())
  return definidas.length > 0 && definidas.length < requeridas.length
}

function camposParciales(
  cfg: Record<string, unknown>,
  campos: string[],
): { parcial: boolean; faltantes: string[] } {
  const conValor = campos.filter((c) => String(cfg[c] ?? '').trim())
  if (conValor.length === 0) return { parcial: false, faltantes: [] }
  const faltantes = campos.filter((c) => !String(cfg[c] ?? '').trim())
  return { parcial: faltantes.length > 0, faltantes }
}

function imapListo(cfg: EmailImapConfig): boolean {
  return Boolean(cfg.imapHost?.trim() && cfg.imapUser?.trim() && cfg.imapPassword?.trim())
}

function graphListo(cfg: EmailGraphConfig): boolean {
  const base = Boolean(cfg.tenantId?.trim() && cfg.clientId?.trim() && cfg.clientSecret?.trim())
  const auth = Boolean(cfg.refreshToken?.trim() || cfg.accessToken?.trim())
  return base && auth && Boolean(cfg.mailboxEmail?.trim())
}

async function validarCrmGoLive(items: GoLiveItem[], env: NodeJS.ProcessEnv) {
  const ignorarPoll = ['CRM_EMAIL_POLL_MS', 'CRM_GRAPH_POLL_MS']
  if (envParcialPrefijo(env, 'CRM_EMAIL_', ignorarPoll)) {
    addItem(
      items,
      'crm',
      'warn',
      'Variables CRM_EMAIL_* parcialmente definidas en .env — completar o usar Integraciones',
      'crm_email_env_parcial',
    )
  }
  if (envParcialPrefijo(env, 'CRM_GRAPH_', ignorarPoll)) {
    addItem(
      items,
      'crm',
      'warn',
      'Variables CRM_GRAPH_* parcialmente definidas en .env — completar o usar Integraciones',
      'crm_graph_env_parcial',
    )
  }

  const [imapCanal, graphCanal, n8nCanal] = await Promise.all([
    prisma.canalIntegracion.findUnique({ where: { tipo: 'EMAIL_IMAP' } }),
    prisma.canalIntegracion.findUnique({ where: { tipo: 'EMAIL_GRAPH' } }),
    prisma.canalIntegracion.findUnique({ where: { tipo: 'N8N' } }),
  ])

  if (imapCanal?.config) {
    const cfg = decryptCanalConfig(imapCanal.config) as EmailImapConfig
    const { parcial, faltantes } = camposParciales(cfg as Record<string, unknown>, [
      'imapHost',
      'imapUser',
      'imapPassword',
    ])
    if (parcial) {
      addItem(
        items,
        'crm',
        'warn',
        `Canal EMAIL_IMAP incompleto — faltan: ${faltantes.join(', ')}`,
        'crm_imap_parcial',
      )
    } else if (imapCanal.activo && !imapListo(cfg)) {
      addItem(items, 'crm', 'warn', 'Canal EMAIL_IMAP activo sin credenciales IMAP', 'crm_imap_sin_cred')
    }

    const imapOperativo = imapCanal.activo && imapCanal.estado === 'CONECTADO' && imapListo(cfg)
    if (imapOperativo) {
      const worker = detectarWorkerCrmEmailPm2()
      if (!worker.detectado) {
        addItem(
          items,
          'crm',
          'warn',
          `${worker.msg} — bandeja IMAP no se sincroniza`,
          'worker_crm_email_no_pm2',
        )
      } else if (worker.online) {
        addItem(items, 'crm', 'pass', `EMAIL_IMAP conectado — ${worker.msg}`)
      } else {
        addItem(items, 'crm', 'warn', worker.msg, 'worker_crm_email_offline')
      }
    } else if (imapCanal.activo && imapListo(cfg) && imapCanal.estado !== 'CONECTADO') {
      addItem(
        items,
        'crm',
        'warn',
        'Canal EMAIL_IMAP activo pero no CONECTADO — probar conexión en Integraciones',
        'crm_imap_no_conectado',
      )
    }
  }

  if (graphCanal?.config) {
    const cfg = decryptCanalConfig(graphCanal.config) as EmailGraphConfig
    const { parcial, faltantes } = camposParciales(cfg as Record<string, unknown>, [
      'tenantId',
      'clientId',
      'clientSecret',
      'mailboxEmail',
    ])
    if (parcial) {
      addItem(
        items,
        'crm',
        'warn',
        `Canal EMAIL_GRAPH incompleto — faltan: ${faltantes.join(', ')}`,
        'crm_graph_parcial',
      )
    } else if (graphCanal.activo && !graphListo(cfg)) {
      addItem(
        items,
        'crm',
        'warn',
        'Canal EMAIL_GRAPH activo sin OAuth completo — autorizar en Integraciones',
        'crm_graph_sin_oauth',
      )
    }

    const graphOperativo = graphCanal.activo && graphCanal.estado === 'CONECTADO' && graphListo(cfg)
    if (graphOperativo) {
      const worker = detectarWorkerCrmGraphPm2()
      if (!worker.detectado) {
        addItem(
          items,
          'crm',
          'warn',
          `${worker.msg} — bandeja Outlook no se sincroniza`,
          'worker_crm_graph_no_pm2',
        )
      } else if (worker.online) {
        addItem(items, 'crm', 'pass', `EMAIL_GRAPH conectado — ${worker.msg}`)
      } else {
        addItem(items, 'crm', 'warn', worker.msg, 'worker_crm_graph_offline')
      }
    } else if (graphCanal.activo && graphListo(cfg) && graphCanal.estado !== 'CONECTADO') {
      addItem(
        items,
        'crm',
        'warn',
        'Canal EMAIL_GRAPH activo pero no CONECTADO — completar OAuth en Integraciones',
        'crm_graph_no_conectado',
      )
    }
  }

  if (n8nCanal?.activo) {
    const cfg = decryptCanalConfig(n8nCanal.config)
    const { parcial } = camposParciales(cfg, ['webhookUrlN8n', 'apiKey'])
    if (parcial || (!cfg.webhookUrlN8n && !env.N8N_API_KEY?.trim())) {
      addItem(
        items,
        'crm',
        'warn',
        'Canal N8N activo con configuración parcial — webhook o N8N_API_KEY incompletos',
        'crm_n8n_parcial',
      )
    } else {
      addItem(items, 'crm', 'pass', 'Canal N8N configurado — webhooks /api/n8n/* protegidos con Bearer')
    }
  } else if (env.N8N_API_KEY?.trim()) {
    addItem(items, 'crm', 'pass', 'N8N_API_KEY en .env — endpoints /api/n8n/* habilitados')
  }

  const crmItems = items.filter((i) => i.seccion === 'crm')
  if (crmItems.length === 0) {
    addItem(
      items,
      'crm',
      'pass',
      'CRM email/Graph no configurado — opcional hasta activar Integraciones',
    )
  }
}

async function validarOnboardingGoLive(items: GoLiveItem[]) {
  const admin = await prisma.usuario.findFirst({
    where: {
      activo: true,
      roles: { some: { rol: { clave: { in: ['SUPERADMIN', 'GERENTE'] } } } },
    },
    select: { email: true, nombre: true },
    orderBy: { creadoEn: 'asc' },
  })
  if (admin) {
    addItem(
      items,
      'onboarding',
      'pass',
      `Administrador activo: ${admin.nombre} (${admin.email})`,
      'onboarding_admin',
    )
  } else {
    addItem(
      items,
      'onboarding',
      'fail',
      'Sin usuario SUPERADMIN/GERENTE activo — crear admin en Usuarios',
      'onboarding_admin',
    )
  }

  const emisorActivo = await prisma.emisor.findFirst({
    where: { activo: true },
    select: { razonSocial: true, ambiente: true, predeterminado: true },
  })
  if (emisorActivo) {
    const pred = emisorActivo.predeterminado ? ' [predeterminado]' : ''
    addItem(
      items,
      'onboarding',
      'pass',
      `Emisor configurado: ${emisorActivo.razonSocial}${pred} (${emisorActivo.ambiente})`,
      'onboarding_emisor',
    )
  } else {
    addItem(
      items,
      'onboarding',
      'fail',
      'Sin emisor activo — Configuración → Emisores',
      'onboarding_emisor',
    )
  }

  const smtpOk = smtpEnvConfigurado(process.env)
  if (smtpOk) {
    addItem(items, 'onboarding', 'pass', 'SMTP del sistema configurado (SYSTEM_SMTP_*)', 'onboarding_smtp')
  } else {
    const canal = await prisma.canalIntegracion.findUnique({ where: { tipo: 'EMAIL_IMAP' } })
    if (canal?.activo && canal.estado === 'CONECTADO') {
      addItem(
        items,
        'onboarding',
        'pass',
        'Canal EMAIL_IMAP conectado — envío de correos disponible',
        'onboarding_smtp',
      )
    } else {
      addItem(
        items,
        'onboarding',
        'fail',
        'SMTP no configurado — definir SYSTEM_SMTP_* o conectar EMAIL_IMAP',
        'onboarding_smtp',
      )
    }
  }

  let cronOk = false
  try {
    if (fs.existsSync('/etc/cron.d/ibiomedica-cron')) {
      cronOk = true
      addItem(
        items,
        'onboarding',
        'pass',
        'Cron del VPS instalado (/etc/cron.d/ibiomedica-cron)',
        'onboarding_cron',
      )
    }
  } catch {
    /* Windows / sin permisos */
  }

  if (!cronOk) {
    const hace48h = new Date(Date.now() - 48 * 60 * 60 * 1000)
    const actividadCron = await prisma.systemLog.findFirst({
      where: {
        fecha: { gte: hace48h },
        OR: [
          { origen: { startsWith: 'cron-' } },
          { origen: 'admin-resumen-semanal' },
          { origen: { contains: 'cobranza' } },
        ],
      },
      select: { id: true },
    })
    if (actividadCron) {
      addItem(
        items,
        'onboarding',
        'pass',
        'Actividad de cron detectada en logs (últimas 48 h)',
        'onboarding_cron',
      )
    } else {
      addItem(
        items,
        'onboarding',
        'warn',
        'Cron no detectado — en VPS: sudo bash scripts/vps-install-cron.sh',
        'onboarding_cron',
      )
    }
  }
}

async function validarPlantillasNotificacionGoLive(items: GoLiveItem[]) {
  const requeridas = ['OT_CERRADA', 'PRESUPUESTO_ENVIADO', 'OT_ASIGNADA'] as const
  const faltantes: string[] = []

  for (const codigo of requeridas) {
    const row = await prisma.plantillaNotificacion.findUnique({
      where: { codigo },
      select: { id: true, activo: true },
    })
    if (!row) faltantes.push(codigo)
  }

  if (faltantes.length === 0) {
    addItem(
      items,
      'seed',
      'pass',
      'Plantillas OT_CERRADA, OT_ASIGNADA y PRESUPUESTO_ENVIADO presentes',
    )
  } else {
    addItem(
      items,
      'seed',
      'warn',
      `Plantilla(s) ausente(s): ${faltantes.join(', ')} — ejecutar npm run db:seed en el VPS`,
      'plantillas_notificacion_ausentes',
    )
  }
}

export async function obtenerGoLiveStatus(): Promise<GoLiveStatus> {
  const items: GoLiveItem[] = []
  const fecha = new Date().toISOString()

  const envResult = validarEnvProd(process.env)
  for (const c of envResult.checks) {
    addItem(items, 'entorno', envToNivel(c), c.msg)
  }

  const emisores = await prisma.emisor.findMany({
    where: { activo: true },
    select: {
      id: true,
      razonSocial: true,
      ambiente: true,
      certificadoPath: true,
      clavePrivadaPath: true,
      predeterminado: true,
      puntoVenta: true,
    },
    orderBy: [{ predeterminado: 'desc' }, { razonSocial: 'asc' }],
  })

  if (emisores.length === 0) {
    addItem(
      items,
      'emisores',
      'fail',
      'Sin emisores activos — crear uno en Configuración → Emisores',
      'emisores_vacio',
    )
  } else {
    addItem(items, 'emisores', 'pass', `${emisores.length} emisor(es) activo(s) en BD`)

    for (const e of emisores) {
      const prep = estadoPreparacionAfip(e)
      const pred = e.predeterminado ? ' [predeterminado]' : ''
      const base = `${e.razonSocial}${pred}: ${e.ambiente}, PtoVta ${e.puntoVenta}`

      switch (prep) {
        case 'listo_produccion':
          addItem(items, 'emisores', 'pass', `${base} — certificados OK, listo para facturar`, prep)
          break
        case 'listo_cambiar_a_produccion':
          addItem(
            items,
            'emisores',
            'warn',
            `${base} — certificados cargados; puede cambiar a PRODUCCION cuando AFIP autorice`,
            prep,
          )
          break
        case 'produccion_sin_certificados':
          addItem(
            items,
            'emisores',
            'fail',
            `${base} — PRODUCCION sin certificado/clave; bloquea emisión fiscal`,
            prep,
          )
          break
        case 'homologacion_sin_cert':
          addItem(items, 'emisores', 'warn', `${base} — homologación sin cert (CAE simulado permitido)`, prep)
          break
      }
    }

    const prodSinCert = emisores.filter(
      (e) => e.ambiente === 'PRODUCCION' && !emisorTieneCertificados(e),
    )
    if (prodSinCert.length > 0) {
      addItem(
        items,
        'emisores',
        'fail',
        `Resumen: ${prodSinCert.length} emisor(es) PRODUCCION sin certificados`,
      )
    } else if (emisores.some((e) => e.ambiente === 'PRODUCCION')) {
      addItem(items, 'emisores', 'pass', 'Todos los emisores PRODUCCION tienen certificados')
    }
  }

  const hayEmisorProduccion = emisores.some((e) => e.ambiente === 'PRODUCCION')
  if (hayEmisorProduccion) {
    for (const c of validarAlertasEnvProd(process.env, { hayEmisorProduccion: true })) {
      addItem(items, 'alertas', envToNivel(c), c.msg)
    }

    const recipients = await getAdminNotifyEmails()
    if (recipients.length === 0) {
      addItem(
        items,
        'alertas',
        'fail',
        'Sin destinatarios para alertas AFIP — definir ADMIN_NOTIFY_EMAIL o activar SUPERADMIN/GERENTE',
        'sin_destinatarios_alertas',
      )
    } else if (!adminNotifyEmailDefinido(process.env)) {
      addItem(
        items,
        'alertas',
        'warn',
        `${recipients.length} destinatario(s) vía fallback RBAC (${recipients.slice(0, 2).join(', ')}${recipients.length > 2 ? '…' : ''})`,
      )
    }

    if (!smtpEnvConfigurado(process.env)) {
      const canal = await prisma.canalIntegracion.findUnique({ where: { tipo: 'EMAIL_IMAP' } })
      if (canal?.activo && canal.estado === 'CONECTADO') {
        addItem(items, 'alertas', 'pass', 'Canal EMAIL_IMAP conectado — SMTP disponible para alertas')
      } else {
        addItem(
          items,
          'alertas',
          'fail',
          'Sin SYSTEM_SMTP_* ni EMAIL_IMAP conectado — alertas AFIP no se enviarán por correo',
          'smtp_ausente',
        )
      }
    }
  } else {
    addItem(
      items,
      'alertas',
      'pass',
      'Sin emisor PRODUCCION — alertas AFIP no requeridas aún',
    )
  }

  const workerAfip = detectarWorkerAfipPm2()
  if (!process.env.REDIS_URL?.trim()) {
    addItem(
      items,
      'worker',
      'warn',
      'REDIS_URL ausente — emisión AFIP síncrona (sin cola)',
      'redis_ausente',
    )
  } else if (!workerAfip.detectado) {
    addItem(items, 'worker', 'warn', workerAfip.msg, 'worker_no_pm2')
  } else if (workerAfip.online) {
    addItem(items, 'worker', 'pass', workerAfip.msg)
  } else {
    addItem(items, 'worker', 'fail', workerAfip.msg, 'worker_offline')
  }

  const workerCobranzas = detectarWorkerCobranzasPm2()
  if (process.env.REDIS_URL?.trim()) {
    if (!workerCobranzas.detectado) {
      addItem(
        items,
        'worker_cobranzas',
        'warn',
        `${workerCobranzas.msg} — alternativa: cron POST /api/cron/cobranzas-vencimientos`,
        'worker_cobranzas_no_pm2',
      )
    } else if (workerCobranzas.online) {
      addItem(items, 'worker_cobranzas', 'pass', workerCobranzas.msg)
    } else {
      addItem(items, 'worker_cobranzas', 'warn', workerCobranzas.msg, 'worker_cobranzas_offline')
    }
  }

  await validarCrmGoLive(items, process.env)
  await validarOnboardingGoLive(items)
  await validarPlantillasNotificacionGoLive(items)

  const pass = items.filter((i) => i.nivel === 'pass').length
  const warn = items.filter((i) => i.nivel === 'warn').length
  const fail = items.filter((i) => i.nivel === 'fail').length

  return {
    fecha,
    items,
    resumen: { pass, warn, fail },
    listo: fail === 0,
    workerAfip,
  }
}
