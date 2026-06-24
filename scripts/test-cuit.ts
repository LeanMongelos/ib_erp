/**
 * Tests de validación CUIT (lib/cuit.ts).
 */
import { cuitSoloDigitos, formatearCuit, validarCuit } from '../lib/cuit'

const errors: string[] = []

function pass(msg: string) {
  console.log('✅', msg)
}

function fail(msg: string) {
  errors.push(msg)
  console.error('❌', msg)
}

function main() {
  console.log('\n=== Test validación CUIT ===\n')

  if (validarCuit('30-70902717-0')) {
    pass('CUIT válido 30-70902717-0')
  } else {
    fail('30-70902717-0 debería ser válido')
  }

  if (validarCuit('20-24440827-4')) {
    pass('CUIT válido 20-24440827-4')
  } else {
    fail('20-24440827-4 debería ser válido')
  }

  if (!validarCuit('20-12345678-9')) {
    pass('Rechaza CUIT con dígito verificador incorrecto')
  } else {
    fail('20-12345678-9 debería ser inválido')
  }

  if (!validarCuit('')) {
    pass('Rechaza CUIT vacío')
  } else {
    fail('CUIT vacío debería ser inválido')
  }

  if (formatearCuit('30709027170') === '30-70902717-0') {
    pass('formatearCuit normaliza sin guiones')
  } else {
    fail(`formatearCuit esperado 30-70902717-0, obtuvo ${formatearCuit('30709027170')}`)
  }

  if (cuitSoloDigitos('30-70902717-0') === '30709027170') {
    pass('cuitSoloDigitos elimina guiones')
  } else {
    fail('cuitSoloDigitos falló')
  }

  console.log('')
  if (errors.length > 0) {
    console.error(`${errors.length} fallo(s).\n`)
    process.exit(1)
  }
  console.log('OK — validación CUIT\n')
}

main()
