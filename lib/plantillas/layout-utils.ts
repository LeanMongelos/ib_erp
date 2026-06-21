/** Utilidades de coordenadas para layout en mm ↔ pt (A4). */

export const A4_ANCHO_MM = 210
export const A4_ALTO_MM = 297
export const A4_ANCHO_PT = 595.28
export const A4_ALTO_PT = 842

export function mmToPt(mm: number): number {
  return (mm * 72) / 25.4
}

export function ptToMm(pt: number): number {
  return (pt * 25.4) / 72
}

export function layoutRectPt(
  el: { x: number; y: number; width: number; height: number },
  opts?: { autoHeight?: boolean },
) {
  const rect = {
    position: 'absolute' as const,
    left: mmToPt(el.x),
    top: mmToPt(el.y),
    width: mmToPt(el.width),
  }
  if (!opts?.autoHeight) {
    return { ...rect, height: mmToPt(el.height) }
  }
  return { ...rect, minHeight: mmToPt(el.height) }
}
