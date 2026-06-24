import type { EstadoFactura } from '@prisma/client'
import { ApiError } from '@/lib/api-auth'

/** Facturas que aceptan imputación de cobranza. */
export const ESTADOS_FACTURA_COBRABLE: EstadoFactura[] = ['EMITIDA', 'VENCIDA', 'PENDIENTE']

export function saldoPendienteFactura(total: number, imputaciones: { monto: number }[]): number {
  const pagado = imputaciones.reduce((a, p) => a + Number(p.monto), 0)
  return Math.max(0, Number(total) - pagado)
}

export function validarImputacionesContraFacturas(
  facturas: Array<{
    id: string
    numero: string
    total: number
    estado: EstadoFactura
    pagos: { monto: number }[]
  }>,
  imputaciones: Array<{ facturaId: string; monto: number }>,
) {
  for (const imp of imputaciones) {
    const factura = facturas.find((f) => f.id === imp.facturaId)
    if (!factura) continue

    if (!ESTADOS_FACTURA_COBRABLE.includes(factura.estado)) {
      throw new ApiError(
        400,
        `La factura ${factura.numero} (${factura.estado}) no acepta cobranzas`,
      )
    }

    const saldo = saldoPendienteFactura(factura.total, factura.pagos)
    if (imp.monto > saldo + 0.01) {
      throw new ApiError(
        400,
        `El monto excede el saldo pendiente de ${factura.numero} (${saldo.toFixed(2)})`,
      )
    }
  }
}
