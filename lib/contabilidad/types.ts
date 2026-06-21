/** Tipos del ecosistema contable — serializables cliente/servidor. */

export interface ContabilidadResumen {
  config: Record<string, unknown> | null
  alicuotas: AlicuotaRow[]
  condicionesIva: CondicionIvaRow[]
  jurisdicciones: JurisdiccionRow[]
  regimenes: RegimenRow[]
  condicionesPago: CondicionPagoRow[]
  planCuentas: PlanCuentaRow[]
  ejercicios: EjercicioRow[]
  comprobantesAfip: ComprobanteAfipRow[]
  tiposDocumento: TipoDocumentoRow[]
}

export interface AlicuotaRow {
  id: string
  codigo: string
  nombre: string
  porcentaje: number
  activo: boolean
  esPredeterminada: boolean
}

export interface CondicionIvaRow {
  id: string
  codigo: string
  nombre: string
  descripcion?: string | null
  requiereCuit: boolean
  esDefault?: boolean
  alicuotaIva?: { porcentaje: number } | null
}

export interface JurisdiccionRow {
  id: string
  codigo: string
  nombre: string
  provincia: string
  alicuotaGeneral: number | null
  convenioMultilateral: boolean
}

export interface RegimenRow {
  id: string
  codigo: string
  nombre: string
  tipo: string
  alicuota: number
  minimoNoImponible: number
  activo: boolean
  jurisdiccion?: { nombre: string } | null
}

export interface CondicionPagoRow {
  id: string
  codigo: string
  nombre: string
  diasPlazo: number
  plazosCobranza?: string | null
  esDefault?: boolean
}

export interface PlanCuentaRow {
  id: string
  codigo: string
  nombre: string
  tipo: string
  nivel: number
  aceptaImputacion: boolean
}

export interface EjercicioRow {
  id: string
  nombre: string
  anio: number
  cerrado?: boolean
}

export interface ComprobanteAfipRow {
  id: string
  codigoAfip: number
  letra: string
  descripcion: string
}

export interface TipoDocumentoRow {
  id: string
  codigoAfip: number
  nombre: string
}
