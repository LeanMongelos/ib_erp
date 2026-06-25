/**
 * Tests embudo ↔ presupuesto (reglas de movimiento y etapas).
 */
import {
  validarMovimientoEmbudoCliente,
} from '../lib/crm/embudo-movimiento-client'
import { embudoNegocioCreateSchema, etapaEmbudoEnum } from '../lib/validation'

function pass(msg: string) { console.log(`  ✅ ${msg}`) }
function fail(msg: string): never { throw new Error(msg) }

console.log('\n=== Test embudo presupuesto flow ===\n')

if (!etapaEmbudoEnum.options.includes('PERDIDO')) {
  fail('etapaEmbudoEnum debe incluir PERDIDO')
}
pass('etapaEmbudoEnum incluye PERDIDO')

const create = embudoNegocioCreateSchema.parse({
  nombre: 'Test',
  cliente: 'Cliente SA',
  productoServicio: 'Equipo',
  vendedor: 'GA',
})
if (create.etapa !== 'ENTRADA') {
  fail('nuevo negocio debe forzar etapa ENTRADA')
}
pass('create schema fuerza ENTRADA')

if (validarMovimientoEmbudoCliente('SEGUIMIENTO', 'PERDIDO') !== null) {
  fail('debe permitir SEGUIMIENTO → PERDIDO')
}
pass('permite marcar PERDIDO desde seguimiento')

if (validarMovimientoEmbudoCliente('CIERRE', 'PERDIDO') === null) {
  fail('no debe permitir CIERRE → PERDIDO')
}
pass('bloquea CIERRE → PERDIDO')

if (validarMovimientoEmbudoCliente('DOCUMENTACION', 'PROPUESTA') !== null) {
  fail('debe permitir DOCUMENTACION → PROPUESTA')
}
pass('permite DOCUMENTACION → PROPUESTA')

console.log('\n=== OK ===\n')
