import { prisma } from '@/lib/prisma'
import { formatAlicuotaLabel } from '@/lib/iva/format'

export { formatAlicuotaLabel }

export const ALICUOTAS_IVA_SEED = [
  { id: 'alicuota-iva-21', codigo: 'IVA_21', nombre: 'IVA General', porcentaje: 21, esPredeterminada: true },
  { id: 'alicuota-iva-10_5', codigo: 'IVA_10_5', nombre: 'IVA Reducido', porcentaje: 10.5, esPredeterminada: false },
  { id: 'alicuota-iva-27', codigo: 'IVA_27', nombre: 'IVA Incrementado', porcentaje: 27, esPredeterminada: false },
  { id: 'alicuota-iva-0', codigo: 'IVA_0', nombre: 'Exento / 0%', porcentaje: 0, esPredeterminada: false },
] as const

export async function ensureAlicuotasIvaDefault() {
  for (const a of ALICUOTAS_IVA_SEED) {
    await prisma.alicuotaIva.upsert({
      where: { id: a.id },
      create: { ...a, activo: true },
      update: {
        nombre: a.nombre,
        porcentaje: a.porcentaje,
        activo: true,
      },
    })
  }

  const predeterminada = ALICUOTAS_IVA_SEED.find((a) => a.esPredeterminada)!
  await prisma.alicuotaIva.updateMany({ data: { esPredeterminada: false } })
  await prisma.alicuotaIva.update({
    where: { id: predeterminada.id },
    data: { esPredeterminada: true },
  })

  return prisma.alicuotaIva.findMany({ where: { activo: true }, orderBy: { porcentaje: 'asc' } })
}

export async function getAlicuotaPredeterminada() {
  const pred = await prisma.alicuotaIva.findFirst({
    where: { activo: true, esPredeterminada: true },
  })
  if (pred) return pred
  return prisma.alicuotaIva.findFirst({
    where: { activo: true },
    orderBy: { porcentaje: 'desc' },
  })
}
