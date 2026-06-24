/**
 * Tests puros — movimiento embudo UI = API.
 */
import { validarMovimientoEmbudoCliente } from '../lib/crm/embudo-movimiento-client'
import { validateForm } from '../lib/crm/embudo-forms'
import type { FormField } from '../lib/crm/embudo-forms'

const errors: string[] = []

function pass(msg: string) {
  console.log('✅', msg)
}

function fail(msg: string) {
  errors.push(msg)
  console.error('❌', msg)
}

function main() {
  console.log('\n=== Test validación embudo ===\n')

  if (validarMovimientoEmbudoCliente('CONTACTO', 'PROPUESTA', false) === null) {
    fail('salto CONTACTO→PROPUESTA debería rechazarse')
  } else {
    pass('salto de etapa rechazado')
  }

  if (validarMovimientoEmbudoCliente('CONTACTO', 'DOCUMENTACION', false) !== null) {
    fail('CONTACTO→DOCUMENTACION debería ser válido')
  } else {
    pass('avance adyacente OK')
  }

  if (validarMovimientoEmbudoCliente('PROPUESTA', 'CONTACTO', false) !== 'Los retrocesos deben confirmarse con motivo') {
    fail('retroceso sin flag debería exigir confirmación')
  } else {
    pass('retroceso exige confirmación')
  }

  const fields: FormField[] = [
    { name: 'montoPropuesta', label: 'Monto', type: 'number', required: true },
  ]
  if (validateForm(fields, {}) !== 'Completá: Monto') {
    fail('validateForm debería exigir monto')
  } else {
    pass('validateForm campos requeridos')
  }

  console.log('')
  if (errors.length > 0) {
    console.error(`${errors.length} fallo(s).\n`)
    process.exit(1)
  }
  console.log('OK — validación embudo\n')
}

main()
