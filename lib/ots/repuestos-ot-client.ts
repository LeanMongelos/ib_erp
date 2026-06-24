/**
 * Repuestos OT — validación compartida UI ↔ API.
 */
export type RepuestoOTInput = {
  descripcion: string
  cantidad: number
  precioUnit: number
  inventarioId?: string | null
}

export function validarRepuestosOTCliente(repuestos: RepuestoOTInput[]): string | null {
  for (let i = 0; i < repuestos.length; i++) {
    const r = repuestos[i]
    const n = i + 1
    if (!r.descripcion?.trim()) {
      return `Repuesto ${n}: la descripción es obligatoria`
    }
    if (!Number.isFinite(r.cantidad) || r.cantidad < 1) {
      return `Repuesto ${n}: la cantidad debe ser mayor a 0`
    }
    if (!Number.isFinite(r.precioUnit) || r.precioUnit < 0) {
      return `Repuesto ${n}: el precio no puede ser negativo`
    }
  }
  return null
}
