/**
 * lib/serialize.ts
 * Convierte estructuras de Prisma en datos "planos" serializables para pasar a
 * Client Components o a `NextResponse.json`.
 *
 * - `Prisma.Decimal` → `number` (los importes viajan como números, no como
 *   strings ni objetos Decimal, evitando bugs de concatenación y de
 *   serialización de RSC).
 * - `Date` → ISO string (mismo comportamiento que tenía `JSON.parse(JSON.stringify())`).
 *
 * Solo debe usarse del lado del servidor.
 */

import { Prisma } from '@prisma/client'
import { redactForClient } from '@/lib/security/redact'

/**
 * Tipo resultante de "aplanar" datos de Prisma:
 * - `Decimal` → `number`
 * - `Date`    → `string` (ISO)
 * Recursivo sobre arrays y objetos.
 */
export type Plainify<T> = T extends Prisma.Decimal
  ? number
  : T extends Date
    ? string
    : T extends (infer U)[]
      ? Plainify<U>[]
      : T extends object
        ? { [K in keyof T]: Plainify<T[K]> }
        : T

function esDecimal(v: unknown): v is Prisma.Decimal {
  return (
    Prisma.Decimal.isDecimal(v as never) ||
    (typeof v === 'object' && v !== null && typeof (v as { toNumber?: unknown }).toNumber === 'function')
  )
}

export function plain<T>(value: T): Plainify<T> {
  if (value === null || value === undefined) return value as Plainify<T>
  if (esDecimal(value)) return (value as unknown as Prisma.Decimal).toNumber() as Plainify<T>
  if (value instanceof Date) return value.toISOString() as Plainify<T>
  if (Array.isArray(value)) return value.map((v) => plain(v)) as Plainify<T>
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = plain(v)
    }
    return redactForClient(out) as Plainify<T>
  }
  return value as Plainify<T>
}
