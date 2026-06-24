/** Permisos mínimos para acceder al panel principal (cualquier rol operativo). */
export const DASHBOARD_ACCESS_PERMISSIONS = [
  'clientes.read',
  'facturas.read',
  'servicio.read',
  'presupuestos.read',
  'inventario.read',
  'cobranzas.read',
  'proveedores.read',
  'crm.read',
  'reportes.read_comercial',
  'reportes.read_financiero',
  'reportes.read_operativo',
  'reportes.read_fiscal',
  'config.read',
] as const

export const REPORTES_ACCESS_PERMISSIONS = [
  'reportes.read_comercial',
  'reportes.read_financiero',
  'reportes.read_operativo',
  'reportes.read_fiscal',
] as const

/** Visibilidad del ítem Reportes en el menú lateral (OR con permisos de módulo). */
export const REPORTES_NAV_PERMISSIONS = [
  ...REPORTES_ACCESS_PERMISSIONS,
  'facturas.read',
  'cobranzas.read',
  'presupuestos.read',
  'servicio.read',
  'inventario.read',
] as const

export const AUDITORIA_EXPORT_PERMISSIONS = ['config.read', 'auditoria.read'] as const

export function puedeAccederReportes(permisos: string[] | undefined): boolean {
  if (!permisos?.length) return false
  if (permisos.includes('*')) return true
  return REPORTES_NAV_PERMISSIONS.some((p) => permisos.includes(p))
}
