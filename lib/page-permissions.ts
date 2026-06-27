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

/** Permiso mínimo por ruta del menú lateral (OR dentro del array). */
export const NAV_ITEM_PERMISSIONS: Record<string, readonly string[]> = {
  '/dashboard': DASHBOARD_ACCESS_PERMISSIONS,
  '/crm': ['clientes.read', 'crm.read'],
  '/reportes': REPORTES_NAV_PERMISSIONS,
  '/servicio-tecnico': ['servicio.read'],
  '/servicio-tecnico/preventivo': ['preventivo.read'],
  '/inventario': ['inventario.read'],
  '/presupuestos': ['presupuestos.read'],
  '/facturacion': ['facturas.read'],
  '/cobranzas': ['cobranzas.read'],
  '/tesoreria': ['tesoreria.read'],
  '/compras': ['compras.read'],
  '/proveedores': ['proveedores.read'],
  '/automatizaciones': ['config.manage_integrations'],
  '/configuracion': ['config.read'],
}

export function puedeVerNavItem(href: string, permisos: string[] | undefined): boolean {
  if (!permisos?.length) return false
  if (permisos.includes('*')) return true
  const required = NAV_ITEM_PERMISSIONS[href]
  if (!required?.length) return true
  return required.some((p) => permisos.includes(p))
}
