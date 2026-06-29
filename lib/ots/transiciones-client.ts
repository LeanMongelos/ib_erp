/**
 * Máquina de estados OT — compartida UI ↔ API.
 */
import type { EstadoOT } from '@/types'

const TRANSICIONES: Record<EstadoOT, EstadoOT[]> = {
  ABIERTA: ['EN_PROCESO', 'CANCELADA'],
  EN_PROCESO: ['CERRADA', 'CANCELADA'],
  VENCIDA: ['EN_PROCESO', 'CANCELADA'],
  CERRADA: [],
  CANCELADA: ['ABIERTA'],
}

export function transicionesOTPermitidas(desde: EstadoOT): EstadoOT[] {
  return TRANSICIONES[desde] ?? []
}

export function validarTransicionOT(desde: EstadoOT, hasta: EstadoOT): string | null {
  if (desde === hasta) return 'La OT ya está en ese estado'
  if (!transicionesOTPermitidas(desde).includes(hasta)) {
    return `No se puede pasar de ${desde} a ${hasta}`
  }
  return null
}
