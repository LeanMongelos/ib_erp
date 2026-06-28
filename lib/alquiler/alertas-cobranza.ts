import { addDays } from 'date-fns'
import { prisma } from '@/lib/prisma'

export type SituacionAlquilerCobranza = 'SIN_FACTURAR' | 'PENDIENTE_AFIP' | 'POR_COBRAR'

export type GrupoCuotaAlquilerCobranza = {
  contratoId: string
  numeroContrato: string
  clienteId: string
  clienteNombre: string
  periodo: string
  vencimiento: Date
  montoTotal: number
  cantidadLineas: number
  situacion: SituacionAlquilerCobranza
  facturaId?: string
  facturaNumero?: string
}

const whereBaseCuotaImpaga = {
  estado: { in: ['PENDIENTE', 'VENCIDA', 'FACTURADA'] as ('PENDIENTE' | 'VENCIDA' | 'FACTURADA')[] },
  contrato: { estado: { in: ['ACTIVO', 'SUSPENDIDO'] as ('ACTIVO' | 'SUSPENDIDO')[] } },
}

type CuotaRow = {
  contratoId: string
  periodo: string
  monto: number
  vencimiento: Date
  facturaId: string | null
  contrato: { id: string; numero: string; clienteId: string; cliente: { nombre: string } }
  factura: {
    id: string
    numero: string
    estado: string
    vencimientos: Array<{ fechaVencimiento: Date; estado: string }>
  } | null
}

function resolverSituacion(c: CuotaRow): { situacion: SituacionAlquilerCobranza; vencimiento: Date } | null {
  if (!c.facturaId || !c.factura) {
    return { situacion: 'SIN_FACTURAR', vencimiento: c.vencimiento }
  }

  if (['BORRADOR', 'PENDIENTE_CAE'].includes(c.factura.estado)) {
    return { situacion: 'PENDIENTE_AFIP', vencimiento: c.vencimiento }
  }

  if (['EMITIDA', 'VENCIDA', 'PENDIENTE'].includes(c.factura.estado)) {
    const vencPendiente = c.factura.vencimientos
      .filter((v) => ['PENDIENTE', 'AVISO_ENVIADO'].includes(v.estado))
      .sort((a, b) => a.fechaVencimiento.getTime() - b.fechaVencimiento.getTime())[0]
    return {
      situacion: 'POR_COBRAR',
      vencimiento: vencPendiente?.fechaVencimiento ?? c.vencimiento,
    }
  }

  return null
}

function agruparCuotasAlquiler(
  cuotas: CuotaRow[],
): GrupoCuotaAlquilerCobranza[] {
  const grupos = new Map<string, Array<CuotaRow & { situacion: SituacionAlquilerCobranza; vencimientoRef: Date }>>()

  for (const c of cuotas) {
    const resolved = resolverSituacion(c)
    if (!resolved) continue
    const key = `${c.contratoId}:${c.periodo}:${resolved.situacion}`
    const arr = grupos.get(key) ?? []
    arr.push({ ...c, situacion: resolved.situacion, vencimientoRef: resolved.vencimiento })
    grupos.set(key, arr)
  }

  const result: GrupoCuotaAlquilerCobranza[] = []
  for (const [, grupo] of grupos) {
    const first = grupo[0]!
    const vencimiento = grupo.reduce(
      (max, c) => (c.vencimientoRef > max ? c.vencimientoRef : max),
      first.vencimientoRef,
    )
    result.push({
      contratoId: first.contratoId,
      numeroContrato: first.contrato.numero,
      clienteId: first.contrato.clienteId,
      clienteNombre: first.contrato.cliente.nombre,
      periodo: first.periodo,
      vencimiento,
      montoTotal: grupo.reduce((s, c) => s + c.monto, 0),
      cantidadLineas: grupo.length,
      situacion: first.situacion,
      facturaId: first.factura?.id,
      facturaNumero: first.factura?.numero,
    })
  }

  result.sort((a, b) => a.vencimiento.getTime() - b.vencimiento.getTime())
  return result
}

async function cargarCuotasAlquilerImpagas(): Promise<CuotaRow[]> {
  return prisma.cuotaAlquiler.findMany({
    where: whereBaseCuotaImpaga,
    include: {
      contrato: {
        select: {
          id: true,
          numero: true,
          clienteId: true,
          cliente: { select: { nombre: true } },
        },
      },
      factura: {
        select: {
          id: true,
          numero: true,
          estado: true,
          vencimientos: {
            where: { estado: { in: ['PENDIENTE', 'AVISO_ENVIADO'] } },
            select: { fechaVencimiento: true, estado: true },
            orderBy: { fechaVencimiento: 'asc' },
          },
        },
      },
    },
    orderBy: [{ vencimiento: 'asc' }, { periodo: 'asc' }],
  })
}

export async function contarCuotasAlquilerCobranzaVencidas(ahora = new Date()): Promise<number> {
  const [sinFacturar, pendienteAfip] = await Promise.all([
    prisma.cuotaAlquiler.count({
      where: {
        facturaId: null,
        estado: { in: ['PENDIENTE', 'VENCIDA'] },
        vencimiento: { lt: ahora },
        contrato: { estado: { in: ['ACTIVO', 'SUSPENDIDO'] } },
      },
    }),
    prisma.cuotaAlquiler.count({
      where: {
        facturaId: { not: null },
        estado: { in: ['PENDIENTE', 'VENCIDA', 'FACTURADA'] },
        vencimiento: { lt: ahora },
        contrato: { estado: { in: ['ACTIVO', 'SUSPENDIDO'] } },
        factura: { estado: { in: ['BORRADOR', 'PENDIENTE_CAE'] } },
      },
    }),
  ])
  return sinFacturar + pendienteAfip
}

/** Cuotas alquiler impagas agrupadas por contrato + período + situación de cobro. */
export async function listarGruposCuotasAlquilerCobranza(opts?: {
  vencidas?: boolean
  diasProximo?: number
  take?: number
  ahora?: Date
}): Promise<GrupoCuotaAlquilerCobranza[]> {
  const ahora = opts?.ahora ?? new Date()
  const take = opts?.take ?? 15

  const cuotas = await cargarCuotasAlquilerImpagas()
  let grupos = agruparCuotasAlquiler(cuotas)

  if (opts?.vencidas) {
    grupos = grupos.filter((g) => g.vencimiento < ahora)
  } else if (opts?.diasProximo != null) {
    const limite = addDays(ahora, opts.diasProximo)
    grupos = grupos.filter((g) => g.vencimiento >= ahora && g.vencimiento <= limite)
  }

  return grupos.slice(0, take)
}

export function hrefAlertaAlquilerCobranza(g: GrupoCuotaAlquilerCobranza): string {
  if (g.situacion === 'PENDIENTE_AFIP' && g.facturaId) {
    return `/facturacion?highlight=${g.facturaId}`
  }
  if (g.situacion === 'POR_COBRAR') {
    return `/cobranzas?cliente=${g.clienteId}#registrar-cobranza`
  }
  return '/cobranzas?origen=ALQUILER'
}

export function tituloAlertaAlquilerCobranza(g: GrupoCuotaAlquilerCobranza, vencida: boolean): string {
  const base = `${g.clienteNombre} — ${g.periodo}`
  if (g.situacion === 'SIN_FACTURAR') {
    return vencida
      ? `Alquiler — cuota vencida sin facturar — ${base}`
      : `Alquiler — cuota próxima sin facturar — ${base}`
  }
  if (g.situacion === 'PENDIENTE_AFIP') {
    return vencida
      ? `Alquiler — emitir AFIP (vencida) — ${base}`
      : `Alquiler — emitir AFIP pronto — ${base}`
  }
  return vencida
    ? `Alquiler — cobranza vencida — ${base}`
    : `Alquiler — cobro próximo — ${base}`
}

export function mensajeAlertaAlquilerCobranza(
  g: GrupoCuotaAlquilerCobranza,
  diasRelativos: number,
  vencida: boolean,
): string {
  const monto = g.montoTotal.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })
  const plazo = vencida ? `${Math.abs(diasRelativos)}d de atraso` : `vence en ${diasRelativos}d`
  const extra =
    g.situacion === 'PENDIENTE_AFIP' && g.facturaNumero
      ? ` · Factura ${g.facturaNumero} borrador`
      : g.situacion === 'POR_COBRAR' && g.facturaNumero
        ? ` · Factura ${g.facturaNumero}`
        : ''
  return `${g.numeroContrato} · ${monto} · ${plazo} · ${g.cantidadLineas} línea(s)${extra}`
}

export function claveAlertaAlquilerCobranza(
  g: GrupoCuotaAlquilerCobranza,
  tipo: 'vencida' | 'proximo',
): string {
  return `alquiler-cuota-${tipo}:${g.contratoId}:${g.periodo}:${g.situacion}`
}
