/**
 * Schemas embudo CRM alineados con lib/validation.ts y rutas /api/crm/embudo/*.
 */
import {
  embudoNegocioCreateSchema,
  embudoNegocioPatchSchema,
  embudoMoverSchema,
  etapaEmbudoEnum,
  urgenciaEmbudoEnum,
} from '../lib/validation'

const errors: string[] = []

function pass(msg: string) {
  console.log('✅', msg)
}

function fail(msg: string) {
  errors.push(msg)
  console.error('❌', msg)
}

function main() {
  console.log('\n=== Test schemas CRM embudo ===\n')

  const create = embudoNegocioCreateSchema.parse({
    nombre: 'Monitor Philips',
    cliente: 'Hospital Central',
    clienteId: 'cli-1',
    productoServicio: 'Monitor multiparamétrico',
    inventarioId: 'inv-1',
    monto: 150000,
    vendedor: 'GA',
    urgencia: 'URGENTE',
    notas: 'Demo',
  })

  if (create.urgencia !== 'URGENTE' || create.etapa !== 'ENTRADA') {
    fail('embudoNegocioCreateSchema debe forzar etapa ENTRADA')
  } else {
    pass('embudoNegocioCreateSchema acepta payload completo')
  }

  embudoNegocioCreateSchema.parse({
    nombre: 'Lead nuevo',
    cliente: 'Clínica Norte',
    productoServicio: 'Servicio técnico',
    vendedor: 'LB',
  })
  pass('embudoNegocioCreateSchema acepta campos mínimos')

  try {
    embudoNegocioCreateSchema.parse({
      nombre: 'X',
      cliente: '',
      productoServicio: 'A',
      vendedor: 'GA',
    })
    fail('create con cliente vacío debería fallar')
  } catch {
    pass('embudoNegocioCreateSchema rechaza cliente vacío')
  }

  const patch = embudoNegocioPatchSchema.parse({
    monto: 200000,
    proximaAccionFecha: '2026-07-01',
  })
  if (patch.monto !== 200000) {
    fail('embudoNegocioPatchSchema no parseó monto')
  } else {
    pass('embudoNegocioPatchSchema PATCH parcial OK')
  }

  const mover = embudoMoverSchema.parse({
    etapaHasta: 'PROPUESTA',
    retroceso: false,
    datos: { montoPropuesta: 100000 },
  })
  if (mover.etapaHasta !== 'PROPUESTA') {
    fail('embudoMoverSchema no parseó etapaHasta')
  } else {
    pass('embudoMoverSchema acepta transición con datos')
  }

  try {
    embudoMoverSchema.parse({ etapaHasta: 'INVALIDA' })
    fail('mover con etapa inválida debería fallar')
  } catch {
    pass('embudoMoverSchema rechaza etapa inválida')
  }

  const etapas = etapaEmbudoEnum.options
  if (etapas.length !== 9 || !etapas.includes('CIERRE') || !etapas.includes('PERDIDO')) {
    fail(`etapaEmbudoEnum debería tener 9 etapas, tiene ${etapas.length}`)
  } else {
    pass('etapaEmbudoEnum tiene 9 etapas incluyendo CIERRE y PERDIDO')
  }

  if (urgenciaEmbudoEnum.options.join(',') !== 'NORMAL,URGENTE') {
    fail('urgenciaEmbudoEnum valores inesperados')
  } else {
    pass('urgenciaEmbudoEnum NORMAL | URGENTE')
  }

  console.log('')
  if (errors.length > 0) {
    console.error(`${errors.length} fallo(s).\n`)
    process.exit(1)
  }
  console.log('OK — schemas CRM embudo\n')
}

main()
