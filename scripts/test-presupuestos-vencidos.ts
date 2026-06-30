/**
 * Tests puros — regla de vencimiento de presupuestos (sin BD).
 */
import {
  presupuestoDebeMarcarseVencido,
  ESTADOS_PRESUPUESTO_SUJETOS_VENCIMIENTO,
} from '../lib/presupuestos/vencimiento'
import {
  estadoPresupuestoParaUi,
  presupuestoEsIncompleto,
} from '../lib/presupuestos/completitud'

const errors: string[] = []

function pass(msg: string) {
  console.log('✅', msg)
}

function fail(msg: string) {
  errors.push(msg)
  console.error('❌', msg)
}

function main() {
  console.log('\n=== Test presupuestos vencidos (lógica pura) ===\n')

  const ahora = new Date('2026-06-24T12:00:00Z')
  const ayer = new Date('2026-06-23T12:00:00Z')
  const manana = new Date('2026-06-25T12:00:00Z')

  if (ESTADOS_PRESUPUESTO_SUJETOS_VENCIMIENTO.length !== 2) {
    fail('estados sujetos a vencimiento deben ser ENVIADO y APROBADO')
  } else {
    pass('estados sujetos definidos')
  }

  if (!presupuestoDebeMarcarseVencido('ENVIADO', ayer, ahora)) {
    fail('ENVIADO con fecha pasada debe vencer')
  } else {
    pass('ENVIADO vencido por fecha')
  }

  if (!presupuestoDebeMarcarseVencido('APROBADO', ayer, ahora)) {
    fail('APROBADO con fecha pasada debe vencer')
  } else {
    pass('APROBADO vencido por fecha')
  }

  if (presupuestoDebeMarcarseVencido('ENVIADO', manana, ahora)) {
    fail('ENVIADO con fecha futura no debe vencer')
  } else {
    pass('ENVIADO vigente no vence')
  }

  if (presupuestoDebeMarcarseVencido('APROBADO', manana, ahora)) {
    fail('APROBADO con fecha futura no debe vencer')
  } else {
    pass('APROBADO vigente no vence')
  }

  for (const estado of ['BORRADOR', 'VENCIDO', 'RECHAZADO', 'FACTURADO'] as const) {
    if (presupuestoDebeMarcarseVencido(estado, ayer, ahora)) {
      fail(`${estado} con fecha pasada no debe marcarse vencido`)
    } else {
      pass(`${estado} ignorado aunque la fecha pasó`)
    }
  }

  // Idempotencia lógica: ya VENCIDO no entra en el criterio
  if (presupuestoDebeMarcarseVencido('VENCIDO', ayer, ahora)) {
    fail('VENCIDO no debe re-procesarse')
  }

  const completo = {
    estado: 'BORRADOR',
    total: 1000,
    clienteId: 'c1',
    items: [{ descripcion: 'Monitor', cantidad: 1, precioUnit: 1000 }],
  }
  if (presupuestoEsIncompleto(completo)) fail('presupuesto completo no es incompleto')
  else pass('borrador completo detectado')

  if (estadoPresupuestoParaUi(completo) !== 'ENVIADO') fail('borrador completo → UI Pendiente')
  else pass('borrador completo muestra Pendiente')

  if (estadoPresupuestoParaUi({ ...completo, estado: 'ENVIADO', fechaVencimiento: ayer }) !== 'VENCIDO') {
    fail('ENVIADO vencido → UI Vencido')
  } else pass('ENVIADO vencido en UI')

  if (!presupuestoEsIncompleto({ estado: 'BORRADOR', total: 0, clienteId: 'c1', items: [] })) {
    fail('sin ítems debe ser incompleto')
  } else pass('sin ítems = borrador incompleto')

  console.log('')
  if (errors.length > 0) {
    console.error(`${errors.length} fallo(s).\n`)
    process.exit(1)
  }
  console.log('OK — presupuestos vencidos\n')
}

main()
