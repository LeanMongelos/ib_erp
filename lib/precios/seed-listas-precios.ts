import type { PrismaClient } from '@prisma/client'

const FACTOR_MAYORISTA = 0.85

/**
 * Crea listas MIN-ARS y MAY-ARS predeterminadas e items desde inventario activo.
 * Mayorista = 85% del precio minorista (o del precioUnit del inventario si no hay minorista).
 */
export async function seedListasPrecios(prisma: PrismaClient): Promise<{ minoristaId: string; mayoristaId: string; items: number }> {
  const inventario = await prisma.inventario.findMany({
    where: { activo: true },
    select: { id: true, precioUnit: true, moneda: true },
  })

  const listaMinorista = await prisma.listaPrecios.upsert({
    where: { codigo: 'MIN-ARS' },
    update: {
      nombre: 'Lista minorista ARS',
      tipo: 'MINORISTA',
      moneda: 'ARS',
      activo: true,
      predeterminada: true,
    },
    create: {
      codigo: 'MIN-ARS',
      nombre: 'Lista minorista ARS',
      tipo: 'MINORISTA',
      moneda: 'ARS',
      predeterminada: true,
      activo: true,
    },
  })

  // Solo una predeterminada minorista
  await prisma.listaPrecios.updateMany({
    where: {
      id: { not: listaMinorista.id },
      tipo: 'MINORISTA',
      moneda: 'ARS',
      predeterminada: true,
    },
    data: { predeterminada: false },
  })

  const listaMayorista = await prisma.listaPrecios.upsert({
    where: { codigo: 'MAY-ARS' },
    update: {
      nombre: 'Lista mayorista ARS',
      tipo: 'MAYORISTA',
      moneda: 'ARS',
      activo: true,
      predeterminada: true,
    },
    create: {
      codigo: 'MAY-ARS',
      nombre: 'Lista mayorista ARS',
      tipo: 'MAYORISTA',
      moneda: 'ARS',
      predeterminada: true,
      activo: true,
    },
  })

  await prisma.listaPrecios.updateMany({
    where: {
      id: { not: listaMayorista.id },
      tipo: 'MAYORISTA',
      moneda: 'ARS',
      predeterminada: true,
    },
    data: { predeterminada: false },
  })

  let itemsCreados = 0

  for (const inv of inventario) {
    if (inv.moneda !== 'ARS' || inv.precioUnit == null || inv.precioUnit <= 0) continue

    const precioMinorista = inv.precioUnit
    const precioMayorista = Math.round(precioMinorista * FACTOR_MAYORISTA * 100) / 100

    await prisma.listaPreciosItem.upsert({
      where: {
        listaPreciosId_inventarioId: {
          listaPreciosId: listaMinorista.id,
          inventarioId: inv.id,
        },
      },
      update: { precioUnit: precioMinorista },
      create: {
        listaPreciosId: listaMinorista.id,
        inventarioId: inv.id,
        precioUnit: precioMinorista,
      },
    })

    await prisma.listaPreciosItem.upsert({
      where: {
        listaPreciosId_inventarioId: {
          listaPreciosId: listaMayorista.id,
          inventarioId: inv.id,
        },
      },
      update: { precioUnit: precioMayorista },
      create: {
        listaPreciosId: listaMayorista.id,
        inventarioId: inv.id,
        precioUnit: precioMayorista,
      },
    })

    itemsCreados += 2
  }

  return { minoristaId: listaMinorista.id, mayoristaId: listaMayorista.id, items: itemsCreados }
}
