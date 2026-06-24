import { validarPreAnulacionFactura } from '../lib/facturas/anular'
import { ApiError } from '../lib/api-auth'
import { tipoNotaCreditoAfip, tipoComprobanteFacturaAfip } from '../lib/afip/client'
import { marcarChequeAnulado } from '../lib/cobranzas/cheques'

if (tipoNotaCreditoAfip('B') !== 8) throw new Error('NC B = 8')
if (tipoComprobanteFacturaAfip('A') !== 1) throw new Error('Factura A = 1')

const base = { id: 'f1', numero: 'B-1', cae: null, pagos: [] as { monto: number }[] }

validarPreAnulacionFactura({ ...base, estado: 'BORRADOR' }, { chequesEnCartera: 0, yaTieneNc: false })

let bloqueoPagos = false
try {
  validarPreAnulacionFactura(
    { ...base, estado: 'EMITIDA', pagos: [{ monto: 100 }] },
    { chequesEnCartera: 0, yaTieneNc: false },
  )
} catch (e) {
  bloqueoPagos = e instanceof ApiError
}
if (!bloqueoPagos) throw new Error('debe bloquear cobranzas imputadas')

let bloqueoCheques = false
try {
  validarPreAnulacionFactura(
    { ...base, estado: 'EMITIDA', cae: '123' },
    { chequesEnCartera: 1, yaTieneNc: false },
  )
} catch (e) {
  bloqueoCheques = e instanceof ApiError
}
if (!bloqueoCheques) throw new Error('debe bloquear cheques en cartera')

const nc = validarPreAnulacionFactura(
  { ...base, estado: 'EMITIDA', cae: '123' },
  { chequesEnCartera: 0, yaTieneNc: false },
)
if (!nc.requiereNc) throw new Error('EMITIDA con CAE requiere NC')

if (typeof marcarChequeAnulado !== 'function') throw new Error('marcarChequeAnulado exportada')

console.log('✅ anular factura / NC AFIP OK')
console.log('\nOK — anular factura\n')
