/** Si true, exige constatación AFIP OK antes de registrar FC. Default false (MVP). */
export function requiereConstatacionParaRegistrar(): boolean {
  return process.env.COMPRAS_REQUIERE_CONSTATACION === 'true'
}
