/**
 * Auditoría de permisos críticos por rol — lógica pura (sin BD).
 * Fuente de verdad: lib/rbac.ts → ROLE_PERMISSIONS.
 */
import { ROLE_DEFS, ROLE_PERMISSIONS, WILDCARD, tienePermiso } from './rbac'

/** Permisos que cada rol operativo debería tener según su función. */
const PERMISOS_CRITICOS: Record<string, string[]> = {
  GERENTE: [
    'perfil.edit_own',
    'clientes.read',
    'facturas.read',
    'facturas.emit_afip',
    'config.read',
    'config.manage_integrations',
    'usuarios.read',
    'auditoria.read',
  ],
  ADMINISTRACION: [
    'perfil.edit_own',
    'clientes.read',
    'clientes.create',
    'facturas.read',
    'facturas.emit_afip',
    'cobranzas.read',
    'cobranzas.cheques.read',
    'cobranzas.cheques.manage',
  ],
  VENTAS: [
    'perfil.edit_own',
    'clientes.read',
    'clientes.create',
    'presupuestos.read',
    'presupuestos.create',
    'crm.read',
  ],
  FACTURACION: [
    'perfil.edit_own',
    'clientes.read',
    'facturas.read',
    'facturas.emit_afip',
    'facturas.create',
    'cobranzas.cheques.read',
    'cobranzas.cheques.manage',
  ],
  CONTABILIDAD: [
    'perfil.edit_own',
    'clientes.read',
    'facturas.read',
    'facturas.emit_afip',
    'cobranzas.read',
    'cobranzas.cheques.read',
    'cobranzas.cheques.manage',
    'config.read',
    'reportes.read_fiscal',
  ],
  TECNICO: [
    'perfil.edit_own',
    'clientes.read',
    'servicio.read',
    'servicio.create',
    'inventario.read',
  ],
}

export interface HallazgoPermiso {
  rol: string
  permiso: string
}

export function auditarPermisosCriticos(): HallazgoPermiso[] {
  const hallazgos: HallazgoPermiso[] = []

  for (const [rol, esperados] of Object.entries(PERMISOS_CRITICOS)) {
    if (!(rol in ROLE_DEFS)) continue
    const asignados = ROLE_PERMISSIONS[rol] ?? []
    if (asignados.includes(WILDCARD)) continue

    for (const permiso of esperados) {
      if (!tienePermiso(asignados, permiso)) {
        hallazgos.push({ rol, permiso })
      }
    }
  }

  return hallazgos
}
