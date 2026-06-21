import type { PlantillaConfig } from './types'
import { PLANTILLA_DEFAULT_POR_TIPO } from './defaults'
import { datosEjemploPlantilla } from './sample-datos'
import { renderDocumentoPDF } from './render-documento'

export async function renderPreviewPlantilla(cfg: PlantillaConfig): Promise<Buffer> {
  const tipo = cfg.tipo
  if (tipo !== 'FACTURA' && tipo !== 'PRESUPUESTO' && tipo !== 'REMITO') {
    throw new Error('Tipo de plantilla no soportado para vista previa')
  }
  const datos = datosEjemploPlantilla(tipo)
  return renderDocumentoPDF(cfg, datos)
}

export function configDefaultPorTipo(tipo: 'FACTURA' | 'PRESUPUESTO' | 'REMITO'): PlantillaConfig {
  return PLANTILLA_DEFAULT_POR_TIPO[tipo]
}
