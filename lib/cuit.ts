/**
 * Validación y normalización de CUIT argentino (formato + dígito verificador AFIP).
 */

const FORMATO_CUIT = /^\d{2}-?\d{8}-?\d$/

/** Solo dígitos del CUIT (11 caracteres). */
export function cuitSoloDigitos(cuit: string): string {
  return cuit.replace(/\D/g, '')
}

/** Formato estándar XX-XXXXXXXX-X. */
export function formatearCuit(cuit: string): string {
  const d = cuitSoloDigitos(cuit)
  if (d.length !== 11) return cuit.trim()
  return `${d.slice(0, 2)}-${d.slice(2, 10)}-${d.slice(10)}`
}

/** Valida formato y dígito verificador (módulo 11 AFIP). */
export function validarCuit(cuit: string): boolean {
  const raw = cuit.trim()
  if (!raw) return false
  if (!FORMATO_CUIT.test(raw)) return false

  const d = cuitSoloDigitos(raw)
  if (d.length !== 11) return false

  const mult = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2]
  let suma = 0
  for (let i = 0; i < 10; i++) {
    suma += parseInt(d[i]!, 10) * mult[i]!
  }
  const mod = suma % 11
  let verificador = 11 - mod
  if (verificador === 11) verificador = 0
  if (verificador === 10) verificador = 9

  return verificador === parseInt(d[10]!, 10)
}
