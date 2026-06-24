/** Cambio a ambiente PRODUCCION exige confirmación explícita del operador. */

export function requiereConfirmacionProduccion(
  ambienteNuevo: string | undefined,
  ambienteAnterior?: string | null,
): boolean {
  return ambienteNuevo === 'PRODUCCION' && ambienteAnterior !== 'PRODUCCION'
}

export function validarConfirmacionProduccion(
  ambienteNuevo: string | undefined,
  ambienteAnterior?: string | null,
  confirmar?: boolean,
): string | null {
  if (requiereConfirmacionProduccion(ambienteNuevo, ambienteAnterior) && !confirmar) {
    return 'Confirmá que los certificados AFIP están cargados y el punto de venta verificado antes de activar Producción.'
  }
  return null
}
