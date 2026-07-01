/**
 * Importes WSFEv1 según tipo de comprobante (A discrimina IVA; B/C no).
 * AFIP 10018: si ImpIVA = 0, el array Iva debe usar Id 3 (alícuota 0%).
 */

export type ImportesWsfe = {
  ImpTotal: number
  ImpTotConc: number
  ImpNeto: number
  ImpOpEx: number
  ImpIVA: number
  ImpTrib: number
  Iva: Array<{ Id: number; BaseImp: number; Importe: number }>
}

/** WSFE — códigos de alícuota IVA */
export function alicuotaAfipId(porcentaje: number): number {
  if (porcentaje <= 0) return 3
  if (porcentaje <= 10.5) return 4
  if (porcentaje <= 21) return 5
  return 6
}

export function buildImportesWsfe(params: {
  tipo: string
  subtotal: number
  iva: number
  total: number
}): ImportesWsfe {
  const subtotal = Number(params.subtotal)
  const iva = Number(params.iva)
  const total = Number(params.total)
  const tipo = params.tipo.toUpperCase()

  // Factura / NC B y C: IVA no discriminado ante AFIP (ImpIVA = 0, Id 3).
  if (tipo === 'B' || tipo === 'C') {
    const base = total
    return {
      ImpTotal: base,
      ImpTotConc: 0,
      ImpNeto: base,
      ImpOpEx: 0,
      ImpIVA: 0,
      ImpTrib: 0,
      Iva: [{ Id: 3, BaseImp: base, Importe: 0 }],
    }
  }

  // Factura / NC A: discrimina IVA.
  const pct = subtotal > 0 ? (iva / subtotal) * 100 : 21
  const idIva = alicuotaAfipId(pct)
  return {
    ImpTotal: total,
    ImpTotConc: 0,
    ImpNeto: subtotal,
    ImpOpEx: 0,
    ImpIVA: iva,
    ImpTrib: 0,
    Iva: [{ Id: idIva, BaseImp: subtotal, Importe: iva }],
  }
}
