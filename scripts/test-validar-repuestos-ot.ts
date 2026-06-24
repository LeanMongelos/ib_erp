/**
 * Tests — validación repuestos OT UI.
 */
import { validarRepuestosOTCliente } from '../lib/ots/repuestos-ot-client'

const errors: string[] = []

function pass(msg: string) {
  console.log('✅', msg)
}

function fail(msg: string) {
  errors.push(msg)
  console.error('❌', msg)
}

function main() {
  console.log('\n=== Test validación repuestos OT ===\n')

  if (validarRepuestosOTCliente([{ descripcion: 'Filtro', cantidad: 1, precioUnit: 100 }]) !== null) {
    fail('repuesto válido rechazado')
  } else {
    pass('repuesto válido')
  }

  if (!validarRepuestosOTCliente([{ descripcion: '', cantidad: 1, precioUnit: 0 }])?.includes('descripción')) {
    fail('descripción vacía debería fallar')
  } else {
    pass('descripción obligatoria')
  }

  if (!validarRepuestosOTCliente([{ descripcion: 'Cable', cantidad: 0, precioUnit: 10 }])?.includes('cantidad')) {
    fail('cantidad 0 debería fallar')
  } else {
    pass('cantidad positiva')
  }

  console.log('')
  if (errors.length > 0) {
    console.error(`${errors.length} fallo(s).\n`)
    process.exit(1)
  }
  console.log('OK — validación repuestos OT\n')
}

main()
