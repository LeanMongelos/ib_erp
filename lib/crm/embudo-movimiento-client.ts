/**
 * Reglas de movimiento entre etapas — compartidas UI ↔ API (embudo CRM).
 */
import type { EtapaKey } from '@/lib/crm/embudo-constants'
import { etapaOrder, isAdjacentForward, isForwardMove } from '@/lib/crm/embudo-constants'

export function validarMovimientoEmbudoCliente(
  desde: EtapaKey,
  hasta: EtapaKey,
  retroceso?: boolean,
): string | null {
  if (desde === hasta) return 'El negocio ya está en esa etapa'

  const forward = isForwardMove(desde, hasta)
  if (forward && !isAdjacentForward(desde, hasta)) {
    return 'Solo se puede avanzar una etapa a la vez'
  }
  if (!forward && !retroceso) {
    return 'Los retrocesos deben confirmarse con motivo'
  }
  if (retroceso && forward) {
    return 'Movimiento inválido'
  }
  if (!forward && etapaOrder(hasta) >= etapaOrder(desde)) {
    return 'Movimiento inválido'
  }
  return null
}
