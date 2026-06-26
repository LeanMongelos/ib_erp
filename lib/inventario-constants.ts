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

export const MODOS_TRAZABILIDAD = [
  { value: 'NINGUNA', label: 'Sin trazabilidad por unidad' },
  { value: 'SERIE', label: 'Por número de serie' },
  { value: 'LOTE', label: 'Por lote' },
  { value: 'SERIE_Y_LOTE', label: 'Serie y lote' },
] as const

export const ESTADOS_UNIDAD_INVENTARIO = [
  { value: 'EN_STOCK', label: 'En stock' },
  { value: 'RESERVADO', label: 'Reservado' },
  { value: 'VENDIDO', label: 'Vendido' },
  { value: 'BAJA', label: 'Baja' },
] as const

export const ORIGEN_EQUIPO_LABEL: Record<string, string> = {
  VENTA: 'Venta',
  EXTERNO: 'Externo',
  MANUAL_ST: 'Alta ST',
}

export const TIPOS_DEPOSITO = [
  { value: 'DEPOSITO', label: 'Depósito' },
  { value: 'SHOWROOM', label: 'Showroom' },
  { value: 'CAJA', label: 'Caja / mostrador' },
  { value: 'OTRO', label: 'Otro' },
] as const

export function labelOrigenEquipo(value: string | null | undefined): string {
  return ORIGEN_EQUIPO_LABEL[value ?? ''] ?? value ?? '—'
}

export function labelTipoDeposito(value: string | null | undefined): string {
  return TIPOS_DEPOSITO.find((t) => t.value === value)?.label ?? value ?? '—'
}
