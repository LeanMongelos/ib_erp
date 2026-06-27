/**
 * Recordatorio campanita: generar OC de alquiler mensual desde plantilla.
 */
import { prisma } from '@/lib/prisma'

export interface AlertaAlquilerPlantilla {
  plantillaId: string
  nombre: string
  recordatorioDiaMes: number
}

export function debeRecordarAlquilerHoy(recordatorioDiaMes: number, hoy = new Date()): boolean {
  const dia = hoy.getDate()
  const ultimoDiaMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate()
  const diaEfectivo = Math.min(recordatorioDiaMes, ultimoDiaMes)
  return dia >= diaEfectivo
}

export function inicioMes(hoy = new Date()): Date {
  return new Date(hoy.getFullYear(), hoy.getMonth(), 1)
}

export function finMes(hoy = new Date()): Date {
  return new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0, 23, 59, 59, 999)
}

/** Plantillas ALQUILER activas que requieren alerta hoy y no tienen OC del mes. */
export async function consultarAlertasAlquiler(hoy = new Date()): Promise<AlertaAlquilerPlantilla[]> {
  const plantillas = await prisma.plantillaOC.findMany({
    where: {
      activa: true,
      clasificacionOrigen: 'ALQUILER',
      recordatorioDiaMes: { not: null },
    },
    select: { id: true, nombre: true, recordatorioDiaMes: true },
  })

  const alertas: AlertaAlquilerPlantilla[] = []
  const desde = inicioMes(hoy)
  const hasta = finMes(hoy)

  for (const p of plantillas) {
    if (!p.recordatorioDiaMes || !debeRecordarAlquilerHoy(p.recordatorioDiaMes, hoy)) continue

    const ocDelMes = await prisma.ordenCompra.findFirst({
      where: {
        plantillaOcId: p.id,
        creadoEn: { gte: desde, lte: hasta },
        estado: { not: 'CANCELADA' },
      },
      select: { id: true },
    })
    if (ocDelMes) continue

    alertas.push({
      plantillaId: p.id,
      nombre: p.nombre,
      recordatorioDiaMes: p.recordatorioDiaMes,
    })
  }

  return alertas
}
