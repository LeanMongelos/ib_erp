/**
 * lib/utils.ts
 * Funciones utilitarias reutilizables en todo el sistema.
 *
 * Incluye: clases CSS, formateo de fechas y montos, cálculo de SLA,
 * colores de estados y generadores de números de OT y factura.
 */

import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, formatDistanceToNow, differenceInHours } from 'date-fns'
import { es } from 'date-fns/locale'

/**
 * cn() — combina clases de Tailwind de forma segura.
 * Usa clsx para condicionales y twMerge para resolver conflictos
 * (ej: "p-4 p-6" → "p-6", siempre gana la última).
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Formatea una fecha como "dd/MM/yyyy" en español argentino.
 * Ejemplo: 2026-06-20 → "20/06/2026"
 */
export function formatFecha(fecha: Date | string): string {
  return format(new Date(fecha), 'dd/MM/yyyy', { locale: es })
}

/**
 * Formatea una fecha con hora como "dd/MM/yyyy HH:mm".
 * Ejemplo: 2026-06-20T14:30 → "20/06/2026 14:30"
 */
export function formatFechaHora(fecha: Date | string): string {
  return format(new Date(fecha), 'dd/MM/yyyy HH:mm', { locale: es })
}

/**
 * Formatea una fecha de forma relativa al momento actual.
 * Ejemplo: "hace 3 horas", "en 2 días"
 */
export function formatRelativo(fecha: Date | string): string {
  return formatDistanceToNow(new Date(fecha), { addSuffix: true, locale: es })
}

/**
 * Formatea un valor como moneda ARS (pesos argentinos).
 * Acepta number o string (los importes pueden llegar como string desde la API).
 * Ejemplo: 15000 → "$ 15.000"
 */
export function formatMonto(monto: number | string | null | undefined): string {
  const valor = Number(monto ?? 0)
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
  }).format(Number.isFinite(valor) ? valor : 0)
}

/**
 * Redondea un importe a 2 decimales de forma segura (evita errores de coma
 * flotante tipo 0.1 + 0.2). Usar siempre antes de persistir dinero.
 */
export function redondear2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

/**
 * Calcula qué porcentaje del tiempo SLA ya fue consumido.
 * Retorna un número entre 0 y 100+ (puede superar 100 si el SLA ya venció).
 *
 * Ejemplo: SLA de 48hs, pasaron 24hs → retorna 50
 *          SLA de 48hs, pasaron 60hs → retorna 125 (vencido)
 */
export function calcularPorcentajeSLA(
  fechaApertura: Date | string,
  slaVence: Date | string,
): number {
  const inicio = new Date(fechaApertura).getTime()
  const vence  = new Date(slaVence).getTime()
  const ahora  = Date.now()
  const total  = vence - inicio
  if (total <= 0) return 100
  return Math.round(((ahora - inicio) / total) * 100)
}

/**
 * Devuelve las clases de color Tailwind según el estado de una OT.
 * Se usa para badges y textos en tablas.
 */
export function colorEstadoOT(estado: string): { bg: string; text: string } {
  switch (estado) {
    case 'ABIERTA':    return { bg: 'bg-blue-100',   text: 'text-blue-700' }
    case 'EN_PROCESO': return { bg: 'bg-orange-100', text: 'text-orange-700' }
    case 'CERRADA':    return { bg: 'bg-green-100',  text: 'text-green-700' }
    case 'VENCIDA':    return { bg: 'bg-red-100',    text: 'text-red-700' }
    case 'CANCELADA':  return { bg: 'bg-gray-100',   text: 'text-gray-600' }
    default:           return { bg: 'bg-gray-100',   text: 'text-gray-600' }
  }
}

/**
 * Traduce el estado interno de la OT a una etiqueta legible en español.
 * Ejemplo: "EN_PROCESO" → "En proceso"
 */
export function labelEstadoOT(estado: string): string {
  const labels: Record<string, string> = {
    ABIERTA:    'Abierta',
    EN_PROCESO: 'En proceso',
    CERRADA:    'Cerrada',
    VENCIDA:    'Vencida',
    CANCELADA:  'Cancelada',
  }
  return labels[estado] ?? estado
}

/**
 * Devuelve las clases de color Tailwind según el estado de una factura.
 */
export function colorEstadoFactura(estado: string): { bg: string; text: string } {
  switch (estado) {
    case 'PAGADA':    return { bg: 'bg-green-100',  text: 'text-green-700' }
    case 'PENDIENTE': return { bg: 'bg-orange-100', text: 'text-orange-700' }
    case 'VENCIDA':   return { bg: 'bg-red-100',    text: 'text-red-700' }
    case 'BORRADOR':  return { bg: 'bg-gray-100',   text: 'text-gray-600' }
    case 'ANULADA':   return { bg: 'bg-gray-200',   text: 'text-gray-500' }
    default:          return { bg: 'bg-gray-100',   text: 'text-gray-600' }
  }
}

// Nota: la generación de números correlativos de OT y factura se movió a
// `lib/sequences.ts` (server-only), que calcula el siguiente número de forma
// secuencial y sin colisiones contra los campos `@unique`.
