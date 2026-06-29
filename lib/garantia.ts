/**
 * Parseo de texto de garantía comercial (ej. "6 meses") a meses / fecha límite.
 */
import { addMonths } from 'date-fns'
import { prisma } from '@/lib/prisma'

export function esSinGarantia(text: string | null | undefined): boolean {
  if (!text?.trim()) return false
  return /^sin\s+garant/i.test(text.trim())
}

export function esGarantiaSegunFabricante(text: string | null | undefined): boolean {
  if (!text?.trim()) return false
  return /seg[uú]n\s+fabricante/i.test(text.trim())
}

export function parseGarantiaMeses(text: string | null | undefined): number | null {
  if (!text?.trim()) return null
  if (esSinGarantia(text)) return null
  const m = text.trim().match(/^(\d{1,2})\s*mes/i)
  if (!m) return null
  const n = parseInt(m[1]!, 10)
  return n >= 1 && n <= 120 ? n : null
}

export function garantiaHastaDesdeTexto(
  text: string | null | undefined,
  desde: Date = new Date(),
): Date | null {
  const meses = parseGarantiaMeses(text)
  if (!meses) return null
  return addMonths(desde, meses)
}

/** Tras facturar un presupuesto de OT: extiende garantía del equipo vinculado. */
export async function aplicarGarantiaPresupuestoEquipoOt(params: {
  presupuestoId: string
  otId: string
  usuarioId?: string
}): Promise<boolean> {
  const pres = await prisma.presupuesto.findUnique({
    where: { id: params.presupuestoId },
    select: { garantia: true, otId: true },
  })
  if (!pres?.otId || pres.otId !== params.otId) return false

  const ot = await prisma.ordenTrabajo.findUnique({
    where: { id: params.otId },
    select: { equipoId: true, numero: true },
  })
  if (!ot?.equipoId) return false

  const { registrarEntradaHistoria } = await import('@/lib/equipos/historia-clinica')

  if (esSinGarantia(pres.garantia)) {
    await prisma.equipo.update({
      where: { id: ot.equipoId },
      data: { garantiaHasta: null },
    })
    await registrarEntradaHistoria(ot.equipoId, {
      tipo: 'NOTA',
      titulo: `Sin garantía comercial — OT ${ot.numero}`,
      contenido: 'Reparación facturada sin garantía comercial.',
      referenciaId: params.presupuestoId,
      usuarioId: params.usuarioId,
    }).catch(() => null)
    return true
  }

  if (esGarantiaSegunFabricante(pres.garantia)) {
    await registrarEntradaHistoria(ot.equipoId, {
      tipo: 'NOTA',
      titulo: `Garantía según fabricante — OT ${ot.numero}`,
      contenido: `Garantía comercial: ${pres.garantia}`,
      referenciaId: params.presupuestoId,
      usuarioId: params.usuarioId,
    }).catch(() => null)
    return true
  }

  const garantiaHasta = garantiaHastaDesdeTexto(pres.garantia)
  if (!garantiaHasta) return false

  await prisma.equipo.update({
    where: { id: ot.equipoId },
    data: { garantiaHasta },
  })

  await registrarEntradaHistoria(ot.equipoId, {
    tipo: 'NOTA',
    titulo: `Garantía actualizada — OT ${ot.numero}`,
    contenido: `Garantía comercial: ${pres.garantia} (vence ${garantiaHasta.toISOString().slice(0, 10)})`,
    referenciaId: params.presupuestoId,
    usuarioId: params.usuarioId,
  }).catch(() => null)

  return true
}
