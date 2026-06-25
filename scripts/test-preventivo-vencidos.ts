/**
 * Tests puros — regla de vencimiento de planes preventivos (sin BD).
 */
import {
  planDebeMarcarseVencido,
  ESTADOS_PLAN_SUJETOS_VENCIMIENTO,
} from '../lib/mantenimiento/vencimiento'

const errors: string[] = []

function pass(msg: string) {
  console.log('✅', msg)
}

function fail(msg: string) {
  errors.push(msg)
  console.error('❌', msg)
}

function main() {
  console.log('\n=== Test planes preventivos vencidos (lógica pura) ===\n')

  const hoy = new Date('2026-06-24T12:00:00Z')
  const ayer = new Date('2026-06-23T12:00:00Z')
  const manana = new Date('2026-06-25T12:00:00Z')

  if (ESTADOS_PLAN_SUJETOS_VENCIMIENTO.length !== 2) {
    fail('estados sujetos a vencimiento deben ser PROGRAMADO y PENDIENTE')
  } else {
    pass('estados sujetos definidos')
  }

  if (!planDebeMarcarseVencido('PROGRAMADO', ayer, hoy)) {
    fail('PROGRAMADO con fecha pasada debe vencer')
  } else {
    pass('PROGRAMADO vencido por fecha')
  }

  if (!planDebeMarcarseVencido('PENDIENTE', ayer, hoy)) {
    fail('PENDIENTE con fecha pasada debe vencer')
  } else {
    pass('PENDIENTE vencido por fecha')
  }

  if (planDebeMarcarseVencido('PROGRAMADO', manana, hoy)) {
    fail('PROGRAMADO con fecha futura no debe vencer')
  } else {
    pass('PROGRAMADO vigente no vence')
  }

  for (const estado of ['COMPLETADO', 'VENCIDO', 'CANCELADO'] as const) {
    if (planDebeMarcarseVencido(estado, ayer, hoy)) {
      fail(`${estado} con fecha pasada no debe marcarse vencido`)
    } else {
      pass(`${estado} ignorado aunque la fecha pasó`)
    }
  }

  if (planDebeMarcarseVencido('PROGRAMADO', null, hoy)) {
    fail('sin proximoServicio no debe vencer')
  } else {
    pass('sin proximoServicio ignorado')
  }

  console.log('')
  if (errors.length > 0) {
    console.error(`${errors.length} fallo(s).\n`)
    process.exit(1)
  }
  console.log('OK — planes preventivos vencidos\n')
}

main()
