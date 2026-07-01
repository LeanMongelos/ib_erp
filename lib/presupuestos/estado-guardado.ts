import {
  presupuestoEsIncompleto,
  type PresupuestoCompletitudInput,
} from '@/lib/presupuestos/completitud'

export type ModoGuardadoPresupuesto = 'borrador' | 'finalizar'

/** Estado persistido tras guardar (POST/PATCH). */
export function resolverEstadoTrasGuardado(
  modo: ModoGuardadoPresupuesto,
  completitud: PresupuestoCompletitudInput,
  estadoActual?: string,
): 'BORRADOR' | 'ENVIADO' {
  if (modo === 'borrador') {
    if (estadoActual && estadoActual !== 'BORRADOR') {
      return estadoActual as 'ENVIADO'
    }
    return 'BORRADOR'
  }
  if (presupuestoEsIncompleto(completitud)) return 'BORRADOR'
  return 'ENVIADO'
}

export function debeNotificarClienteEnviado(
  modo: ModoGuardadoPresupuesto,
  estadoAnterior: string,
  estadoNuevo: string,
): boolean {
  return (
    modo === 'finalizar' &&
    estadoNuevo === 'ENVIADO' &&
    estadoAnterior !== 'ENVIADO'
  )
}
