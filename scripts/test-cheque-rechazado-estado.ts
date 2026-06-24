import { resolverEstadoFacturaTrasReversion } from '../lib/cobranzas/estado-factura-cobranza'

if (resolverEstadoFacturaTrasReversion(true) !== 'VENCIDA') {
  throw new Error('Co4: cuota vencida debe marcar VENCIDA')
}
if (resolverEstadoFacturaTrasReversion(false) !== 'EMITIDA') {
  throw new Error('Co4: sin cuota vencida debe marcar EMITIDA')
}

console.log('✅ cheque rechazado → estado factura OK')
console.log('\nOK — Co4 cheque rechazado\n')
