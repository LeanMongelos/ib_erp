/**
 * Tests parseo CSV inventario (lib/inventario/parse-csv-inventario.ts).
 */
import { parsearCsvInventario } from '../lib/inventario/parse-csv-inventario'

const errors: string[] = []

function pass(msg: string) {
  console.log('✅', msg)
}

function fail(msg: string) {
  errors.push(msg)
  console.error('❌', msg)
}

function main() {
  console.log('\n=== Test parseo CSV inventario ===\n')

  const csv = [
    'codigoInterno,nombre,stock,stockMinimo,precio',
    'HOE098,Filtro bacteriano,50,10,1500',
    'FIL123,Sensor SpO2,25,5,',
    'HOE098,Duplicado,1,1,',
    ',Sin código,1,1,',
    'BAD1,Inválido,1,1,',
  ].join('\n')

  const filas = parsearCsvInventario(csv)
  const validas = filas.filter((f) => f.datos)
  const conError = filas.filter((f) => f.error)

  if (validas.length === 2) {
    pass('Acepta filas válidas con código interno, nombre, stock, stockMinimo')
  } else {
    fail(`Esperaba 2 filas válidas, obtuvo ${validas.length}`)
  }

  if (validas[0]?.datos?.precio === 1500) {
    pass('Parsea precio opcional')
  } else {
    fail('Debería parsear precio')
  }

  if (conError.some((f) => f.error?.includes('duplicado'))) {
    pass('Rechaza código interno duplicado en archivo')
  } else {
    fail('Debería rechazar código duplicado')
  }

  if (conError.some((f) => f.error?.includes('inválido') || f.error?.includes('Código interno'))) {
    pass('Rechaza código interno con formato inválido')
  } else {
    fail('Debería rechazar formato inválido')
  }

  const conCodigo = parsearCsvInventario('codigo,nombre,stock,stockMinimo\nHOE098,Producto,10,2')
  if (conCodigo[0]?.datos?.sku === 'HOE098') {
    pass('Acepta columna codigo como alias')
  } else {
    fail('Debería aceptar columna codigo')
  }

  const sinHeader = parsearCsvInventario('foo,bar\na,b')
  if (sinHeader[0]?.error?.includes('codigoInterno')) {
    pass('Exige columna codigoInterno (o alias)')
  } else {
    fail('Debería fallar sin columna de código')
  }

  console.log('')
  if (errors.length > 0) {
    console.error(`${errors.length} fallo(s).\n`)
    process.exit(1)
  }
  console.log('OK — parseo CSV inventario\n')
}

main()
