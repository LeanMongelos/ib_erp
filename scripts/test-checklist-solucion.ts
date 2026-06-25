/**
 * Checklist OT embebido en diagnostico — parse/merge roundtrip.
 */
import {
  mergeChecklistIntoDiagnostico,
  parseChecklistFromDiagnostico,
  CHECKLIST_SOLUCION_DEFAULT,
} from '../lib/ots/checklist-solucion'

const errors: string[] = []

function pass(msg: string) {
  console.log('✅', msg)
}

function fail(msg: string) {
  errors.push(msg)
  console.error('❌', msg)
}

function main() {
  console.log('\n=== Test checklist solución OT ===\n')

  const { checklist: defaultList, texto: emptyTexto } = parseChecklistFromDiagnostico(null)
  if (defaultList.length !== CHECKLIST_SOLUCION_DEFAULT.length) {
    fail('default checklist length mismatch')
  } else {
    pass('parse null → default checklist')
  }
  if (emptyTexto !== '') {
    fail('parse null texto should be empty')
  } else {
    pass('parse null → texto vacío')
  }

  const items = [
    { tarea: 'Verificación inicial del equipo', completado: true },
    { tarea: 'Prueba funcional OK', completado: false },
  ]
  const merged = mergeChecklistIntoDiagnostico('Motor reemplazado.', items)
  const parsed = parseChecklistFromDiagnostico(merged)

  if (parsed.texto !== 'Motor reemplazado.') {
    fail(`texto roundtrip: "${parsed.texto}"`)
  } else {
    pass('merge + parse conserva texto diagnóstico')
  }
  if (parsed.checklist.length !== 2 || !parsed.checklist[0].completado) {
    fail('checklist roundtrip corrupto')
  } else {
    pass('merge + parse conserva checklist')
  }

  console.log('')
  if (errors.length > 0) {
    console.error(`${errors.length} fallo(s).\n`)
    process.exit(1)
  }
  console.log('OK — checklist solución OT\n')
}

main()
