/**
 * Conteo rápido de advertencias I2–I5 y Pr3 (mismas reglas que reparar-integridad).
 */

import { prisma } from '@/lib/prisma'
import { criterioPresupuestosVencidos } from '@/lib/presupuestos/vencimiento'

export async function contarAdvertenciasIntegridad(): Promise<number> {
  const ahora = new Date()
  let count = 0

  const otSla = await prisma.ordenTrabajo.count({
    where: {
      estado: { in: ['ABIERTA', 'EN_PROCESO'] },
      slaVence: { lt: ahora },
    },
  })
  if (otSla > 0) count++

  const presVenc = await prisma.presupuesto.count({
    where: criterioPresupuestosVencidos(),
  })
  if (presVenc > 0) count++

  const crmSinCliente = await prisma.conversacionCRM.count({
    where: {
      clienteId: null,
      estado: { in: ['ABIERTA', 'PENDIENTE'] },
    },
  })
  if (crmSinCliente > 0) count++

  for (const tipo of ['FACTURA', 'PRESUPUESTO'] as const) {
    const rows = await prisma.plantillaImpresion.count({
      where: { tipo, predeterminado: true, activo: true },
    })
    if (rows > 1) count++
  }

  const emisoresDup = await prisma.emisor.count({
    where: { predeterminado: true, activo: true },
  })
  if (emisoresDup > 1) count++

  const listasDup = await prisma.listaPrecios.count({
    where: { predeterminada: true, activo: true },
  })
  if (listasDup > 1) count++

  const embudoSinCliente = await prisma.negocioEmbudo.count({
    where: {
      activo: true,
      etapa: { not: 'CIERRE' },
      clienteId: null,
    },
  })
  if (embudoSinCliente > 0) count++

  return count
}
