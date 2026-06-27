/** Validación y normalización de teléfonos (solo dígitos + formato común). */

const TELEFONO_CHARS_RE = /^[\d\s+\-().]*$/
const MIN_DIGITOS = 6
const MAX_DIGITOS = 15

/** Filtra caracteres no permitidos mientras el usuario escribe. */
export function normalizarEntradaTelefono(valor: string): string {
  return valor.replace(/[^\d\s+\-().]/g, '')
}

export function contarDigitosTelefono(valor: string): number {
  return valor.replace(/\D/g, '').length
}

/** `null` = OK; string = mensaje de error en español. Vacío es válido (opcional). */
export function validarTelefonoOpcional(valor: string): string | null {
  const v = valor.trim()
  if (!v) return null
  if (!TELEFONO_CHARS_RE.test(v)) {
    return 'El teléfono solo puede contener números, espacios, +, -, ( y )'
  }
  const digitos = contarDigitosTelefono(v)
  if (digitos < MIN_DIGITOS) return `El teléfono debe tener al menos ${MIN_DIGITOS} dígitos`
  if (digitos > MAX_DIGITOS) return `El teléfono no puede superar ${MAX_DIGITOS} dígitos`
  return null
}

export function telefonoEsValido(valor: string | null | undefined): boolean {
  if (valor == null || !String(valor).trim()) return true
  return validarTelefonoOpcional(String(valor)) === null
}
