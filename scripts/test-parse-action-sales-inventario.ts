/**
 * Verifica parseo del catálogo Action Sales (788 productos, 9 columnas).
 */
import fs from 'fs'
import path from 'path'
import { ACTION_SALES_HEADERS, parsearInventarioWorkbook } from '../lib/inventario-excel'

const errors: string[] = []

function pass(msg: string) {
  console.log('✅', msg)
}

function fail(msg: string) {
  errors.push(msg)
  console.error('❌', msg)
}

function main() {
  console.log('\n=== Test parseo Action Sales inventario ===\n')

  const filePath = path.join(__dirname, 'fixtures', 'action-sales-catalogo.xlsx')
  if (!fs.existsSync(filePath)) {
    fail(`Fixture no encontrado: ${filePath}`)
    process.exit(1)
  }

  const buffer = fs.readFileSync(filePath)
  const { productos, formato } = parsearInventarioWorkbook(buffer)

  if (formato === 'action_sales') {
    pass('Detecta formato Action Sales')
  } else {
    fail(`Esperaba action_sales, obtuvo ${formato}`)
  }

  if (productos.length === 788) {
    pass('788 productos parseados')
  } else {
    fail(`Esperaba 788 productos, obtuvo ${productos.length}`)
  }

  const conMarca = productos.filter((p) => p.marca)
  if (conMarca.length > 0) {
    pass(`Extrae marca de descripción adicional (${conMarca.length} con marca)`)
  } else {
    fail('Debería extraer al menos una marca')
  }

  const inhabilitados = productos.filter((p) => p.activo === false)
  if (inhabilitados.length >= 1) {
    pass(`Perfil INHABILITADO → activo false (${inhabilitados.length})`)
  } else {
    fail('Debería marcar INHABILITADO como inactivo')
  }

  const perfiles = new Set(productos.map((p) => p.perfil).filter(Boolean))
  if (perfiles.has('COMPRAS - VENTAS') && perfiles.has('VENTAS')) {
    pass('Conserva perfiles COMPRAS - VENTAS y VENTAS')
  } else {
    fail(`Perfiles inesperados: ${[...perfiles].join(', ')}`)
  }

  if (ACTION_SALES_HEADERS.length === 9) {
    pass('Plantilla define 9 columnas Action Sales')
  } else {
    fail('Headers incorrectos')
  }

  console.log('')
  if (errors.length > 0) {
    console.error(`${errors.length} fallo(s).\n`)
    process.exit(1)
  }
  console.log('OK — parseo Action Sales inventario\n')
}

main()
