import { ROLE_PERMISSIONS, tienePermiso } from '../lib/rbac'

const rolesReconcile = ['GERENTE', 'CONTABILIDAD', 'FACTURACION'] as const

for (const rol of rolesReconcile) {
  if (!tienePermiso(ROLE_PERMISSIONS[rol] ?? [], 'cobranzas.reconcile')) {
    throw new Error(`${rol} debe tener cobranzas.reconcile`)
  }
}

console.log('✅ permisos reconcile OK')
console.log('\nOK — revertir pago / reconcile\n')
