/**
 * Persistencia de clientes importados desde CSV.
 */
import { prisma } from '@/lib/prisma'
import { cuitSoloDigitos } from '@/lib/cuit'
import { parsearCsvClientes, type ClienteImportRow } from '@/lib/clientes/parse-csv-clientes'
import { registrarAuditoria } from '@/lib/audit'

export interface ResultadoImportClientes {
  creados: number
  omitidos: number
  errores: { fila: number; mensaje: string }[]
}

async function cargarCuitsExistentes(): Promise<Map<string, string>> {
  const clientes = await prisma.cliente.findMany({
    where: { cuit: { not: null } },
    select: { id: true, cuit: true },
  })
  const map = new Map<string, string>()
  for (const c of clientes) {
    if (!c.cuit) continue
    map.set(cuitSoloDigitos(c.cuit), c.id)
  }
  return map
}

async function crearClienteImportado(row: ClienteImportRow): Promise<string> {
  const cliente = await prisma.$transaction(async (tx) => {
    const c = await tx.cliente.create({
      data: {
        nombre: row.razonSocial,
        tipo: 'OTRO',
        cuit: row.cuit,
        email: row.email ?? null,
        telefono: row.telefono ?? null,
      },
    })
    await tx.clienteSucursal.create({
      data: {
        clienteId: c.id,
        nombre: 'Sede principal',
        ciudad: 'Formosa',
      },
    })
    return c
  })
  return cliente.id
}

export async function importarClientesCsv(
  contenido: string,
  actorId: string,
): Promise<ResultadoImportClientes> {
  const filas = parsearCsvClientes(contenido)
  const resultado: ResultadoImportClientes = { creados: 0, omitidos: 0, errores: [] }

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
      const id = await crearClienteImportado(fila.datos)
      cuitsExistentes.set(digits, id)
      resultado.creados++
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error al crear cliente'
      resultado.errores.push({ fila: fila.fila, mensaje: msg })
    }
  }

  if (resultado.creados > 0) {
    await registrarAuditoria({
      usuarioId: actorId,
      accion: 'cliente.import_csv',
      entidad: 'Cliente',
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
