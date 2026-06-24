/** Validaciones compartidas para formularios del cliente (espejo de lib/validation.ts). */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function validarEmailOpcional(valor: string): string | null {
  const v = valor.trim()
  if (!v) return null
  if (!EMAIL_RE.test(v)) return 'Email inválido'
  return null
}

export function validarEmailRequerido(valor: string): string | null {
  const v = valor.trim()
  if (!v) return 'El email es obligatorio'
  if (!EMAIL_RE.test(v)) return 'Email inválido'
  return null
}

export function validarEnteroPositivo(valor: string, etiqueta = 'El valor'): string | null {
  const v = valor.trim()
  if (!v) return `${etiqueta} es obligatorio`
  if (!/^\d+$/.test(v)) return `${etiqueta} debe ser un número entero`
  const n = Number(v)
  if (!Number.isSafeInteger(n) || n <= 0) return `${etiqueta} debe ser mayor a 0`
  return null
}

export function validarEnteroNoNegativo(valor: string, etiqueta = 'El valor'): string | null {
  const v = valor.trim()
  if (!v) return null
  if (!/^\d+$/.test(v)) return `${etiqueta} debe ser un número entero`
  return null
}

export function parseEnteroPositivo(valor: string): number | null {
  const err = validarEnteroPositivo(valor)
  if (err) return null
  return Number(valor.trim())
}

export function parseEnteroNoNegativo(valor: string, fallback = 0): number {
  const v = valor.trim()
  if (!v) return fallback
  if (!/^\d+$/.test(v)) return fallback
  return Number(v)
}
