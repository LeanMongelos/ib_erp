/**
 * Tests parseo CSV clientes (lib/clientes/parse-csv-clientes.ts).
 */
import { parsearCsvClientes, parsearLineaCsv } from '../lib/clientes/parse-csv-clientes'

const errors: string[] = []

function pass(msg: string) {
  console.log('✅', msg)
}

function fail(msg: string) {
  errors.push(msg)
  console.error('❌', msg)
}

function main() {
  console.log('\n=== Test parseo CSV clientes ===\n')

  const linea = parsearLineaCsv('"Clínica SA",33-70999888-9,mail@test.com,3704')
  if (linea.length === 4 && linea[0] === 'Clínica SA') {
    pass('parsearLineaCsv respeta comillas')
  } else {
    fail('parsearLineaCsv con comillas falló')
  }

  const csv = [
    'razonSocial,cuit,email,telefono',
    'Hospital Norte,33-70999888-9,admin@hospital.com,3704123456',
    'Duplicado,33-70999888-9,,',
    'Sin CUIT,,,',
    'Nombre corto,X,,',
  ].join('\n')

  const filas = parsearCsvClientes(csv)
  const validas = filas.filter((f) => f.datos)
  const conError = filas.filter((f) => f.error)

  if (validas.length === 2) {
    pass('Acepta filas con CUIT válido (dedupe es en import, no en parser)')
  } else {
    fail(`Esperaba 2 filas válidas, obtuvo ${validas.length}`)
  }

  if (conError.length >= 2) {
    pass('Rechaza filas sin CUIT o CUIT inválido')
  } else {
    fail(`Esperaba al menos 2 errores, obtuvo ${conError.length}`)
  }

  const sinHeader = parsearCsvClientes('foo,bar\na,b')
  if (sinHeader[0]?.error?.includes('Columnas obligatorias')) {
    pass('Exige columnas razonSocial,cuit,email,telefono')
  } else {
    fail('Debería fallar sin columnas obligatorias')
  }

  console.log('')
  if (errors.length > 0) {
    console.error(`${errors.length} fallo(s).\n`)
    process.exit(1)
  }
  console.log('OK — parseo CSV clientes\n')
}

main()
