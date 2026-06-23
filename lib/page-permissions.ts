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
