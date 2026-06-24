/**
 * Resolución de plantillas de impresión para emisión de documentos.
 * Una sola fuente de verdad: predeterminada en BD → fallback de fábrica.
 */

import { prisma } from '@/lib/prisma'
import type { PlantillaConfig } from './types'
import { PLANTILLA_DEFAULT_POR_TIPO } from './defaults'
import { configConLayout } from './ensure-layout'

export type TipoPlantillaDocumento = 'FACTURA' | 'PRESUPUESTO' | 'REMITO'

export type PlantillaResuelta = {
  id: string | null
  nombre: string | null
  origen: 'explicita' | 'predeterminada' | 'fabrica'
  config: PlantillaConfig
}

/** Normaliza config guardada para render (layout legacy, tipo coherente). */
export function prepararConfigRender(
  cfg: PlantillaConfig,
  tipo: TipoPlantillaDocumento,
): PlantillaConfig {
  return configConLayout({ ...cfg, tipo })
}

async function filaValida(id: string, tipo: TipoPlantillaDocumento) {
  const row = await prisma.plantillaImpresion.findUnique({ where: { id } })
  if (!row?.activo || row.tipo !== tipo) return null
  return row
}

/** ID de plantilla a persistir al crear un documento (snapshot en emisión). */
export async function resolverPlantillaIdEmision(
  tipo: TipoPlantillaDocumento,
  explicitId?: string | null,
): Promise<string | null> {
  if (explicitId) {
    const row = await filaValida(explicitId, tipo)
    if (row) return row.id
  }
  const def = await prisma.plantillaImpresion.findFirst({
    where: { tipo, predeterminado: true, activo: true },
    select: { id: true },
  })
  return def?.id ?? null
}

/** Config + metadatos para generar PDF (misma lógica que emisión). */
export async function resolverPlantillaDocumento(
  tipo: TipoPlantillaDocumento,
  plantillaId?: string | null,
): Promise<PlantillaResuelta> {
  if (plantillaId) {
    const row = await filaValida(plantillaId, tipo)
    if (row) {
      return {
        id: row.id,
        nombre: row.nombre,
        origen: 'explicita',
        config: prepararConfigRender(row.config as unknown as PlantillaConfig, tipo),
      }
    }
  }

  const def = await prisma.plantillaImpresion.findFirst({
    where: { tipo, predeterminado: true, activo: true },
  })
  if (def) {
    return {
      id: def.id,
      nombre: def.nombre,
      origen: 'predeterminada',
      config: prepararConfigRender(def.config as unknown as PlantillaConfig, tipo),
    }
  }

  return {
    id: null,
    nombre: null,
    origen: 'fabrica',
    config: prepararConfigRender(PLANTILLA_DEFAULT_POR_TIPO[tipo], tipo),
  }
}

/** Resumen para UI (pantalla nueva factura, etc.). */
export async function obtenerPlantillaPredeterminadaResumen(tipo: TipoPlantillaDocumento) {
  const res = await resolverPlantillaDocumento(tipo, null)
  return {
    id: res.id,
    nombre: res.nombre ?? `Plantilla de fábrica (${tipo})`,
    origen: res.origen,
  }
}
