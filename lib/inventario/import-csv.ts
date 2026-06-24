/**
 * Persistencia de artículos importados desde CSV simple.
 */
import { registrarAuditoria } from '@/lib/audit'
import { importarFilasInventario } from '@/lib/inventario-import'
import type { InventarioImportRow } from '@/lib/inventario-excel'
import { parsearCsvInventario } from '@/lib/inventario/parse-csv-inventario'

export interface ResultadoImportInventarioCsv {
  creados: number
  actualizados: number
  omitidos: number
  errores: { fila: number; mensaje: string }[]
}

function filaCsvAInventarioRow(datos: {
  sku: string
  nombre: string
  stock: number
  stockMinimo: number
  precio?: number
}): InventarioImportRow {
  return {
    nombre: datos.nombre,
    sku: datos.sku,
    descripcion: null,
    categoria: null,
    tipoArticulo: 'REPUESTO',
    marca: null,
    modelo: null,
    esSerializado: false,
    requierePreventivo: false,
    intervaloPreventivoDias: null,
    stock: datos.stock,
    stockMinimo: datos.stockMinimo,
    stockMaximo: null,
    puntoPedido: null,
    precioUnit: datos.precio ?? null,
    alicuotaIvaPct: null,
  }
}

export async function importarInventarioCsv(
  contenido: string,
  actorId: string,
): Promise<ResultadoImportInventarioCsv> {
  const filas = parsearCsvInventario(contenido)
  const errores: { fila: number; mensaje: string }[] = []
  const filasValidas: InventarioImportRow[] = []

  if (filas.length === 1 && filas[0]?.error && !filas[0]?.datos) {
    return { creados: 0, actualizados: 0, omitidos: 0, errores: [{ fila: filas[0].fila, mensaje: filas[0].error! }] }
  }

  for (const fila of filas) {
    if (fila.error || !fila.datos) {
      if (fila.error) errores.push({ fila: fila.fila, mensaje: fila.error })
      continue
    }
    filasValidas.push(filaCsvAInventarioRow(fila.datos))
  }

  if (filasValidas.length === 0) {
    return { creados: 0, actualizados: 0, omitidos: 0, errores }
  }

  const resultado = await importarFilasInventario(filasValidas, actorId)

  if (resultado.creados > 0 || resultado.actualizados > 0) {
    await registrarAuditoria({
      usuarioId: actorId,
      accion: 'inventario.import_csv',
      entidad: 'Inventario',
      entidadId: 'bulk',
      despues: {
        creados: resultado.creados,
        actualizados: resultado.actualizados,
        errores: errores.length + resultado.errores.length,
      },
    }).catch(() => null)
  }

  return {
    creados: resultado.creados,
    actualizados: resultado.actualizados,
    omitidos: 0,
    errores: [...errores, ...resultado.errores],
  }
}
