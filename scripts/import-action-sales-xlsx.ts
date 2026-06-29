/**
 * Importa catálogo Action Sales desde Excel (.xlsx).
 *
 * Uso:
 *   npx tsx --env-file=.env scripts/import-action-sales-xlsx.ts
 *   npx tsx --env-file=.env scripts/import-action-sales-xlsx.ts "ruta/al/archivo.xlsx"
 */
import fs from 'fs'
import path from 'path'
import { parsearInventarioWorkbook } from '../lib/inventario-excel'
import { importarFilasInventario } from '../lib/inventario-import'

async function main() {
  const defaultPath = path.join(__dirname, 'fixtures', 'action-sales-catalogo.xlsx')
  const filePath = process.argv[2] ? path.resolve(process.argv[2]) : defaultPath

  if (!fs.existsSync(filePath)) {
    console.error(`[import-action-sales] Archivo no encontrado: ${filePath}`)
    process.exit(1)
  }

  const buffer = fs.readFileSync(filePath)
  const { productos, formato } = parsearInventarioWorkbook(buffer)

  console.log(`[import-action-sales] Archivo: ${filePath}`)
  console.log(`[import-action-sales] Formato detectado: ${formato}`)
  console.log(`[import-action-sales] Productos a importar: ${productos.length}`)

  const resultado = await importarFilasInventario(productos)

  console.log(`[import-action-sales] Creados: ${resultado.creados}`)
  console.log(`[import-action-sales] Actualizados: ${resultado.actualizados}`)
  if (resultado.errores.length > 0) {
    console.warn(`[import-action-sales] Errores (${resultado.errores.length}):`)
    for (const e of resultado.errores.slice(0, 20)) {
      console.warn(`  Fila ${e.fila}: ${e.mensaje}`)
    }
    if (resultado.errores.length > 20) {
      console.warn(`  ... y ${resultado.errores.length - 20} más`)
    }
  }

  if (resultado.creados === 0 && resultado.actualizados === 0 && resultado.errores.length > 0) {
    process.exit(1)
  }
}

main().catch((e) => {
  console.error('[import-action-sales] ERROR:', e)
  process.exit(1)
})
