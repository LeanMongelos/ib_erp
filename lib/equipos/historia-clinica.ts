/**
 * Historia clínica del equipo — bitácora, componentes y ficha completa.
 */

import { prisma } from '@/lib/prisma'
import type { TipoEntradaHistoriaClinica, Prisma } from '@prisma/client'

export type BitacoraItem = {
  id: string
  tipo: string
  titulo: string
  contenido: string | null
  fecha: Date
  referenciaId: string | null
  usuarioNombre: string | null
  origen: 'historia' | 'ot' | 'tracking' | 'preventivo'
}

const ESTADO_OT_LABEL: Record<string, string> = {
  ABIERTA: 'Abierta',
  EN_PROCESO: 'En proceso',
  CERRADA: 'Cerrada',
  VENCIDA: 'Vencida',
  CANCELADA: 'Cancelada',
}

const TIPO_TRACKING_LABEL: Record<string, string> = {
  RECEPCION: 'Recepción en local',
  DEPOSITO: 'En depósito',
  EN_TRANSITO: 'En tránsito',
  INSTALADO: 'Instalado en cliente',
  EN_SERVICIO: 'En servicio técnico',
  RETIRO: 'Retiro del cliente',
  BAJA: 'Baja del parque',
}

export async function registrarEntradaHistoria(
  equipoId: string,
  data: {
    tipo: TipoEntradaHistoriaClinica
    titulo: string
    contenido?: string | null
    referenciaId?: string | null
    usuarioId?: string | null
    fecha?: Date
  },
) {
  return prisma.historiaClinicaEntrada.create({
    data: {
      equipoId,
      tipo: data.tipo,
      titulo: data.titulo,
      contenido: data.contenido ?? null,
      referenciaId: data.referenciaId ?? null,
      usuarioId: data.usuarioId ?? null,
      fecha: data.fecha ?? new Date(),
    },
  })
}

export async function construirBitacora(equipoId: string): Promise<BitacoraItem[]> {
  const [entradas, ots, eventos, planes] = await Promise.all([
    prisma.historiaClinicaEntrada.findMany({
      where: { equipoId },
      include: { usuario: { select: { nombre: true } } },
      orderBy: { fecha: 'desc' },
      take: 100,
    }),
    prisma.ordenTrabajo.findMany({
      where: { equipoId },
      include: {
        tecnico: { select: { nombre: true } },
        historial: { orderBy: { creadoEn: 'asc' } },
      },
      orderBy: { creadoEn: 'desc' },
      take: 30,
    }),
    prisma.eventoTracking.findMany({
      where: { equipoId },
      include: { usuario: { select: { nombre: true } } },
      orderBy: { fecha: 'desc' },
      take: 30,
    }),
    prisma.planMantenimiento.findMany({
      where: { equipoId },
      orderBy: { creadoEn: 'desc' },
      take: 20,
    }),
  ])

  const items: BitacoraItem[] = []

  for (const e of entradas) {
    items.push({
      id: e.id,
      tipo: e.tipo,
      titulo: e.titulo,
      contenido: e.contenido,
      fecha: e.fecha,
      referenciaId: e.referenciaId,
      usuarioNombre: e.usuario?.nombre ?? null,
      origen: 'historia',
    })
  }

  for (const ot of ots) {
    items.push({
      id: `ot-${ot.id}`,
      tipo: 'OT',
      titulo: `OT ${ot.numero} — ${ot.descripcion.slice(0, 80)}`,
      contenido: ot.diagnostico ?? ot.estado,
      fecha: ot.fechaApertura,
      referenciaId: ot.id,
      usuarioNombre: ot.tecnico?.nombre ?? null,
      origen: 'ot',
    })
    for (const h of ot.historial) {
      items.push({
        id: `oth-${h.id}`,
        tipo: 'OT',
        titulo: `OT ${ot.numero}: ${ESTADO_OT_LABEL[h.estado] ?? h.estado}`,
        contenido: h.nota,
        fecha: h.creadoEn,
        referenciaId: ot.id,
        usuarioNombre: ot.tecnico?.nombre ?? null,
        origen: 'ot',
      })
    }
  }

  for (const ev of eventos) {
    items.push({
      id: `trk-${ev.id}`,
      tipo: 'TRACKING',
      titulo: TIPO_TRACKING_LABEL[ev.tipo] ?? ev.tipo,
      contenido: ev.nota ?? ev.direccion,
      fecha: ev.fecha,
      referenciaId: ev.id,
      usuarioNombre: ev.usuario?.nombre ?? null,
      origen: 'tracking',
    })
  }

  for (const p of planes) {
    if (p.ultimoServicio) {
      items.push({
        id: `prev-${p.id}-ultimo`,
        tipo: 'PREVENTIVO',
        titulo: `Preventivo completado: ${p.descripcion}`,
        contenido: p.notas,
        fecha: p.ultimoServicio,
        referenciaId: p.id,
        usuarioNombre: null,
        origen: 'preventivo',
      })
    }
  }

  items.sort((a, b) => b.fecha.getTime() - a.fecha.getTime())

  const seen = new Set<string>()
  return items.filter((i) => {
    if (seen.has(i.id)) return false
    seen.add(i.id)
    return true
  }).slice(0, 80)
}

export async function getEquipoHistoriaCompleta(equipoId: string) {
  const equipo = await prisma.equipo.findUnique({
    where: { id: equipoId },
    include: {
      cliente: {
        select: {
          id: true,
          nombre: true,
          tipo: true,
          cuit: true,
          ciudad: true,
          direccion: true,
          telefono: true,
          email: true,
          contacto: true,
          condicionPago: true,
        },
      },
      proveedorOrigen: { select: { id: true, razonSocial: true, ciudad: true } },
      instaladoPor: { select: { id: true, nombre: true } },
      itemFacturaOrigen: {
        select: {
          id: true,
          descripcion: true,
          numeroSerie: true,
          proximoPreventivo: true,
          inventario: { select: { id: true, nombre: true, sku: true } },
          factura: {
            select: {
              id: true,
              numero: true,
              fechaEmision: true,
              condicionPago: true,
              total: true,
              cliente: {
                select: { id: true, nombre: true, cuit: true, ciudad: true, telefono: true },
              },
              emisor: { select: { razonSocial: true, cuit: true } },
            },
          },
        },
      },
      unidadInventario: {
        select: {
          id: true,
          numeroSerie: true,
          lote: true,
          estado: true,
          ubicacionDetalle: true,
          deposito: { select: { id: true, nombre: true, tipo: true } },
        },
      },
      inventario: { select: { id: true, nombre: true, sku: true, modoTrazabilidad: true } },
      accesorios: { include: { inventario: { select: { id: true, nombre: true, sku: true } } }, orderBy: { nombre: 'asc' } },
      componentes: { where: { activo: true }, orderBy: [{ venceEn: 'asc' }, { descripcion: 'asc' }] },
      planes: {
        include: { tecnico: { select: { nombre: true } } },
        orderBy: { proximoServicio: 'asc' },
      },
      ots: {
        orderBy: { creadoEn: 'desc' },
        take: 15,
        select: { id: true, numero: true, estado: true, descripcion: true, fechaApertura: true },
      },
    },
  })

  if (!equipo) return null

  const bitacora = await construirBitacora(equipoId)
  return { equipo, bitacora }
}

export async function getAlertasComponentesEquipos(diasHorizonte = 90) {
  const limite = new Date()
  limite.setDate(limite.getDate() + diasHorizonte)

  const componentes = await prisma.equipoComponente.findMany({
    where: {
      activo: true,
      venceEn: { not: null, lte: limite },
    },
    include: {
      equipo: {
        include: { cliente: { select: { nombre: true } } },
      },
    },
    orderBy: { venceEn: 'asc' },
  })

  const ahora = new Date()
  return componentes.map((c) => {
    const vence = c.venceEn!
    const diffDias = Math.ceil((vence.getTime() - ahora.getTime()) / (24 * 3600 * 1000))
    return {
      ...c,
      diffDias,
      urgente: diffDias <= (c.alertaDiasAntes ?? 30),
      vencido: diffDias < 0,
    }
  })
}

export type EquipoUpdateInput = Prisma.EquipoUpdateInput
