import type { EstadoTicket } from '@prisma/client'

const TRANSICIONES: Record<EstadoTicket, EstadoTicket[]> = {
  ABIERTA: ['EN_REVISION', 'EN_PROGRESO', 'CANCELADA'],
  EN_REVISION: ['EN_PROGRESO', 'ESPERANDO_INFO', 'CANCELADA'],
  EN_PROGRESO: ['ESPERANDO_INFO', 'RESUELTA', 'CANCELADA'],
  ESPERANDO_INFO: ['EN_PROGRESO', 'CANCELADA'],
  RESUELTA: ['CERRADA', 'EN_PROGRESO'],
  CERRADA: [],
  CANCELADA: ['ABIERTA'],
}

export function validarTransicionTicket(actual: EstadoTicket, nuevo: EstadoTicket): string | null {
  if (actual === nuevo) return null
  const permitidos = TRANSICIONES[actual] ?? []
  if (!permitidos.includes(nuevo)) {
    return `No se puede pasar de "${actual}" a "${nuevo}"`
  }
  return null
}

export function estadosTicketAbiertos(): EstadoTicket[] {
  return ['ABIERTA', 'EN_REVISION', 'EN_PROGRESO', 'ESPERANDO_INFO', 'RESUELTA']
}
