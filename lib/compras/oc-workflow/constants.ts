/** Aprobadores OC — alineado al seed de producción. */
export const APROBADORES_OC_EMAILS = [
  'cesar@ib.com',
  'guillermo@ib.com',
  'lucas@ib.com',
] as const

export function hrefOc(ordenCompraId: string): string {
  return `/compras?tab=oc&oc=${ordenCompraId}`
}
