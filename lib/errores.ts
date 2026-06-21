/**
 * Mensajes de error en español — API y cliente (sin dependencia de Zod).
 */

/** Traduce mensajes técnicos frecuentes (dev) a español claro. */
export function traducirMensajeInterno(mensaje: string): string {
  const m = mensaje.trim()
  const mapa: Record<string, string> = {
    'Required': 'Campo obligatorio',
    'Invalid input': 'Dato inválido',
    'Expected number, received string': 'Se esperaba un número',
    'Expected string, received number': 'Se esperaba texto',
    'Not found': 'Registro no encontrado',
    'Unauthorized': 'No autorizado',
    'Forbidden': 'Sin permisos',
    'Network Error': 'Error de conexión',
    'Failed to fetch': 'No se pudo conectar con el servidor',
    'Body is unusable': 'No se pudo leer la respuesta del servidor',
    'body stream already read': 'No se pudo leer la respuesta del servidor',
  }
  for (const [en, es] of Object.entries(mapa)) {
    if (m.includes(en)) return es
  }
  if (/^Invalid prisma/i.test(m)) return 'Error en la base de datos'
  if (/Cannot read properties of undefined/i.test(m)) {
    return 'Error interno del servidor — reiniciá el entorno de desarrollo (npm run dev:reset)'
  }
  if (/Cannot use a pool after calling end/i.test(m)) {
    return 'Error interno del servidor — reiniciá el entorno de desarrollo (npm run dev:reset)'
  }
  return m
}

/** Extrae mensaje de un cuerpo JSON `{ error: string }` o Zod details. */
export function mensajeErrorJson(json: unknown, fallback: string): string {
  if (!json || typeof json !== 'object') return fallback
  const o = json as Record<string, unknown>
  if (typeof o.error === 'string' && o.error.trim()) {
    return traducirMensajeInterno(o.error)
  }
  if (Array.isArray(o.details)) {
    const first = o.details[0] as { message?: string } | undefined
    if (first?.message) return traducirMensajeInterno(first.message)
  }
  return fallback
}

export function mensajeErrorDesconocido(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message.trim()) {
    return traducirMensajeInterno(err.message)
  }
  if (typeof err === 'string' && err.trim()) {
    return traducirMensajeInterno(err)
  }
  return fallback
}

/** Lee JSON de respuesta fallida y devuelve mensaje en español. */
export async function mensajeErrorRespuesta(res: Response, fallback: string): Promise<string> {
  try {
    const json = await res.json()
    return mensajeErrorJson(json, fallback)
  } catch {
    if (res.status === 401) return 'Sesión expirada — volvé a iniciar sesión'
    if (res.status === 403) return 'No tenés permisos para realizar esta acción'
    if (res.status === 404) return 'Registro no encontrado'
    if (res.status >= 500) return 'Error interno del servidor'
    return fallback
  }
}

/** Parsea JSON una sola vez; lanza si la respuesta no es OK. */
export async function parsearRespuestaApi<T>(res: Response, fallback: string): Promise<T> {
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(mensajeErrorJson(json, fallback))
  return json as T
}

/** Lanza Error con mensaje en español desde cuerpo API. */
export function lanzarErrorApi(json: unknown, fallback: string): never {
  throw new Error(mensajeErrorJson(json, fallback))
}
