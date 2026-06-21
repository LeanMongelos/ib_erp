import type { PlantillaConfig } from './types'
import { LAYOUT_PRESUPUESTO_IB } from './layout-default-presupuesto'

/** Asegura que la config tenga layout de bloques (migración suave desde legacy). */
export function ensureLayout(cfg: PlantillaConfig): PlantillaConfig {
  if (cfg.layout?.elementos?.length) return cfg
  if (cfg.tipo === 'PRESUPUESTO') {
    return { ...cfg, layout: structuredClone(LAYOUT_PRESUPUESTO_IB) }
  }
  return cfg
}

export function configConLayout(cfg: PlantillaConfig): PlantillaConfig {
  return ensureLayout(cfg)
}
