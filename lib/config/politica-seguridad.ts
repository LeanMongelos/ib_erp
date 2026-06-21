import { prisma } from '@/lib/prisma'

export type PoliticaSeguridadData = {
  id: string
  longitudMinPassword: number
  requiereMayuscula: boolean
  requiereNumero: boolean
  requiereEspecial: boolean
  expiracionDias: number | null
  maxIntentosLogin: number
  bloqueoMinutos: number
  maxIntentosIpHora: number
  sesionMaxDias: number
  totpHabilitado: boolean
  actualizadoEn: Date
}

let cache: { data: PoliticaSeguridadData; at: number } | null = null
const TTL_MS = 60_000

export async function obtenerPoliticaSeguridad(): Promise<PoliticaSeguridadData> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.data
  const row = await prisma.politicaSeguridad.upsert({
    where: { id: 'default' },
    update: {},
    create: { id: 'default' },
  })
  cache = { data: row, at: Date.now() }
  return row
}

export function invalidarCachePolitica() {
  cache = null
}

export function validarPasswordSegunPolitica(
  password: string,
  politica: PoliticaSeguridadData,
): string | null {
  if (password.length < politica.longitudMinPassword) {
    return `La contraseña debe tener al menos ${politica.longitudMinPassword} caracteres`
  }
  if (politica.requiereMayuscula && !/[A-Z]/.test(password)) {
    return 'Debe incluir al menos una mayúscula'
  }
  if (politica.requiereNumero && !/[0-9]/.test(password)) {
    return 'Debe incluir al menos un número'
  }
  if (politica.requiereEspecial && !/[^A-Za-z0-9]/.test(password)) {
    return 'Debe incluir al menos un carácter especial'
  }
  return null
}
