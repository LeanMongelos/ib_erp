/**
 * Persistencia de proveedores importados desde CSV.
 */
import { prisma } from '@/lib/prisma'
import { cuitSoloDigitos } from '@/lib/cuit'
import { parsearCsvProveedores, type ProveedorImportRow } from '@/lib/proveedores/parse-csv-proveedores'
import { registrarAuditoria } from '@/lib/audit'

export interface ResultadoImportProveedores {
  creados: number
  omitidos: number
  errores: { fila: number; mensaje: string }[]
}

async function cargarCuitsExistentes(): Promise<Map<string, string>> {
  const proveedores = await prisma.proveedor.findMany({
    where: { cuit: { not: null } },
    select: { id: true, cuit: true },
  })
  const map = new Map<string, string>()
  for (const p of proveedores) {
    if (!p.cuit) continue
    map.set(cuitSoloDigitos(p.cuit), p.id)
  }
  return map
}

async function crearProveedorImportado(row: ProveedorImportRow): Promise<string> {
  const proveedor = await prisma.proveedor.create({
    data: {
      razonSocial: row.razonSocial,
      cuit: row.cuit,
      email: row.email ?? null,
    },
  })
  return proveedor.id
}

export async function importarProveedoresCsv(
  contenido: string,
  actorId: string,
): Promise<ResultadoImportProveedores> {
  const filas = parsearCsvProveedores(contenido)
  const resultado: ResultadoImportProveedores = { creados: 0, omitidos: 0, errores: [] }

  if (filas.length === 1 && filas[0]?.error && !filas[0]?.datos) {
    resultado.errores.push({ fila: filas[0].fila, mensaje: filas[0].error! })
    return resultado
  }

  const cuitsExistentes = await cargarCuitsExistentes()
  const cuitsEnArchivo = new Set<string>()

  for (const fila of filas) {
    if (fila.error || !fila.datos) {
      if (fila.error) resultado.errores.push({ fila: fila.fila, mensaje: fila.error })
      continue
    }

    const digits = cuitSoloDigitos(fila.datos.cuit)

    if (cuitsEnArchivo.has(digits)) {
      resultado.omitidos++
      resultado.errores.push({ fila: fila.fila, mensaje: `CUIT duplicado en el archivo: ${fila.datos.cuit}` })
      continue
    }
    cuitsEnArchivo.add(digits)

    if (cuitsExistentes.has(digits)) {
      resultado.omitidos++
      continue
    }

    try {
      const id = await crearProveedorImportado(fila.datos)
      cuitsExistentes.set(digits, id)
      resultado.creados++
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error al crear proveedor'
      resultado.errores.push({ fila: fila.fila, mensaje: msg })
    }
  }

  if (resultado.creados > 0) {
    await registrarAuditoria({
      usuarioId: actorId,
      accion: 'proveedor.import_csv',
      entidad: 'Proveedor',
      entidadId: 'bulk',
      despues: {
        creados: resultado.creados,
        omitidos: resultado.omitidos,
        errores: resultado.errores.length,
      },
    }).catch(() => null)
  }

  return resultado
}
