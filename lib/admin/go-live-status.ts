/**
 * Lógica compartida del checklist go-live (script CLI + API admin).
 */

import { execSync } from 'child_process'
import { prisma } from '@/lib/prisma'
import { validarEnvProd, type EnvCheck } from '@/lib/env/validar-prod'
import {
  emisorTieneCertificados,
  estadoPreparacionAfip,
} from '@/lib/afip/validar-emision'

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

export function detectarWorkerAfipPm2(): WorkerAfipStatus {
  try {
    const out = execSync('pm2 jlist', { encoding: 'utf8', timeout: 4000 })
    const list = JSON.parse(out) as Array<{
      name?: string
      pm2_env?: { status?: string }
    }>
    const worker = list.find((p) => p.name === 'worker-afip')
    if (!worker) {
      return { detectado: false, msg: 'worker-afip no registrado en PM2' }
    }
    const estado = worker.pm2_env?.status ?? 'desconocido'
    const online = estado === 'online'
    return {
      detectado: true,
      online,
      estado,
      msg: online ? 'worker-afip online' : `worker-afip ${estado}`,
    }
  } catch {
    return { detectado: false, msg: 'PM2 no disponible en este host' }
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
