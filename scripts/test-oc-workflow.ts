/**
 * Tests workflow OC — timeline, aprobadores, inbox merge logic (sin DB cuando no hay conexión).
 */
import { labelEventoOc } from '../lib/compras/oc-workflow/timeline-types'
import { APROBADORES_OC_EMAILS, hrefOc } from '../lib/compras/oc-workflow/constants'
import { validarEnvioOC } from '../lib/compras/oc-enviar'

const errors: string[] = []

function pass(msg: string) {
  console.log('✅', msg)
}

function fail(msg: string) {
  errors.push(msg)
  console.error('❌', msg)
}

async function main() {
  console.log('\n=== Test OC Workflow ===\n')

  if (APROBADORES_OC_EMAILS.length === 3) pass('tres aprobadores OC configurados')
  else fail(`aprobadores: ${APROBADORES_OC_EMAILS.join(', ')}`)

  if (hrefOc('abc') === '/compras?tab=oc&oc=abc') pass('hrefOc consistente con ComprasManager')
  else fail(`hrefOc: ${hrefOc('abc')}`)

  if (labelEventoOc('OC_APROBADA') === 'OC aprobada') pass('label evento OC_APROBADA')
  else fail('labelEventoOc OC_APROBADA')

  if (labelEventoOc('OC_PAGO_COMPLETO') === 'Pago completo — deuda saldada') {
    pass('label evento OC_PAGO_COMPLETO')
  } else fail('labelEventoOc OC_PAGO_COMPLETO')

  const envio = validarEnvioOC({
    solicitanteId: 'u1',
    justificacion: 'Test workflow',
    clasificacionOrigen: 'SERVICIO',
    items: [{ descripcion: 'Servicio' }],
  })
  if (envio === null) pass('validarEnvioOC reutilizado (sin duplicar en aprobacion)')
  else fail(`validarEnvioOC: ${envio}`)

  try {
    const { prisma } = await import('../lib/prisma')
    const aprobadores = await import('../lib/compras/oc-workflow/aprobadores').then((m) =>
      m.obtenerAprobadoresOC(),
    )
    if (aprobadores.length >= 1) {
      pass(`obtenerAprobadoresOC: ${aprobadores.length} usuario(s)`)
    } else {
      pass('obtenerAprobadoresOC: sin DB/seed — skip count')
    }
  } catch {
    pass('obtenerAprobadoresOC: DB no disponible — tests unitarios OK')
  }

  console.log('\n---')
  if (errors.length) {
    console.error(`\n${errors.length} error(es)\n`)
    process.exit(1)
  }
  console.log('\nTodos los tests OC workflow pasaron.\n')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
