/**
 * lib/numeracion.ts
 * Secuencias correlativas configurables para presupuestos, facturas y remitos.
 * Permite fijar el próximo número al migrar desde otra plataforma.
 */

import { prisma, invalidatePrismaCache } from '@/lib/prisma'

export type TipoSecuencia = 'PRESUPUESTO' | 'FACTURA' | 'REMITO' | 'ORDEN_VENTA'

export interface DefSecuencia {
  clave: string
  etiqueta: string
  tipo: TipoSecuencia
  subtipo?: string
  anio?: number
  prefijo: string
  padding: number
  proximoNumero: number
}

function anioActual() {
  return new Date().getFullYear()
}

/** Extrae la parte numérica final de un número con formato "PREFIJO-0001". */
export function parseCorrelativo(numero: string): number {
  const match = numero.match(/(\d+)\s*$/)
  return match ? parseInt(match[1], 10) : 0
}

export function formatearNumero(prefijo: string, correlativo: number, padding: number): string {
  return `${prefijo}${String(correlativo).padStart(padding, '0')}`
}

function defsAnuales(tipo: 'PRESUPUESTO' | 'REMITO' | 'ORDEN_VENTA', prefijoLetra: string, anio: number): DefSecuencia[] {
  const prefijo = `${prefijoLetra}-${anio}-`
  const claveBase = tipo === 'PRESUPUESTO' ? 'PRESUPUESTO' : tipo === 'REMITO' ? 'REMITO' : 'ORDEN_VENTA'
  const etiqueta = tipo === 'PRESUPUESTO' ? 'Presupuesto' : tipo === 'REMITO' ? 'Remito' : 'Orden de venta'
  return [{
    clave: `${claveBase}_${anio}`,
    etiqueta: `${etiqueta} ${anio}`,
    tipo,
    anio,
    prefijo,
    padding: 4,
    proximoNumero: 1,
  }]
}

export function defsSecuenciasPorDefecto(anio = anioActual()): DefSecuencia[] {
  return [
    ...defsAnuales('PRESUPUESTO', 'P', anio),
    ...defsAnuales('REMITO', 'R', anio),
    ...defsAnuales('ORDEN_VENTA', 'OV', anio),
    ...(['A', 'B', 'C'] as const).map((subtipo) => ({
      clave: `FACTURA_${subtipo}`,
      etiqueta: `Factura ${subtipo} (número interno)`,
      tipo: 'FACTURA' as const,
      subtipo,
      prefijo: `${subtipo}-`,
      padding: 5,
      proximoNumero: 10001,
    })),
    ...(['A', 'B', 'C'] as const).map((subtipo) => ({
      clave: `NOTA_CREDITO_${subtipo}`,
      etiqueta: `Nota de crédito ${subtipo} (número interno)`,
      tipo: 'FACTURA' as const,
      subtipo,
      prefijo: `NC${subtipo}-`,
      padding: 5,
      proximoNumero: 10001,
    })),
  ]
}

export async function ensureSecuenciasActuales(): Promise<void> {
  const defs = defsSecuenciasPorDefecto()
  for (const d of defs) {
    await secuenciaNumeracionUpsert(d)
  }
}

type SecuenciaDelegate = {
  upsert: (args: {
    where: { clave: string }
    create: DefSecuencia
    update: Record<string, never>
  }) => Promise<unknown>
  findMany: (args: object) => Promise<unknown[]>
  findUnique: (args: object) => Promise<unknown>
  update: (args: object) => Promise<unknown>
}

function secuenciaNumeracionDelegate(): SecuenciaDelegate {
  const c = prisma as unknown as { secuenciaNumeracion?: SecuenciaDelegate }
  const delegate = c.secuenciaNumeracion
  if (delegate && typeof delegate.upsert === 'function') return delegate

  invalidatePrismaCache()
  const retry = (prisma as unknown as { secuenciaNumeracion?: SecuenciaDelegate }).secuenciaNumeracion
  if (retry && typeof retry.upsert === 'function') return retry

  throw new Error(
    'Numeración no disponible: el cliente Prisma está desactualizado. Ejecutá npm run dev:reset y recargá la página.',
  )
}

async function secuenciaNumeracionUpsert(d: DefSecuencia): Promise<void> {
  await secuenciaNumeracionDelegate().upsert({
    where: { clave: d.clave },
    create: d,
    update: {},
  })
}

async function maxCorrelativoEnBd(tipo: TipoSecuencia, prefijo: string): Promise<number> {
  if (tipo === 'PRESUPUESTO') {
    const rows = await prisma.presupuesto.findMany({
      where: { numero: { startsWith: prefijo } },
      select: { numero: true },
    })
    return rows.reduce((max, { numero }) => Math.max(max, parseCorrelativo(numero)), 0)
  }
  if (tipo === 'FACTURA') {
    const rows = await prisma.factura.findMany({
      where: { numero: { startsWith: prefijo } },
      select: { numero: true },
    })
    return rows.reduce((max, { numero }) => Math.max(max, parseCorrelativo(numero)), 0)
  }
  return 0
}

export interface ResumenSecuencia {
  id: string
  clave: string
  etiqueta: string
  tipo: TipoSecuencia
  subtipo: string | null
  anio: number | null
  prefijo: string
  padding: number
  proximoNumero: number
  maxEnBd: number
  proximoEfectivo: number
  ejemplo: string
}

export async function listarResumenNumeracion(): Promise<ResumenSecuencia[]> {
  await ensureSecuenciasActuales()
  const rows = await secuenciaNumeracionDelegate().findMany({
    orderBy: [{ tipo: 'asc' }, { anio: 'desc' }, { subtipo: 'asc' }],
  }) as Array<{
    id: string
    clave: string
    etiqueta: string
    tipo: string
    subtipo: string | null
    anio: number | null
    prefijo: string
    padding: number
    proximoNumero: number
  }>

  const resumen: ResumenSecuencia[] = []
  for (const row of rows) {
    const maxEnBd = await maxCorrelativoEnBd(row.tipo as TipoSecuencia, row.prefijo)
    const proximoEfectivo = Math.max(row.proximoNumero, maxEnBd + 1)
    resumen.push({
      id: row.id,
      clave: row.clave,
      etiqueta: row.etiqueta,
      tipo: row.tipo as TipoSecuencia,
      subtipo: row.subtipo,
      anio: row.anio,
      prefijo: row.prefijo,
      padding: row.padding,
      proximoNumero: row.proximoNumero,
      maxEnBd,
      proximoEfectivo,
      ejemplo: formatearNumero(row.prefijo, proximoEfectivo, row.padding),
    })
  }
  return resumen
}

/** Reserva el próximo número correlativo y avanza la secuencia configurada. */
export async function reservarSiguienteNumero(clave: string): Promise<string> {
  await ensureSecuenciasActuales()
  const seq = await secuenciaNumeracionDelegate().findUnique({ where: { clave } }) as {
    tipo: string
    prefijo: string
    padding: number
    proximoNumero: number
  } | null
  if (!seq) throw new Error(`Secuencia no configurada: ${clave}`)

  const maxEnBd = await maxCorrelativoEnBd(seq.tipo as TipoSecuencia, seq.prefijo)
  const correlativo = Math.max(seq.proximoNumero, maxEnBd + 1)
  const numero = formatearNumero(seq.prefijo, correlativo, seq.padding)

  await secuenciaNumeracionDelegate().update({
    where: { clave },
    data: { proximoNumero: correlativo + 1 },
  })

  return numero
}

export function clavePresupuesto(anio = anioActual()) {
  return `PRESUPUESTO_${anio}`
}

export function claveRemito(anio = anioActual()) {
  return `REMITO_${anio}`
}

export function claveOrdenVenta(anio = anioActual()) {
  return `ORDEN_VENTA_${anio}`
}

export function claveFactura(tipo: string) {
  return `FACTURA_${tipo.toUpperCase()}`
}

export function claveNotaCredito(tipo: string) {
  return `NOTA_CREDITO_${tipo.toUpperCase()}`
}
