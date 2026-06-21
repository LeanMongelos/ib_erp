/**
 * lib/prisma.ts
 * Cliente Prisma singleton con auto-recuperación en dev tras `prisma generate`.
 */

import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  prismaSchemaVersion: number | undefined
}

/** Incrementar al agregar modelos al schema (invalida cache HMR). */
const PRISMA_SCHEMA_VERSION = 14

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL!
  const adapter = new PrismaPg({ connectionString })
  return new PrismaClient({ adapter })
}

function clientHasExpectedModels(client: PrismaClient): boolean {
  const c = client as unknown as Record<string, Record<string, unknown> | undefined>
  if (
    typeof c.alicuotaIva?.upsert !== 'function' ||
    typeof c.vencimientoCobranza?.findMany !== 'function' ||
    typeof c.configuracionContable?.upsert !== 'function' ||
    typeof c.secuenciaNumeracion?.upsert !== 'function' ||
    typeof c.equipoComponente?.findMany !== 'function' ||
    typeof c.historiaClinicaEntrada?.create !== 'function' ||
    typeof c.categoriaInventarioCat?.findMany !== 'function' ||
    typeof c.politicaSeguridad?.upsert !== 'function' ||
    typeof c.notificacionLeida?.upsert !== 'function'
  ) {
    return false
  }
  // Validar relación Factura.vencimientos en metadata del cliente generado
  const runtime = client as unknown as { _runtimeDataModel?: { models?: Record<string, { fields?: { name: string }[] }> } }
  const facturaFields = runtime._runtimeDataModel?.models?.Factura?.fields?.map((f) => f.name) ?? []
  if (facturaFields.length > 0 && !facturaFields.includes('vencimientos')) {
    return false
  }
  const presupuestoFields = runtime._runtimeDataModel?.models?.Presupuesto?.fields?.map((f) => f.name) ?? []
  if (presupuestoFields.length > 0 && !presupuestoFields.includes('otId')) {
    return false
  }
  const otFields = runtime._runtimeDataModel?.models?.OrdenTrabajo?.fields?.map((f) => f.name) ?? []
  if (otFields.length > 0 && !otFields.some((f) => f === 'presupuestos')) {
    return false
  }
  return true
}

function getPrismaClient(): PrismaClient {
  const cached = globalForPrisma.prisma
  const versionOk = globalForPrisma.prismaSchemaVersion === PRISMA_SCHEMA_VERSION

  if (cached && versionOk && clientHasExpectedModels(cached)) {
    return cached
  }

  if (cached) {
    globalForPrisma.prisma = undefined
    cached.$disconnect().catch(() => {})
  }

  const fresh = createPrismaClient()
  globalForPrisma.prisma = fresh
  globalForPrisma.prismaSchemaVersion = PRISMA_SCHEMA_VERSION
  return fresh
}

/** Fuerza recarga del cliente (p. ej. tras prisma generate sin reiniciar dev). */
export function invalidatePrismaCache(): void {
  const cached = globalForPrisma.prisma
  globalForPrisma.prisma = undefined
  globalForPrisma.prismaSchemaVersion = undefined
  if (cached) cached.$disconnect().catch(() => {})
}

/** Proxy: cada acceso repasa por getPrismaClient() (crítico tras HMR + prisma generate). */
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    if (prop === 'then') return undefined
    const client = getPrismaClient()
    const value = Reflect.get(client as object, prop, receiver)
    return typeof value === 'function' ? value.bind(client) : value
  },
})

export default prisma
