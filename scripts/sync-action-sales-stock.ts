/**
 * Alinea stock del inventario ERP con export Action Sales (columna stock / Código).
 *
 * Uso:
 *   npx tsx --env-file=.env scripts/sync-action-sales-stock.ts "ruta/al/archivo.xlsx"
 */
import fs from 'fs'
import path from 'path'
import { parsearInventarioWorkbook } from '../lib/inventario-excel'
import { importarSoloStockFilas } from '../lib/inventario-import'

async function main() {
  const filePath = process.argv[2]
  if (!filePath) {
    console.error('Uso: npx tsx --env-file=.env scripts/sync-action-sales-stock.ts <archivo.xlsx>')
    process.exit(1)
  }

  const resolved = path.resolve(filePath)
  if (!fs.existsSync(resolved)) {
    console.error(`[sync-stock] Archivo no encontrado: ${resolved}`)
    process.exit(1)
  }

  const buffer = fs.readFileSync(resolved)
  const { productos, formato } = parsearInventarioWorkbook(buffer)
  const conStock = productos.filter((p) => p.stock > 0).length

  console.log(`[sync-stock] Archivo: ${resolved}`)
  console.log(`[sync-stock] Formato: ${formato} — ${productos.length} filas (${conStock} con stock > 0)`)

  const resultado = await importarSoloStockFilas(productos)

  console.log(`[sync-stock] Actualizados: ${resultado.actualizados}`)
  console.log(`[sync-stock] Sin cambio: ${resultado.sinCambio ?? 0}`)
  console.log(`[sync-stock] Omitidos (SKU no en ERP): ${resultado.omitidos ?? 0}`)

  if (resultado.errores.length > 0) {
    console.warn(`[sync-stock] Avisos (${resultado.errores.length}):`)
    for (const e of resultado.errores.slice(0, 25)) {
      console.warn(`  Fila ${e.fila}: ${e.mensaje}`)
    }
    if (resultado.errores.length > 25) {
      console.warn(`  ... y ${resultado.errores.length - 25} más`)
    }
  }

  if (resultado.actualizados === 0 && (resultado.sinCambio ?? 0) === 0 && resultado.errores.length > 0) {
    process.exit(1)
  }
}

main().catch((e) => {
  console.error('[sync-stock] ERROR:', e)
  process.exit(1)
})
