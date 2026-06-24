/**
 * Schema n8n OT alineado con otCreateSchema.
 */
import { otCreateSchema, otN8nCreateSchema } from '../lib/validation'

const errors: string[] = []

function pass(msg: string) {
  console.log('✅', msg)
}

function fail(msg: string) {
  errors.push(msg)
  console.error('❌', msg)
}

function main() {
  console.log('\n=== Test schema n8n OT ===\n')

  const parsed = otN8nCreateSchema.parse({
    clienteId: 'cli-1',
    descripcion: 'Falla monitor UCI',
    equipoId: 'eq-1',
    prioridad: 'ALTA',
    slaHoras: 48,
    conversacionId: 'conv-1',
  })

  if (parsed.tipo !== 'CORRECTIVO') {
    fail(`tipo default debería ser CORRECTIVO, obtuvo ${parsed.tipo}`)
  } else {
    pass('tipo default CORRECTIVO')
  }

  const ui = otCreateSchema.parse({
    descripcion: 'Falla monitor UCI',
    clienteId: 'cli-1',
    equipoId: 'eq-1',
    prioridad: 'ALTA',
    slaHoras: 48,
  })

  if (ui.prioridad !== parsed.prioridad || ui.slaHoras !== parsed.slaHoras) {
    fail('n8n y UI difieren en campos compartidos')
  } else {
    pass('n8n y UI comparten reglas de otCreateSchema')
  }

  console.log('')
  if (errors.length > 0) {
    console.error(`${errors.length} fallo(s).\n`)
    process.exit(1)
  }
  console.log('OK — schema n8n OT\n')
}

main()
