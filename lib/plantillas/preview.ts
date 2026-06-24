import type { PlantillaConfig } from './types'
import { PLANTILLA_DEFAULT_POR_TIPO } from './defaults'
import { datosEjemploPlantilla } from './sample-datos'
import { renderDocumentoPDF } from './render-documento'
import { resolverPlantillaDocumento, prepararConfigRender } from './resolver-plantilla'

export async function renderPreviewPlantilla(cfg: PlantillaConfig): Promise<Buffer> {
  const tipo = cfg.tipo
  if (tipo !== 'FACTURA' && tipo !== 'PRESUPUESTO' && tipo !== 'REMITO') {
    throw new Error('Tipo de plantilla no soportado para vista previa')
  }
  const cfgNorm = prepararConfigRender(cfg, tipo)
  const datos = datosEjemploPlantilla(tipo)
  // Mismo pipeline que facturación (layout → HTML → react-pdf)
  return renderDocumentoPDF(cfgNorm, datos)
}

export function configDefaultPorTipo(tipo: 'FACTURA' | 'PRESUPUESTO' | 'REMITO'): PlantillaConfig {
  return PLANTILLA_DEFAULT_POR_TIPO[tipo]
}
