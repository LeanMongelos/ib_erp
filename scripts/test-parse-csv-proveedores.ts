/**
 * Tests parseo CSV proveedores (lib/proveedores/parse-csv-proveedores.ts).
 */
import { parsearCsvProveedores } from '../lib/proveedores/parse-csv-proveedores'

const errors: string[] = []

function pass(msg: string) {
  console.log('✅', msg)
}

function fail(msg: string) {
  errors.push(msg)
  console.error('❌', msg)
}

function main() {
  console.log('\n=== Test parseo CSV proveedores ===\n')

  const csv = [
    'razonSocial,cuit,email',
    'Proveedor SA,33-70999888-9,ventas@prov.com',
    'Duplicado,33-70999888-9,',
    'Sin CUIT,,',
  ].join('\n')

  const filas = parsearCsvProveedores(csv)
  const validas = filas.filter((f) => f.datos)
  const conError = filas.filter((f) => f.error)

  if (validas.length === 2) {
    pass('Acepta filas con CUIT válido')
  } else {
    fail(`Esperaba 2 filas válidas, obtuvo ${validas.length}`)
  }

  if (conError.length >= 1) {
    pass('Rechaza filas sin CUIT')
  } else {
    fail('Debería rechazar fila sin CUIT')
  }

  const sinHeader = parsearCsvProveedores('foo,bar\na,b')
  if (sinHeader[0]?.error?.includes('Columnas obligatorias')) {
    pass('Exige columnas razonSocial,cuit,email')
  } else {
    fail('Debería fallar sin columnas obligatorias')
  }

  console.log('')
  if (errors.length > 0) {
    console.error(`${errors.length} fallo(s).\n`)
    process.exit(1)
  }
  console.log('OK — parseo CSV proveedores\n')
}

main()
