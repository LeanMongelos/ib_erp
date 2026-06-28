import { prisma } from '@/lib/prisma'
import { calcularVencimientoCuota, formatPeriodo } from '@/lib/alquiler/periodo'

export async function generarCuotasMesAlquiler(fechaRef = new Date()) {
  const periodo = formatPeriodo(fechaRef)

  const contratos = await prisma.contratoAlquiler.findMany({
    where: { estado: 'ACTIVO' },
    include: {
      lineas: { where: { activa: true } },
    },
  })

  let creadas = 0

  for (const contrato of contratos) {
    if (contrato.fechaFin && contrato.fechaFin < fechaRef) continue

    const vencimiento = calcularVencimientoCuota(fechaRef, contrato.diaFacturacion)

    for (const linea of contrato.lineas) {
      const existe = await prisma.cuotaAlquiler.findUnique({
        where: { lineaId_periodo: { lineaId: linea.id, periodo } },
      })
      if (existe) continue

      await prisma.cuotaAlquiler.create({
        data: {
          contratoId: contrato.id,
          lineaId: linea.id,
          periodo,
          monto: linea.montoMensual,
          vencimiento,
          estado: 'PENDIENTE',
        },
      })
      creadas++
    }
  }

  return { periodo, creadas }
}
