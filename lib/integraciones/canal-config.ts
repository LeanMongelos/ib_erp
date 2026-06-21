import { prisma } from '@/lib/prisma'
import { decryptConfig } from '@/lib/integraciones/crypto'
import type { TipoCanalIntegracion } from '@prisma/client'

export async function getCanalConfigDecrypted(tipo: TipoCanalIntegracion) {
  const canal = await prisma.canalIntegracion.findUnique({ where: { tipo } })
  if (!canal) return null
  return {
    canal,
    config: decryptConfig((canal.config ?? {}) as Record<string, unknown>),
  }
}

export function decryptCanalConfig(config: unknown): Record<string, unknown> {
  return decryptConfig((config ?? {}) as Record<string, unknown>)
}
