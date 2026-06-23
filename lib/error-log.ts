/**
 * lib/error-log.ts
 * Persistencia de errores técnicos del sistema (distinto de auditoría de negocio).
 * Retención: 15 días. Nunca debe hacer fallar la operación principal.
 */

import { NivelLog } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getIp } from '@/lib/audit'

export const LOG_RETENTION_DAYS = 15

export interface ErrorLogInput {
  nivel?: NivelLog
  origen: string
  mensaje: string
  stack?: string | null
  ruta?: string | null
  metodo?: string | null
  usuarioId?: string | null
  ip?: string | null
  metadata?: Record<string, unknown> | null
}

let ultimaLimpieza = 0

function stackDe(error: unknown): string | null {
  if (error instanceof Error && error.stack) return error.stack
  return null
}

function mensajeDe(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  try {
    return JSON.stringify(error)
  } catch {
    return 'Error desconocido'
  }
}

/** Registra un error/evento técnico. Fire-and-forget seguro. */
export async function registrarError(input: ErrorLogInput): Promise<void> {
  try {
    await prisma.systemLog.create({
      data: {
        nivel: input.nivel ?? NivelLog.ERROR,
        origen: input.origen,
        ruta: input.ruta ?? null,
        metodo: input.metodo ?? null,
        mensaje: input.mensaje.slice(0, 4000),
        stack: input.stack?.slice(0, 12000) ?? null,
        usuarioId: input.usuarioId ?? null,
        ip: input.ip ?? null,
        metadata: (input.metadata ?? undefined) as object | undefined,
      },
    })
    void limpiarLogsAntiguosSiCorresponde()
  } catch (error) {
    console.error('[error-log] no se pudo registrar:', error)
  }
}

/** Atajo para registrar desde un `catch` genérico. */
export async function registrarErrorDesdeExcepcion(
  origen: string,
  error: unknown,
  extra?: Omit<ErrorLogInput, 'origen' | 'mensaje' | 'stack'>,
): Promise<void> {
  await registrarError({
    origen,
    mensaje: mensajeDe(error),
    stack: stackDe(error),
    ...extra,
  })
}

/** Elimina logs con más de LOG_RETENTION_DAYS días. */
export async function limpiarLogsAntiguos(): Promise<number> {
  const corte = new Date()
  corte.setDate(corte.getDate() - LOG_RETENTION_DAYS)
  corte.setHours(0, 0, 0, 0)
  const { count } = await prisma.systemLog.deleteMany({
    where: { fecha: { lt: corte } },
  })
  ultimaLimpieza = Date.now()
  return count
}

/** Ejecuta limpieza como máximo una vez por hora (en caliente). */
async function limpiarLogsAntiguosSiCorresponde(): Promise<void> {
  const UNA_HORA = 60 * 60 * 1000
  if (Date.now() - ultimaLimpieza < UNA_HORA) return
  try {
    const n = await limpiarLogsAntiguos()
    if (n > 0) console.log(`[error-log] ${n} registro(s) eliminado(s) (> ${LOG_RETENTION_DAYS} días)`)
  } catch (error) {
    console.error('[error-log] limpieza fallida:', error)
  }
}

export interface ApiErrorLogContext {
  req?: Request
  origen?: string
  ruta?: string
  metodo?: string
  usuarioId?: string | null
  metadata?: Record<string, unknown>
}

/** Persiste un 500 de API sin bloquear la respuesta al cliente. */
export function persistirErrorApi(error: unknown, ctx?: ApiErrorLogContext): void {
  void (async () => {
    const ip = ctx?.req ? getIp(ctx.req) : null
    await registrarError({
      origen: ctx?.origen ?? 'api',
      ruta: ctx?.ruta ?? (ctx?.req ? new URL(ctx.req.url).pathname : null),
      metodo: ctx?.metodo ?? ctx?.req?.method ?? null,
      mensaje: mensajeDe(error),
      stack: stackDe(error),
      usuarioId: ctx?.usuarioId ?? null,
      ip,
      metadata: ctx?.metadata ?? null,
    })
  })()
}

/** Fecha local YYYY-MM-DD para agrupar logs por día. */
export function diaLocal(fecha: Date): string {
  const y = fecha.getFullYear()
  const m = String(fecha.getMonth() + 1).padStart(2, '0')
  const d = String(fecha.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Rango [inicio, fin] del día local (para filtros). */
export function rangoDiaLocal(dia: string): { gte: Date; lte: Date } {
  const gte = new Date(`${dia}T00:00:00`)
  const lte = new Date(`${dia}T23:59:59.999`)
  return { gte, lte }
}
