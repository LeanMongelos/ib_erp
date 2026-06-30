/**
 * Kit clínico y plan preventivo al dar de alta un Equipo desde catálogo serializado.
 */
import { addDays, addMonths } from 'date-fns'
import type { Prisma, TipoComponenteEquipo, TipoItemKitEquipo } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { crearConNumeroUnico, siguienteNumeroOT } from '@/lib/sequences'

type Db = Prisma.TransactionClient | typeof prisma

type InventarioConKit = {
  id: string
  nombre: string
  marca: string | null
  requierePreventivo: boolean
  intervaloPreventivoDias: number | null
  kitComoEquipo: Array<{
    nombre: string
    cantidad: number
    obligatorio: boolean
    notas: string | null
    tipoItem: TipoItemKitEquipo
    tipoComponente: TipoComponenteEquipo | null
    mesesVencimiento: number | null
    inventarioHijoId: string | null
    hijo: { sku: string | null } | null
  }>
}

function mapTipoComponente(tipoItem: TipoItemKitEquipo, explicito?: TipoComponenteEquipo | null): TipoComponenteEquipo {
  if (explicito) return explicito
  if (tipoItem === 'BATERIA') return 'BATERIA'
  return 'OTRO'
}

export async function aplicarKitYPreventivoEquipo(opts: {
  db?: Db
  equipoId: string
  clienteId: string
  inventario: InventarioConKit
  referencia: string
  fechaBase?: Date
}): Promise<{ planesCreados: number; otsCreadas: number }> {
  const db = opts.db ?? prisma
  const fechaBase = opts.fechaBase ?? new Date()
  let planesCreados = 0
  let otsCreadas = 0

  for (const k of opts.inventario.kitComoEquipo) {
    if (k.tipoItem === 'BATERIA' || k.tipoItem === 'COMPONENTE') {
      const venceEn = k.mesesVencimiento ? addMonths(fechaBase, k.mesesVencimiento) : null
      await db.equipoComponente.create({
        data: {
          equipoId: opts.equipoId,
          tipo: mapTipoComponente(k.tipoItem, k.tipoComponente),
          descripcion: k.nombre,
          numeroSerie: k.hijo?.sku ?? null,
          instaladoEn: fechaBase,
          venceEn,
          notas: k.notas,
        },
      })
    } else {
      await db.equipoAccesorio.create({
        data: {
          equipoId: opts.equipoId,
          nombre: k.nombre,
          inventarioId: k.inventarioHijoId,
          cantidad: k.cantidad,
          obligatorio: k.obligatorio,
          notas:
            k.notas ??
            (k.tipoItem === 'ACCESORIO_ESPECIFICO' ? 'Accesorio específico del equipo' : 'Accesorio genérico'),
        },
      })
    }
  }

  if (opts.inventario.requierePreventivo) {
    const intervalo = opts.inventario.intervaloPreventivoDias ?? 180
    const proximoPreventivo = addDays(fechaBase, intervalo)

    await db.planMantenimiento.create({
      data: {
        equipoId: opts.equipoId,
        descripcion: `Preventivo — ${opts.inventario.nombre}${opts.inventario.marca ? ` ${opts.inventario.marca}` : ''}`,
        intervaloDias: intervalo,
        proximoServicio: proximoPreventivo,
        estado: 'PROGRAMADO',
        notas: `Generado automáticamente — ${opts.referencia}`,
      },
    })
    planesCreados++

    await crearConNumeroUnico(siguienteNumeroOT, (numero) =>
      db.ordenTrabajo.create({
        data: {
          numero,
          tipo: 'PREVENTIVO',
          descripcion: `Mantenimiento preventivo programado — ${opts.inventario.nombre}`,
          clienteId: opts.clienteId,
          equipoId: opts.equipoId,
          estado: 'ABIERTA',
          prioridad: 'NORMAL',
          slaHoras: 168,
          slaVence: addDays(proximoPreventivo, 7),
          historial: {
            create: {
              estado: 'ABIERTA',
              nota: `OT preventiva generada (${opts.referencia}). Fecha objetivo: ${proximoPreventivo.toISOString().slice(0, 10)}`,
            },
          },
        },
      }),
    )
    otsCreadas++
  }

  return { planesCreados, otsCreadas }
}
