import { ROLE_PERMISSIONS, tienePermiso } from '../lib/rbac'

const rolesCheques = ['ADMINISTRACION', 'CONTABILIDAD', 'GERENTE', 'FACTURACION'] as const

for (const rol of rolesCheques) {
  const perms = ROLE_PERMISSIONS[rol] ?? []
  if (!tienePermiso(perms, 'cobranzas.cheques.read')) {
    throw new Error(`${rol} debe tener cobranzas.cheques.read`)
  }
  if (!tienePermiso(perms, 'cobranzas.cheques.manage')) {
    throw new Error(`${rol} debe tener cobranzas.cheques.manage`)
  }
}

console.log('✅ permisos cheques OK')
console.log('\nOK — cheques cobranza\n')
