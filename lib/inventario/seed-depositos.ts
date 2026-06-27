/**
 * Depósitos base idempotentes (Showroom, Depósito, Área ST, Polo Científico).
 */
import { prisma } from '@/lib/prisma'

const DEPOSITOS_BASE = [
  { id: 'seed-deposito-showroom', nombre: 'Showroom', tipo: 'SHOWROOM' as const },
  { id: 'seed-deposito-principal', nombre: 'Depósito', tipo: 'DEPOSITO' as const },
  { id: 'seed-deposito-area-st', nombre: 'Área ST', tipo: 'OTRO' as const },
  {
    id: 'seed-deposito-polo-cientifico',
    nombre: 'Polo Científico',
    tipo: 'DEPOSITO' as const,
    direccion: 'Polo Científico — Formosa',
  },
]

export async function seedDepositosBase() {
  for (const d of DEPOSITOS_BASE) {
    await prisma.deposito.upsert({
      where: { id: d.id },
      update: {
        nombre: d.nombre,
        tipo: d.tipo,
        activo: true,
        ...('direccion' in d && d.direccion ? { direccion: d.direccion } : {}),
      },
      create: {
        id: d.id,
        nombre: d.nombre,
        tipo: d.tipo,
        activo: true,
        ...('direccion' in d && d.direccion ? { direccion: d.direccion } : {}),
      },
    })
  }
}
