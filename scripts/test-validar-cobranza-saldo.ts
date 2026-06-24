import {
  ESTADOS_FACTURA_COBRABLE,
  saldoPendienteFactura,
  validarImputacionesContraFacturas,
} from '../lib/cobranzas/validar-pago'
import { ApiError } from '../lib/api-auth'

if (!ESTADOS_FACTURA_COBRABLE.includes('EMITIDA')) throw new Error('EMITIDA cobrable')
if (saldoPendienteFactura(1000, [{ monto: 400 }]) !== 600) throw new Error('saldo')
if (saldoPendienteFactura(1000, [{ monto: 1000 }]) !== 0) throw new Error('saldo cero')

validarImputacionesContraFacturas(
  [{ id: 'f1', numero: 'B-1', total: 1000, estado: 'EMITIDA', pagos: [{ monto: 200 }] }],
  [{ facturaId: 'f1', monto: 800 }],
)

let rechazo = false
try {
  validarImputacionesContraFacturas(
    [{ id: 'f1', numero: 'B-1', total: 1000, estado: 'EMITIDA', pagos: [] }],
    [{ facturaId: 'f1', monto: 1001 }],
  )
} catch (e) {
  rechazo = e instanceof ApiError && e.status === 400
}
if (!rechazo) throw new Error('debe rechazar sobrepago')

console.log('✅ validar cobranza saldo OK')
console.log('\nOK — cobranza saldo\n')
