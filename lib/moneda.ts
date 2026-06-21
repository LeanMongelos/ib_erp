/**
 * lib/moneda.ts — Soporte multi-moneda (ARS / USD) para documentos comerciales.
 */

import { z } from 'zod'
import type { PrismaClient } from '@prisma/client'
import { numeroALetras } from '@/lib/plantillas/numero-a-letras'

export const MONEDAS_DOCUMENTO = ['ARS', 'USD'] as const
export type MonedaDocumento = (typeof MONEDAS_DOCUMENTO)[number]
export const monedaDocumentoEnum = z.enum(MONEDAS_DOCUMENTO)

const ETIQUETAS: Record<string, string> = {
  ARS: 'Peso argentino (ARS)',
  USD: 'Dólar estadounidense (USD)',
}

const SIMBOLOS: Record<string, string> = {
  ARS: '$',
  USD: 'US$',
}

export function afipMonedaId(moneda: string): 'PES' | 'DOL' {
  return moneda === 'USD' ? 'DOL' : 'PES'
}

export function etiquetaMoneda(moneda: string): string {
  return ETIQUETAS[moneda] ?? moneda
}

export function simboloMoneda(moneda: string): string {
  return SIMBOLOS[moneda] ?? moneda
}

/** Formato UI general con Intl (tablas, totales en pantalla). */
export function formatMontoMoneda(
  monto: number | string | null | undefined,
  moneda: string = 'ARS',
): string {
  const valor = Number(monto ?? 0)
  const currency = moneda === 'USD' ? 'USD' : 'ARS'
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency,
    minimumFractionDigits: moneda === 'USD' ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(valor) ? valor : 0)
}

/** Formato para plantillas PDF/HTML (ARS: $1.234,56 · USD: US$ 1.234,56). */
export function formatImporteDocumento(
  monto: number | string | null | undefined,
  moneda: string = 'ARS',
): string {
  const valor = Number(monto ?? 0)
  if (!Number.isFinite(valor)) {
    return moneda === 'USD' ? 'US$ 0,00' : '$0,00'
  }
  const [entero, dec = '00'] = Math.abs(valor).toFixed(2).split('.')
  const puntos = entero.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  const signo = valor < 0 ? '-' : ''
  if (moneda === 'USD') {
    return `${signo}US$ ${puntos},${dec}`
  }
  return `${signo}$${puntos},${dec}`
}

export function numeroALetrasMoneda(total: number, moneda: string): string {
  const texto = numeroALetras(total)
  if (moneda === 'USD') {
    return texto.replace('Son pesos', 'Son dólares estadounidenses')
  }
  return texto
}

/** Cotización USD desde override explícito o configuración contable. */
export async function resolverCotizacionUsd(
  prisma: PrismaClient,
  explicit?: number | null,
): Promise<number | null> {
  if (explicit != null && explicit > 0) return explicit
  const config = await prisma.configuracionContable.findUnique({ where: { id: 'default' } })
  if (config?.cotizacionUsdManual != null && config.cotizacionUsdManual > 0) {
    return config.cotizacionUsdManual
  }
  return null
}

export class CotizacionUsdFaltanteError extends Error {
  constructor() {
    super(
      'La cotización USD es obligatoria para documentos en dólares. Configurala en Contabilidad o ingresala manualmente.',
    )
    this.name = 'CotizacionUsdFaltanteError'
  }
}

/** Resuelve cotización para documentos USD; lanza si falta. */
export async function resolverCotizacionUsdDocumento(
  prisma: PrismaClient,
  moneda: string,
  explicit?: number | null,
): Promise<number | null> {
  if (moneda !== 'USD') return null
  const cot = await resolverCotizacionUsd(prisma, explicit)
  if (!cot) throw new CotizacionUsdFaltanteError()
  return cot
}
