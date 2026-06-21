/** Etiquetas UI para tipos de artículo de inventario. */
export const TIPOS_ARTICULO = [
  { value: 'REPUESTO', label: 'Repuesto / insumo' },
  { value: 'CONSUMIBLE', label: 'Consumible' },
  { value: 'ACCESORIO', label: 'Accesorio suelto' },
  { value: 'BATERIA', label: 'Batería suelta' },
  { value: 'EQUIPO', label: 'Equipo (serializado · venta → cliente)' },
] as const

export type TipoArticuloInventarioValue = (typeof TIPOS_ARTICULO)[number]['value']

export const TIPOS_KIT = [
  { value: 'ACCESORIO_ESPECIFICO', label: 'Accesorio específico del equipo' },
  { value: 'ACCESORIO_GENERICO', label: 'Accesorio genérico' },
  { value: 'BATERIA', label: 'Batería incluida' },
  { value: 'COMPONENTE', label: 'Componente (filtro, sensor…)' },
  { value: 'REPUESTO_INCLUIDO', label: 'Repuesto incluido en kit' },
] as const

export const TIPOS_OT = [
  { value: 'CORRECTIVO', label: 'Correctivo' },
  { value: 'PREVENTIVO', label: 'Preventivo' },
  { value: 'INSTALACION', label: 'Instalación' },
  { value: 'CALIBRACION', label: 'Calibración' },
  { value: 'GARANTIA', label: 'Garantía' },
] as const

export function labelTipoArticulo(value: string | null | undefined): string {
  return TIPOS_ARTICULO.find((t) => t.value === value)?.label ?? value ?? '—'
}

export function labelTipoOT(value: string | null | undefined): string {
  return TIPOS_OT.find((t) => t.value === value)?.label ?? value ?? '—'
}
