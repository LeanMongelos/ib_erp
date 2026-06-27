/**
 * Plantilla OC de alquiler mensual (seed idempotente).
 */
import { prisma } from '@/lib/prisma'

const PLANTILLA_ID = 'seed-plantilla-alquiler-mensual'

export async function seedPlantillaAlquilerMensual() {
  const proveedor = await prisma.proveedor.findFirst({
    where: { activo: true },
    orderBy: { razonSocial: 'asc' },
  })
  if (!proveedor) return

  const existente = await prisma.plantillaOC.findUnique({ where: { id: PLANTILLA_ID } })
  if (existente) {
    await prisma.plantillaOC.update({
      where: { id: PLANTILLA_ID },
      data: { activa: true },
    })
    return
  }

  await prisma.plantillaOC.create({
    data: {
      id: PLANTILLA_ID,
      nombre: 'Alquiler mensual',
      clasificacionOrigen: 'ALQUILER',
      proveedorId: proveedor.id,
      descripcionDefault: 'Alquiler de equipamiento / espacio',
      justificacionDefault: 'Alquiler mensual recurrente',
      moneda: proveedor.moneda,
      recordatorioDiaMes: 1,
      items: {
        create: [{
          descripcion: 'Alquiler mensual',
          concepto: 'Alquiler',
          cantidad: 1,
          precioUnit: 0,
        }],
      },
    },
  })
}
