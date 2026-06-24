/**
 * Tests puros — validación moneda USD UI = API.
 */
import {
  MENSAJE_COTIZACION_USD_FALTANTE,
  validarMonedaDocumentoCliente,
} from '../lib/moneda-documento-client'
import { CotizacionUsdFaltanteError } from '../lib/moneda'

const errors: string[] = []

function pass(msg: string) {
  console.log('✅', msg)
}

function fail(msg: string) {
  errors.push(msg)
  console.error('❌', msg)
}

function assertError(label: string, fn: () => string | null, expected: string) {
  const err = fn()
  if (err !== expected) {
    fail(`${label}: esperado «${expected}», obtuvo «${err}»`)
  } else {
    pass(label)
  }
}

function main() {
  console.log('\n=== Test validación moneda documento ===\n')

  assertError('USD sin cotización', () => validarMonedaDocumentoCliente('USD', null), MENSAJE_COTIZACION_USD_FALTANTE)
  assertError('USD cotización 0', () => validarMonedaDocumentoCliente('USD', 0), MENSAJE_COTIZACION_USD_FALTANTE)
  assertError('USD con cotización', () => validarMonedaDocumentoCliente('USD', 1050), null as unknown as string)
  assertError('ARS sin cotización', () => validarMonedaDocumentoCliente('ARS', null), null as unknown as string)

  const apiMsg = new CotizacionUsdFaltanteError().message
  if (apiMsg !== MENSAJE_COTIZACION_USD_FALTANTE) {
    fail(`mensaje API ≠ cliente: «${apiMsg}»`)
  } else {
    pass('mensaje API = cliente')
  }

  console.log('')
  if (errors.length > 0) {
    console.error(`${errors.length} fallo(s).\n`)
    process.exit(1)
  }
  console.log('OK — validación moneda documento\n')
}

main()
