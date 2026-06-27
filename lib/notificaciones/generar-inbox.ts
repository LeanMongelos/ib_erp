/**
 * Alertas operativas del ERP para la campana de notificaciones.
 * Se calculan en vivo desde la base de datos (sin datos inventados).
 */
import { addDays, differenceInCalendarDays } from 'date-fns'
import { prisma } from '@/lib/prisma'
import { tienePermiso } from '@/lib/rbac'
import { getAlertasComponentesEquipos } from '@/lib/equipos/historia-clinica'
import { consultarAlertasCompra, UMBRAL_AP_PROXIMO_DIAS, type AlertaCompra } from '@/lib/compras/alertas-compra'
import { consultarAlertasAlquiler } from '@/lib/compras/alquiler-recordatorio'
import { formatFecha, formatMonto } from '@/lib/utils'
import type { AlertaInbox, PrioridadAlerta } from '@/lib/notificaciones/generar-inbox-types'

export type { AlertaInbox, PrioridadAlerta, CategoriaAlerta } from '@/lib/notificaciones/generar-inbox-types'

export interface GenerarInboxOptions {
  usuarioId?: string
  permisos?: string[]
}

type ReglasMap = Record<string, { activo: boolean; diasAnticipacion: number | null }>

function puedeVerModulo(permisos: string[] | undefined, clave: string): boolean {
  if (!permisos) return true
  return tienePermiso(permisos, clave)
}

function hrefAlertaCompra(a: AlertaCompra): string {
  if (a.tipo === 'CHEQUE_PROXIMO_DEBITO') return '/compras?tab=pagos'
  if (a.tipo === 'AP_VENCIDA' || a.tipo === 'AP_PROXIMO') return '/compras?tab=cuenta'
  if (a.facturaCompraId) return `/compras?tab=facturas&fc=${a.facturaCompraId}`
  if (a.ordenCompraId) return `/compras?tab=oc&oc=${a.ordenCompraId}`
  return '/compras'
}

function prioridadAlertaCompra(a: AlertaCompra): PrioridadAlerta {
  if (a.tipo === 'AP_VENCIDA' || a.tipo === 'CHEQUE_PROXIMO_DEBITO') {
    return a.diasTranscurridos > 0 || a.diasAlerta <= 1 ? 'urgente' : 'importante'
  }
  if (a.tipo === 'AP_PROXIMO') return a.diasAlerta <= 3 ? 'importante' : 'info'
  return a.diasAlerta >= 7 ? 'urgente' : a.diasAlerta >= 5 ? 'importante' : 'info'
}

function categoriaAlertaCompra(a: AlertaCompra): 'compras' | 'tesoreria' {
  return a.tipo === 'CHEQUE_PROXIMO_DEBITO' ? 'tesoreria' : 'compras'
}

function tituloAlertaCompra(a: AlertaCompra): string {
  switch (a.tipo) {
    case 'FC_PENDIENTE_RECEPCION':
      return `FC pendiente — OC ${a.numero}`
    case 'FC_PENDIENTE_REGISTRO':
      return `FC en borrador — ${a.numero}`
    case 'CHEQUE_PROXIMO_DEBITO':
      return a.diasTranscurridos > 0 ? `Cheque a debitar — ${a.numero}` : `Cheque próximo débito — ${a.numero}`
    case 'AP_VENCIDA':
      return `AP vencida — ${a.numero}`
    case 'AP_PROXIMO':
      return `AP vence pronto — ${a.numero}`
    default:
      return a.numero
  }
}

function eventoReglaAlertaCompra(a: AlertaCompra): string {
  switch (a.tipo) {
    case 'FC_PENDIENTE_RECEPCION':
    case 'FC_PENDIENTE_REGISTRO':
      return 'compras.fc_pendiente'
    case 'CHEQUE_PROXIMO_DEBITO':
      return 'compras.cheque_debito'
    case 'AP_VENCIDA':
      return 'compras.ap_vencida'
    case 'AP_PROXIMO':
      return 'compras.ap_proximo'
    default:
      return 'compras.fc_pendiente'
  }
}

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

export async function generarAlertasInbox(opts?: GenerarInboxOptions): Promise<AlertaInbox[]> {
  const ahora = new Date()
  const reglas = await cargarReglas()
  const alertas: AlertaInbox[] = []
  const permisos = opts?.permisos

  const verCompras = puedeVerModulo(permisos, 'compras.read')
  const verTesoreria = puedeVerModulo(permisos, 'tesoreria.read')

  if (verCompras || verTesoreria) {
    const comprasAlertas = await consultarAlertasCompra(opts?.usuarioId)
    for (const a of comprasAlertas) {
      const cat = categoriaAlertaCompra(a)
      if (cat === 'compras' && !verCompras) continue
      if (cat === 'tesoreria' && !verTesoreria && !verCompras) continue
      const evento = eventoReglaAlertaCompra(a)
      if (!reglaActiva(reglas, evento)) continue
      if (a.tipo === 'AP_PROXIMO') {
        const dias = diasAnticipacion(reglas, evento, UMBRAL_AP_PROXIMO_DIAS)
        const diff = differenceInCalendarDays(new Date(a.fechaReferencia), ahora)
        if (diff > dias) continue
      }
      alertas.push({
        clave: `compras:${a.alertKey}`,
        categoria: cat,
        prioridad: prioridadAlertaCompra(a),
        titulo: tituloAlertaCompra(a),
        mensaje: a.mensaje,
        href: hrefAlertaCompra(a),
        fecha: a.fechaReferencia,
      })
    }

    if (reglaActiva(reglas, 'compras.alquiler_recordatorio')) {
      const alquilerAlertas = await consultarAlertasAlquiler(ahora)
      for (const a of alquilerAlertas) {
        alertas.push({
          clave: `compras:alquiler:${a.plantillaId}`,
          categoria: 'compras',
          prioridad: 'importante',
          titulo: `Generar OC alquiler — ${a.nombre}`,
          mensaje: `Recordatorio mensual (día ${a.recordatorioDiaMes}): crear orden de compra desde la plantilla.`,
          href: `/compras?tab=oc&plantilla=${a.plantillaId}`,
          fecha: ahora.toISOString(),
        })
      }
    }
  }

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

  if (reglaActiva(reglas, 'cheque.deposito')) {
    const finHoy = new Date()
    finHoy.setHours(23, 59, 59, 999)
    const chequesDepositar = await prisma.chequeCobranza.findMany({
      where: {
        estado: 'EN_CARTERA',
        fechaVencimiento: { lte: finHoy },
      },
      include: { cliente: { select: { nombre: true } } },
      take: 15,
      orderBy: { fechaVencimiento: 'asc' },
    })
    for (const c of chequesDepositar) {
      const inicioHoy = new Date()
      inicioHoy.setHours(0, 0, 0, 0)
      const vencido = c.fechaVencimiento < inicioHoy
      alertas.push({
        clave: `cheque-deposito:${c.id}`,
        categoria: 'cobranza',
        prioridad: vencido ? 'urgente' : 'importante',
        titulo: vencido ? `Depositar cheque vencido — N° ${c.numero}` : `Depositar cheque — N° ${c.numero}`,
        mensaje: `${c.cliente.nombre} · ${formatMonto(c.monto)} · vence ${formatFecha(c.fechaVencimiento)}`,
        href: '/cobranzas',
        fecha: c.fechaVencimiento.toISOString(),
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
