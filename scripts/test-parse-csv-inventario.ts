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
    'sku,nombre,stock,stockMinimo,precio',
    'REP-001,Filtro bacteriano,50,10,1500',
    'REP-002,Sensor SpO2,25,5,',
    'REP-001,Duplicado,1,1,',
    ',Sin SKU,1,1,',
  ].join('\n')

  const filas = parsearCsvInventario(csv)
  const validas = filas.filter((f) => f.datos)
  const conError = filas.filter((f) => f.error)

  if (validas.length === 2) {
    pass('Acepta filas válidas con sku, nombre, stock, stockMinimo')
  } else {
    fail(`Esperaba 2 filas válidas, obtuvo ${validas.length}`)
  }

  if (validas[0]?.datos?.precio === 1500) {
    pass('Parsea precio opcional')
  } else {
    fail('Debería parsear precio')
  }

  if (conError.some((f) => f.error?.includes('duplicado'))) {
    pass('Rechaza SKU duplicado en archivo')
  } else {
    fail('Debería rechazar SKU duplicado')
  }

  const conCodigo = parsearCsvInventario('codigo,nombre,stock,stockMinimo\nABC-1,Producto,10,2')
  if (conCodigo[0]?.datos?.sku === 'ABC-1') {
    pass('Acepta columna codigo como alias de sku')
  } else {
    fail('Debería aceptar columna codigo')
  }

  const sinHeader = parsearCsvInventario('foo,bar\na,b')
  if (sinHeader[0]?.error?.includes('sku')) {
    pass('Exige columna sku o codigo')
  } else {
    fail('Debería fallar sin sku/codigo')
  }

  console.log('')
  if (errors.length > 0) {
    console.error(`${errors.length} fallo(s).\n`)
    process.exit(1)
  }
  console.log('OK — parseo CSV inventario\n')
}

main()
