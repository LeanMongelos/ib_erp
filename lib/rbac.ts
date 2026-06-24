/**
 * lib/rbac.ts
 * Catálogo de permisos y mapa Rol → Permisos (RBAC).
 *
 * - `PERMISSIONS`: lista maestra de permisos del sistema (se usa para seedear la
 *   tabla `Permiso` y para la futura UI de edición de la matriz).
 * - `ROLE_PERMISSIONS`: qué permisos trae cada rol base (fuente de verdad para el
 *   seed de `RolPermiso`).
 * - `WILDCARD` (`*`): el rol SUPERADMIN tiene todos los permisos.
 *
 * En runtime, la autorización se resuelve contra el **set de permisos** que viaja
 * en el JWT (resuelto al iniciar sesión). Ver `lib/auth.ts` y `lib/api-auth.ts`.
 */

export const WILDCARD = '*'

export type Permiso = {
  clave: string
  modulo: string
  descripcion: string
}

export const PERMISSIONS: Permiso[] = [
  // Usuarios
  { clave: 'usuarios.read',         modulo: 'usuarios',    descripcion: 'Ver usuarios' },
  { clave: 'usuarios.create',       modulo: 'usuarios',    descripcion: 'Crear usuarios' },
  { clave: 'usuarios.update',       modulo: 'usuarios',    descripcion: 'Editar usuarios' },
  { clave: 'usuarios.deactivate',   modulo: 'usuarios',    descripcion: 'Activar/desactivar usuarios' },
  { clave: 'usuarios.assign_roles', modulo: 'usuarios',    descripcion: 'Asignar roles' },
  // Perfil
  { clave: 'perfil.edit_own',       modulo: 'perfil',      descripcion: 'Editar el propio perfil' },
  // Clientes
  { clave: 'clientes.read',         modulo: 'clientes',    descripcion: 'Ver clientes' },
  { clave: 'clientes.create',       modulo: 'clientes',    descripcion: 'Crear clientes' },
  { clave: 'clientes.update',       modulo: 'clientes',    descripcion: 'Editar clientes' },
  { clave: 'clientes.deactivate',   modulo: 'clientes',    descripcion: 'Dar de baja clientes' },
  { clave: 'clientes.export',       modulo: 'clientes',    descripcion: 'Exportar clientes' },
  // Proveedores
  { clave: 'proveedores.read',      modulo: 'proveedores', descripcion: 'Ver proveedores' },
  { clave: 'proveedores.create',    modulo: 'proveedores', descripcion: 'Crear proveedores' },
  { clave: 'proveedores.update',    modulo: 'proveedores', descripcion: 'Editar proveedores' },
  { clave: 'proveedores.deactivate',modulo: 'proveedores', descripcion: 'Dar de baja proveedores' },
  // Presupuestos
  { clave: 'presupuestos.read',     modulo: 'presupuestos',descripcion: 'Ver presupuestos' },
  { clave: 'presupuestos.create',   modulo: 'presupuestos',descripcion: 'Crear presupuestos' },
  { clave: 'presupuestos.update',   modulo: 'presupuestos',descripcion: 'Editar presupuestos' },
  { clave: 'presupuestos.send',     modulo: 'presupuestos',descripcion: 'Enviar presupuestos' },
  { clave: 'presupuestos.approve',  modulo: 'presupuestos',descripcion: 'Aprobar presupuestos' },
  { clave: 'presupuestos.delete',   modulo: 'presupuestos',descripcion: 'Eliminar presupuestos' },
  // Facturas
  { clave: 'facturas.read',         modulo: 'facturas',    descripcion: 'Ver facturas' },
  { clave: 'facturas.create',       modulo: 'facturas',    descripcion: 'Crear facturas' },
  { clave: 'facturas.emit_afip',    modulo: 'facturas',    descripcion: 'Emitir comprobante en AFIP' },
  { clave: 'facturas.cancel',       modulo: 'facturas',    descripcion: 'Anular facturas' },
  { clave: 'facturas.credit_note',  modulo: 'facturas',    descripcion: 'Emitir notas de crédito/débito' },
  { clave: 'facturas.export',       modulo: 'facturas',    descripcion: 'Exportar facturas' },
  // Cobranzas
  { clave: 'cobranzas.read',            modulo: 'cobranzas', descripcion: 'Ver cobranzas' },
  { clave: 'cobranzas.register_payment',modulo: 'cobranzas', descripcion: 'Registrar pagos' },
  { clave: 'cobranzas.reconcile',       modulo: 'cobranzas', descripcion: 'Conciliar' },
  { clave: 'cobranzas.cheques.read',    modulo: 'cobranzas', descripcion: 'Ver cartera de cheques' },
  { clave: 'cobranzas.cheques.manage',  modulo: 'cobranzas', descripcion: 'Depositar o rechazar cheques' },
  // Inventario
  { clave: 'inventario.read',        modulo: 'inventario', descripcion: 'Ver inventario' },
  { clave: 'inventario.create',      modulo: 'inventario', descripcion: 'Crear ítems' },
  { clave: 'inventario.update',      modulo: 'inventario', descripcion: 'Editar ítems' },
  { clave: 'inventario.adjust_stock',modulo: 'inventario', descripcion: 'Ajustar stock' },
  { clave: 'inventario.transfer',    modulo: 'inventario', descripcion: 'Transferir stock' },
  // Compras
  { clave: 'compras.read',    modulo: 'compras', descripcion: 'Ver órdenes de compra' },
  { clave: 'compras.create',  modulo: 'compras', descripcion: 'Crear órdenes de compra' },
  { clave: 'compras.approve', modulo: 'compras', descripcion: 'Aprobar órdenes de compra' },
  { clave: 'compras.receive', modulo: 'compras', descripcion: 'Recepcionar mercadería' },
  // Servicio técnico
  { clave: 'servicio.read',   modulo: 'servicio', descripcion: 'Ver órdenes de servicio' },
  { clave: 'servicio.create', modulo: 'servicio', descripcion: 'Crear órdenes de servicio' },
  { clave: 'servicio.update', modulo: 'servicio', descripcion: 'Editar órdenes de servicio' },
  { clave: 'servicio.close',  modulo: 'servicio', descripcion: 'Cerrar órdenes de servicio' },
  { clave: 'servicio.assign', modulo: 'servicio', descripcion: 'Asignar técnicos' },
  // Preventivo
  { clave: 'preventivo.read',     modulo: 'preventivo', descripcion: 'Ver mantenimientos' },
  { clave: 'preventivo.schedule', modulo: 'preventivo', descripcion: 'Agendar mantenimientos' },
  { clave: 'preventivo.complete', modulo: 'preventivo', descripcion: 'Completar mantenimientos' },
  // Tracking / mapa (Fase 8)
  { clave: 'tracking.read',   modulo: 'tracking', descripcion: 'Ver mapa y recorridos' },
  { clave: 'tracking.create', modulo: 'tracking', descripcion: 'Registrar eventos de ubicación' },
  // CRM
  { clave: 'crm.read',            modulo: 'crm', descripcion: 'Ver conversaciones' },
  { clave: 'crm.reply',           modulo: 'crm', descripcion: 'Responder mensajes' },
  { clave: 'crm.assign',          modulo: 'crm', descripcion: 'Asignar conversaciones' },
  { clave: 'crm.manage_channels', modulo: 'crm', descripcion: 'Gestionar canales' },
  // Reportes
  { clave: 'reportes.read_comercial',  modulo: 'reportes', descripcion: 'Reportes comerciales' },
  { clave: 'reportes.read_financiero', modulo: 'reportes', descripcion: 'Reportes financieros' },
  { clave: 'reportes.read_operativo',  modulo: 'reportes', descripcion: 'Reportes operativos' },
  { clave: 'reportes.read_fiscal',     modulo: 'reportes', descripcion: 'Reportes fiscales AFIP' },
  // Emisores
  { clave: 'emisores.read',   modulo: 'emisores', descripcion: 'Ver emisores' },
  { clave: 'emisores.create', modulo: 'emisores', descripcion: 'Crear emisores' },
  { clave: 'emisores.update', modulo: 'emisores', descripcion: 'Editar emisores' },
  { clave: 'emisores.delete', modulo: 'emisores', descripcion: 'Eliminar emisores' },
  // Configuración
  { clave: 'config.read',                     modulo: 'config', descripcion: 'Ver configuración' },
  { clave: 'config.update',                   modulo: 'config', descripcion: 'Editar configuración' },
  { clave: 'config.manage_accounting',        modulo: 'config', descripcion: 'Configurar contabilidad y fiscal (Argentina)' },
  { clave: 'config.manage_integrations',      modulo: 'config', descripcion: 'Gestionar integraciones' },
  { clave: 'config.manage_billing_templates', modulo: 'config', descripcion: 'Gestionar plantillas de impresión' },
  // Auditoría
  { clave: 'auditoria.read', modulo: 'auditoria', descripcion: 'Ver auditoría' },
  // Logs del sistema
  { clave: 'logs.read', modulo: 'logs', descripcion: 'Ver logs de errores del sistema' },
  // Listas de precios
  { clave: 'listas_precios.read',   modulo: 'listas_precios', descripcion: 'Ver listas de precios' },
  { clave: 'listas_precios.manage', modulo: 'listas_precios', descripcion: 'Gestionar listas de precios' },
]

export const ROLE_DEFS: Record<string, string> = {
  SUPERADMIN:     'Administrador del sistema',
  GERENTE:        'Gerencia',
  ADMINISTRACION: 'Administración',
  VENTAS:         'Ventas',
  FACTURACION:    'Facturación',
  CONTABILIDAD:   'Contabilidad',
  TECNICO:        'Servicio Técnico',
}

const P = PERMISSIONS.map((p) => p.clave)
const onlyRead = (mod: string) => P.filter((k) => k.startsWith(`${mod}.`) && k.includes('read'))

/** Permisos por rol base. SUPERADMIN usa el comodín `*`. */
export const ROLE_PERMISSIONS: Record<string, string[]> = {
  SUPERADMIN: [WILDCARD],

  GERENTE: [
    'perfil.edit_own',
    'usuarios.read', 'usuarios.create', 'usuarios.update', 'usuarios.deactivate', 'usuarios.assign_roles',
    'clientes.read', 'clientes.create', 'clientes.update', 'clientes.deactivate', 'clientes.export',
    'proveedores.read', 'proveedores.create', 'proveedores.update', 'proveedores.deactivate',
    'presupuestos.read', 'presupuestos.create', 'presupuestos.update', 'presupuestos.send', 'presupuestos.approve', 'presupuestos.delete',
    'facturas.read', 'facturas.create', 'facturas.emit_afip', 'facturas.cancel', 'facturas.credit_note', 'facturas.export',
    'cobranzas.read', 'cobranzas.register_payment', 'cobranzas.reconcile',
    'cobranzas.cheques.read', 'cobranzas.cheques.manage',
    'inventario.read', 'inventario.create', 'inventario.update', 'inventario.adjust_stock', 'inventario.transfer',
    'compras.read', 'compras.create', 'compras.approve', 'compras.receive',
    'servicio.read', 'servicio.create', 'servicio.update', 'servicio.close', 'servicio.assign',
    'preventivo.read', 'preventivo.schedule', 'preventivo.complete',
    'tracking.read', 'tracking.create',
    'crm.read', 'crm.reply', 'crm.assign', 'crm.manage_channels',
    'reportes.read_comercial', 'reportes.read_financiero', 'reportes.read_fiscal', 'reportes.read_operativo', 'reportes.read_fiscal',
    'emisores.read', 'emisores.create', 'emisores.update',
    'config.read',
    'config.manage_accounting',
    'config.manage_billing_templates',
    'config.update',
    'auditoria.read',
    'logs.read',
    'listas_precios.read',
    'listas_precios.manage',
  ],

  ADMINISTRACION: [
    'perfil.edit_own',
    'clientes.read', 'clientes.create', 'clientes.update', 'clientes.deactivate', 'clientes.export',
    'proveedores.read', 'proveedores.create', 'proveedores.update', 'proveedores.deactivate',
    'presupuestos.read', 'presupuestos.create', 'presupuestos.update', 'presupuestos.send', 'presupuestos.approve',
    'facturas.read', 'facturas.create', 'facturas.emit_afip',
    'cobranzas.read', 'cobranzas.register_payment',
    'cobranzas.cheques.read', 'cobranzas.cheques.manage',
    'inventario.read', 'inventario.create', 'inventario.update', 'inventario.adjust_stock',
    'compras.read', 'compras.create', 'compras.approve', 'compras.receive',
    'servicio.read',
    'preventivo.read', 'preventivo.schedule',
    'tracking.read',
    'crm.read', 'crm.reply',
    'reportes.read_comercial', 'reportes.read_financiero', 'reportes.read_fiscal',
    'emisores.read',
  ],

  VENTAS: [
    'perfil.edit_own',
    'clientes.read', 'clientes.create', 'clientes.update',
    ...onlyRead('proveedores'),
    'presupuestos.read', 'presupuestos.create', 'presupuestos.update', 'presupuestos.send',
    'facturas.read', 'facturas.create',
    'inventario.read',
    'listas_precios.read',
    'compras.read', 'compras.create',
    'servicio.read', 'servicio.create', 'servicio.update', 'servicio.assign',
    'preventivo.read', 'preventivo.schedule',
    'tracking.read', 'tracking.create',
    'crm.read', 'crm.reply',
    'reportes.read_comercial',
  ],

  FACTURACION: [
    'perfil.edit_own',
    'clientes.read',
    'presupuestos.read',
    'facturas.read', 'facturas.create', 'facturas.emit_afip', 'facturas.cancel', 'facturas.credit_note', 'facturas.export',
    'listas_precios.read',
    'cobranzas.read', 'cobranzas.register_payment', 'cobranzas.reconcile',
    'cobranzas.cheques.read', 'cobranzas.cheques.manage',
    'crm.read', 'crm.reply',
    'reportes.read_financiero', 'reportes.read_fiscal',
    'emisores.read',
  ],

  CONTABILIDAD: [
    'perfil.edit_own',
    'clientes.read',
    ...onlyRead('proveedores'),
    'facturas.read', 'facturas.emit_afip', 'facturas.cancel', 'facturas.export',
    'cobranzas.read', 'cobranzas.register_payment', 'cobranzas.reconcile',
    'cobranzas.cheques.read', 'cobranzas.cheques.manage',
    'compras.read', 'compras.approve',
    'reportes.read_financiero', 'reportes.read_fiscal',
    'emisores.read', 'emisores.create', 'emisores.update',
    'config.read', 'config.manage_accounting', 'config.update',
  ],

  TECNICO: [
    'perfil.edit_own',
    'clientes.read',
    ...onlyRead('proveedores'),
    'presupuestos.read', 'presupuestos.create',
    'inventario.read', 'inventario.create', 'inventario.update', 'inventario.adjust_stock',
    'compras.read', 'compras.create',
    'servicio.read', 'servicio.create', 'servicio.update', 'servicio.close', 'servicio.assign',
    'preventivo.read', 'preventivo.schedule', 'preventivo.complete',
    'tracking.read', 'tracking.create',
    'crm.read', 'crm.reply',
  ],
}

/** ¿El set de permisos incluye la clave pedida? Soporta el comodín `*`. */
export function tienePermiso(permisos: string[] | undefined, clave: string): boolean {
  if (!permisos) return false
  return permisos.includes(WILDCARD) || permisos.includes(clave)
}

/** Resuelve el set de permisos (deduplicado) a partir de una lista de roles. */
export function permisosDeRoles(roles: string[]): string[] {
  if (roles.includes('SUPERADMIN')) return [WILDCARD]
  const set = new Set<string>()
  for (const rol of roles) {
    for (const p of ROLE_PERMISSIONS[rol] ?? []) set.add(p)
  }
  return Array.from(set)
}
