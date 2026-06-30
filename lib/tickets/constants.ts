import type { AreaTicket, EstadoTicket, TipoTicket } from '@prisma/client'

export const TIPOS_TICKET: { value: TipoTicket; label: string }[] = [
  { value: 'ERROR_SISTEMA', label: 'Error del sistema' },
  { value: 'CORRECCION_DATOS', label: 'Corrección de datos' },
  { value: 'MEJORA_ERP', label: 'Mejora del ERP' },
  { value: 'CONSULTA', label: 'Consulta operativa' },
  { value: 'OTRO', label: 'Otro' },
]

export const AREAS_TICKET: { value: AreaTicket; label: string }[] = [
  { value: 'ADMINISTRACION', label: 'Administración' },
  { value: 'GERENCIA', label: 'Gerencia' },
  { value: 'SERVICIO_TECNICO', label: 'Servicio técnico' },
  { value: 'VENTAS', label: 'Ventas' },
  { value: 'FACTURACION', label: 'Facturación' },
  { value: 'CONTABILIDAD', label: 'Contabilidad' },
  { value: 'DESARROLLO', label: 'Desarrollo / IT' },
]

export const ESTADOS_TICKET: { value: EstadoTicket; label: string }[] = [
  { value: 'ABIERTA', label: 'Abierta' },
  { value: 'EN_REVISION', label: 'En revisión' },
  { value: 'EN_PROGRESO', label: 'En progreso' },
  { value: 'ESPERANDO_INFO', label: 'Esperando info' },
  { value: 'RESUELTA', label: 'Resuelta' },
  { value: 'CERRADA', label: 'Cerrada' },
  { value: 'CANCELADA', label: 'Cancelada' },
]

export function labelTipoTicket(tipo: TipoTicket): string {
  return TIPOS_TICKET.find((t) => t.value === tipo)?.label ?? tipo
}

export function labelAreaTicket(area: AreaTicket): string {
  return AREAS_TICKET.find((a) => a.value === area)?.label ?? area
}

export function labelEstadoTicket(estado: EstadoTicket): string {
  return ESTADOS_TICKET.find((e) => e.value === estado)?.label ?? estado
}

/** Área de origen sugerida según rol RBAC principal. */
export function areaDesdeRol(rol: string): AreaTicket {
  const map: Record<string, AreaTicket> = {
    GERENTE: 'GERENCIA',
    ADMINISTRACION: 'ADMINISTRACION',
    VENTAS: 'VENTAS',
    FACTURACION: 'FACTURACION',
    CONTABILIDAD: 'CONTABILIDAD',
    TECNICO: 'SERVICIO_TECNICO',
    SUPERADMIN: 'DESARROLLO',
  }
  return map[rol] ?? 'ADMINISTRACION'
}
