/**
 * Alertas operativas del ERP para la campana de notificaciones.
 * Se calculan en vivo desde la base de datos (sin datos inventados).
 */
import { addDays, differenceInCalendarDays } from 'date-fns'
import { prisma } from '@/lib/prisma'
import { getAlertasComponentesEquipos } from '@/lib/equipos/historia-clinica'
import { formatMonto } from '@/lib/utils'
import type { AlertaInbox, PrioridadAlerta } from '@/lib/notificaciones/generar-inbox-types'

export type { AlertaInbox, PrioridadAlerta, CategoriaAlerta } from '@/lib/notificaciones/generar-inbox-types'

type ReglasMap = Record<string, { activo: boolean; diasAnticipacion: number | null }>

async function cargarReglas(): Promise<ReglasMap> {
  const reglas = await prisma.reglaNotificacion.findMany({ where: { activo: true } })
  const map: ReglasMap = {}
  for (const r of reglas) {
    map[r.evento] = { activo: true, diasAnticipacion: r.diasAnticipacion }
  }
  return map
}

function reglaActiva(reglas: ReglasMap, evento: string, defaultDias?: number): boolean {
  const r = reglas[evento]
  if (!r) return true
  return r.activo
}

function diasAnticipacion(reglas: ReglasMap, evento: string, fallback: number): number {
  return reglas[evento]?.diasAnticipacion ?? fallback
}

export async function generarAlertasInbox(): Promise<AlertaInbox[]> {
  const ahora = new Date()
  const reglas = await cargarReglas()
  const alertas: AlertaInbox[] = []

  if (reglaActiva(reglas, 'ot.vencida')) {
    const otsVencidas = await prisma.ordenTrabajo.findMany({
      where: {
        estado: { in: ['VENCIDA', 'ABIERTA', 'EN_PROCESO'] },
        OR: [{ estado: 'VENCIDA' }, { slaVence: { lt: ahora } }],
      },
      include: { cliente: { select: { nombre: true } } },
      take: 15,
      orderBy: { slaVence: 'asc' },
    })
    for (const ot of otsVencidas) {
      const vencida = ot.estado === 'VENCIDA' || ot.slaVence < ahora
      if (!vencida) continue
      alertas.push({
        clave: `ot-vencida:${ot.id}`,
        categoria: 'ot',
        prioridad: ot.prioridad === 'URGENTE' || ot.prioridad === 'ALTA' ? 'urgente' : 'importante',
        titulo: `OT ${ot.numero} vencida`,
        mensaje: `${ot.cliente.nombre} — ${ot.descripcion.slice(0, 80)}`,
        href: `/servicio-tecnico/${ot.id}`,
        fecha: ot.slaVence.toISOString(),
      })
    }
  }

  if (reglaActiva(reglas, 'ot.sla_proximo')) {
    const horasLimite = addDays(ahora, 1)
    const otsProximas = await prisma.ordenTrabajo.findMany({
      where: {
        estado: { in: ['ABIERTA', 'EN_PROCESO'] },
        slaVence: { gte: ahora, lte: horasLimite },
      },
      include: { cliente: { select: { nombre: true } } },
      take: 10,
      orderBy: { slaVence: 'asc' },
    })
    for (const ot of otsProximas) {
      alertas.push({
        clave: `ot-sla:${ot.id}`,
        categoria: 'ot',
        prioridad: 'importante',
        titulo: `SLA por vencer — OT ${ot.numero}`,
        mensaje: `${ot.cliente.nombre} · vence ${ot.slaVence.toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}`,
        href: `/servicio-tecnico/${ot.id}`,
        fecha: ot.slaVence.toISOString(),
      })
    }
  }

  if (reglaActiva(reglas, 'cobranza.vencida')) {
    const vencidas = await prisma.vencimientoCobranza.findMany({
      where: {
        estado: { in: ['PENDIENTE', 'AVISO_ENVIADO'] },
        fechaVencimiento: { lt: ahora },
      },
      include: {
        factura: { select: { id: true, numero: true, cliente: { select: { nombre: true } } } },
      },
      take: 15,
      orderBy: { fechaVencimiento: 'asc' },
    })
    for (const v of vencidas) {
      alertas.push({
        clave: `cobranza-vencida:${v.id}`,
        categoria: 'cobranza',
        prioridad: 'urgente',
        titulo: `Cobranza vencida — ${v.factura.numero}`,
        mensaje: `${v.factura.cliente.nombre} · cuota ${v.numeroCuota} · ${formatMonto(v.monto)}`,
        href: `/facturacion?highlight=${v.factura.id}`,
        fecha: v.fechaVencimiento.toISOString(),
      })
    }
  }

  if (reglaActiva(reglas, 'cobranza.proximo')) {
    const dias = diasAnticipacion(reglas, 'cobranza.proximo', 3)
    const limite = addDays(ahora, dias)
    const proximas = await prisma.vencimientoCobranza.findMany({
      where: {
        estado: { in: ['PENDIENTE', 'AVISO_ENVIADO'] },
        fechaVencimiento: { gte: ahora, lte: limite },
      },
      include: {
        factura: { select: { id: true, numero: true, cliente: { select: { nombre: true } } } },
      },
      take: 10,
      orderBy: { fechaVencimiento: 'asc' },
    })
    for (const v of proximas) {
      alertas.push({
        clave: `cobranza-proxima:${v.id}`,
        categoria: 'cobranza',
        prioridad: 'importante',
        titulo: `Vence pronto — ${v.factura.numero}`,
        mensaje: `${v.factura.cliente.nombre} · ${formatMonto(v.monto)} · ${differenceInCalendarDays(v.fechaVencimiento, ahora)}d`,
        href: `/cobranzas`,
        fecha: v.fechaVencimiento.toISOString(),
      })
    }
  }

  if (reglaActiva(reglas, 'preventivo.vencido') || reglaActiva(reglas, 'preventivo.proximo')) {
    const diasPrev = diasAnticipacion(reglas, 'preventivo.proximo', 7)
    const planes = await prisma.planMantenimiento.findMany({
      where: {
        estado: { in: ['PENDIENTE', 'PROGRAMADO', 'VENCIDO'] },
        proximoServicio: { not: null },
      },
      include: {
        equipo: { include: { cliente: { select: { nombre: true } } } },
      },
      take: 20,
      orderBy: { proximoServicio: 'asc' },
    })
    for (const p of planes) {
      if (!p.proximoServicio) continue
      const diff = differenceInCalendarDays(p.proximoServicio, ahora)
      if (diff < 0 && reglaActiva(reglas, 'preventivo.vencido')) {
        alertas.push({
          clave: `preventivo-vencido:${p.id}`,
          categoria: 'preventivo',
          prioridad: 'urgente',
          titulo: `Preventivo vencido — ${p.equipo.nombre}`,
          mensaje: `${p.equipo.cliente?.nombre ?? '—'} · ${Math.abs(diff)}d de atraso`,
          href: `/servicio-tecnico/preventivo`,
          fecha: p.proximoServicio.toISOString(),
        })
      } else if (diff >= 0 && diff <= diasPrev && reglaActiva(reglas, 'preventivo.proximo')) {
        alertas.push({
          clave: `preventivo-proximo:${p.id}`,
          categoria: 'preventivo',
          prioridad: diff <= 2 ? 'importante' : 'info',
          titulo: `Preventivo en ${diff}d — ${p.equipo.nombre}`,
          mensaje: `${p.equipo.cliente?.nombre ?? '—'} · ${p.descripcion}`,
          href: `/servicio-tecnico/preventivo`,
          fecha: p.proximoServicio.toISOString(),
        })
      }
    }
  }

  if (reglaActiva(reglas, 'equipo.componente_vence')) {
    const diasComp = diasAnticipacion(reglas, 'equipo.componente_vence', 30)
    const componentes = await getAlertasComponentesEquipos(diasComp)
    for (const c of componentes.slice(0, 12)) {
      alertas.push({
        clave: `componente:${c.id}`,
        categoria: 'componente',
        prioridad: c.vencido ? 'urgente' : c.urgente ? 'importante' : 'info',
        titulo: c.vencido ? `Componente vencido — ${c.equipo.nombre}` : `Componente por vencer`,
        mensaje: `${c.descripcion} · ${c.equipo.cliente?.nombre ?? '—'}`,
        href: `/servicio-tecnico/equipos/${c.equipoId}`,
        fecha: (c.venceEn ?? ahora).toISOString(),
      })
    }
  }

  if (reglaActiva(reglas, 'stock.bajo_minimo')) {
    const items = await prisma.inventario.findMany({
      where: { activo: true, stockMinimo: { gt: 0 } },
      select: { id: true, nombre: true, sku: true, stock: true, stockMinimo: true },
      take: 200,
    })
    for (const i of items.filter((x) => x.stock <= x.stockMinimo).slice(0, 10)) {
      alertas.push({
        clave: `stock:${i.id}`,
        categoria: 'inventario',
        prioridad: i.stock === 0 ? 'urgente' : 'importante',
        titulo: i.stock === 0 ? `Sin stock — ${i.nombre}` : `Stock bajo — ${i.nombre}`,
        mensaje: `${i.stock} u. (mín. ${i.stockMinimo})${i.sku ? ` · ${i.sku}` : ''}`,
        href: `/inventario?q=${encodeURIComponent(i.sku ?? i.nombre)}`,
        fecha: ahora.toISOString(),
      })
    }
  }

  if (reglaActiva(reglas, 'presupuesto.por_vencer')) {
    const presupuestos = await prisma.presupuesto.findMany({
      where: { estado: { in: ['ENVIADO', 'BORRADOR'] } },
      include: { cliente: { select: { nombre: true } } },
      take: 30,
      orderBy: { creadoEn: 'desc' },
    })
    for (const p of presupuestos) {
      const vence = addDays(p.creadoEn, p.vigenciaDias)
      const diff = differenceInCalendarDays(vence, ahora)
      if (diff < 0 || diff > 5) continue
      alertas.push({
        clave: `presupuesto:${p.id}`,
        categoria: 'presupuesto',
        prioridad: diff <= 1 ? 'importante' : 'info',
        titulo: diff < 0 ? `Presupuesto vencido — ${p.numero}` : `Presupuesto vence en ${diff}d`,
        mensaje: `${p.cliente.nombre} · ${formatMonto(p.total)}`,
        href: `/presupuestos/${p.id}`,
        fecha: vence.toISOString(),
      })
    }
  }

  const facturasPendientesCae = await prisma.factura.count({
    where: { estado: 'PENDIENTE_CAE' },
  })
  if (facturasPendientesCae > 0) {
    alertas.push({
      clave: 'factura-pendiente-cae',
      categoria: 'factura',
      prioridad: 'importante',
      titulo: `${facturasPendientesCae} factura(s) pendientes de CAE`,
      mensaje: 'Comprobantes confirmados sin emitir en AFIP',
      href: '/facturacion',
      fecha: ahora.toISOString(),
    })
  }

  if (reglaActiva(reglas, 'crm.conversacion_sin_leer')) {
    const convSinLeer = await prisma.conversacionCRM.findMany({
      where: { sinLeer: { gt: 0 }, estado: { not: 'CERRADA' } },
      include: { cliente: { select: { nombre: true } } },
      take: 8,
      orderBy: { ultimoMensajeEn: 'desc' },
    })
    for (const c of convSinLeer) {
      alertas.push({
        clave: `crm:${c.id}`,
        categoria: 'crm',
        prioridad: c.sinLeer >= 3 ? 'importante' : 'info',
        titulo: `${c.sinLeer} mensaje(s) sin leer`,
        mensaje: c.cliente?.nombre ?? c.contactoNombre ?? c.preview ?? 'Conversación CRM',
        href: `/crm/${c.id}`,
        fecha: c.ultimoMensajeEn.toISOString(),
      })
    }
  }

  const orden: Record<PrioridadAlerta, number> = { urgente: 0, importante: 1, info: 2 }
  alertas.sort((a, b) => {
    const po = orden[a.prioridad] - orden[b.prioridad]
    if (po !== 0) return po
    return new Date(b.fecha).getTime() - new Date(a.fecha).getTime()
  })

  return alertas.slice(0, 40)
}

export async function marcarAlertasLeidas(usuarioId: string, claves: string[]) {
  if (!claves.length) return
  await prisma.$transaction(
    claves.map((clave) =>
      prisma.notificacionLeida.upsert({
        where: { usuarioId_clave: { usuarioId, clave } },
        update: { leidaEn: new Date() },
        create: { usuarioId, clave },
      }),
    ),
  )
}

export async function marcarTodasLeidas(usuarioId: string, claves: string[]) {
  await marcarAlertasLeidas(usuarioId, claves)
}
