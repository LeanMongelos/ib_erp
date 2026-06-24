/**
 * CLI: auditoría de permisos críticos por rol — solo reporte, sin cambios en BD.
 */
import { ROLE_DEFS, auditarPermisosCriticos } from '../lib/auditar-permisos'

function main() {
  console.log('\n=== Auditoría permisos críticos (lib/rbac.ts) ===\n')

  const roles = Object.keys(ROLE_DEFS)
  console.log(`Roles definidos: ${roles.join(', ')}\n`)

  const hallazgos = auditarPermisosCriticos()

  if (hallazgos.length === 0) {
    console.log('✅ Todos los roles tienen sus permisos críticos según PERMISOS_CRITICOS.\n')
    return
  }

  console.log(`⚠️  ${hallazgos.length} permiso(s) crítico(s) faltante(s):\n`)
  for (const h of hallazgos) {
    console.log(`  • ${h.rol.padEnd(16)} falta ${h.permiso}`)
  }
  console.log('\nRevisá lib/rbac.ts → ROLE_PERMISSIONS o ejecutá reset-role-permisos.ts si la BD divergió.\n')
}

main()
