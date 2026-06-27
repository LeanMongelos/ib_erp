/**
 * Código interno de producto en stock (campo inventario.sku).
 * Formatos válidos: mínimo 3 letras + 3 números; máximo 4 letras + 4 números.
 * Ejemplos: HOE098 (3+3), ABCD1234 (4+4).
 */
import { z } from 'zod'

const RE_CODIGO = /^([A-Z]{3,4})([0-9]{3,4})$/

export function normalizarCodigoInterno(raw: string): string {
  return raw.trim().toUpperCase().replace(/[\s-]/g, '')
}

export function validarCodigoInterno(
  raw: string,
): { ok: true; codigo: string } | { ok: false; error: string } {
  const codigo = normalizarCodigoInterno(raw)
  if (!codigo) {
    return { ok: false, error: 'El código interno es obligatorio' }
  }

  const match = codigo.match(RE_CODIGO)
  if (!match) {
    return {
      ok: false,
      error:
        'Código interno inválido: usá 3–4 letras mayúsculas y 3–4 números (mínimo 3+3, ej. HOE098 o ABCD1234).',
    }
  }

  const letras = match[1]!.length
  const numeros = match[2]!.length
  if (letras + numeros < 6) {
    return {
      ok: false,
      error: 'El código debe tener al menos 3 letras y 3 números (ej. HOE098).',
    }
  }

  return { ok: true, codigo }
}

export const codigoInternoSchema = z
  .string()
  .trim()
  .min(1, 'El código interno es obligatorio')
  .transform(normalizarCodigoInterno)
  .superRefine((codigo, ctx) => {
    const r = validarCodigoInterno(codigo)
    if (!r.ok) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: r.error })
    }
  })

/** En updates: omitir o validar formato si se envía. */
export const codigoInternoOpcionalSchema = z
  .string()
  .trim()
  .optional()
  .nullable()
  .transform((v) => {
    if (v == null || v === '') return null
    return normalizarCodigoInterno(v)
  })
  .superRefine((codigo, ctx) => {
    if (codigo == null) return
    const r = validarCodigoInterno(codigo)
    if (!r.ok) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: r.error })
    }
  })
