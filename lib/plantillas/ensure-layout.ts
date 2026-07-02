import type { PlantillaConfig } from './types'

/**
 * Normaliza la config para render. Los documentos de fábrica usan su HTML dedicado
 * (factura/presupuesto/remito). El layout de bloques (editor visual) solo se aplica
 * si la config guardada ya lo trae; no se fuerza uno por tipo.
 */
export function ensureLayout(cfg: PlantillaConfig): PlantillaConfig {
  return cfg
}

export function configConLayout(cfg: PlantillaConfig): PlantillaConfig {
  return ensureLayout(cfg)
}
