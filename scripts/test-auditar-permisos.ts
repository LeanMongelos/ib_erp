/**
 * Tests auditoría permisos críticos (scripts/auditar-permisos.ts).
 */
import { auditarPermisosCriticos } from '../lib/auditar-permisos'

const errors: string[] = []

function pass(msg: string) {
  console.log('✅', msg)
}

function fail(msg: string) {
  errors.push(msg)
  console.error('❌', msg)
}

function main() {
  console.log('\n=== Test auditoría permisos críticos ===\n')

  const hallazgos = auditarPermisosCriticos()
  if (Array.isArray(hallazgos)) {
    pass('auditarPermisosCriticos devuelve array')
  } else {
    fail('auditarPermisosCriticos debe devolver array')
  }

  for (const h of hallazgos) {
    if (!h.rol || !h.permiso) {
      fail('Cada hallazgo debe tener rol y permiso')
    }
  }
  if (hallazgos.every((h) => h.rol && h.permiso)) {
    pass(`Hallazgos bien formados (${hallazgos.length} faltante(s) reportado(s))`)
  }

  console.log('')
  if (errors.length > 0) {
    console.error(`${errors.length} fallo(s).\n`)
    process.exit(1)
  }
  console.log('OK — auditoría permisos\n')
}

main()
