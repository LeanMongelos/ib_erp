/**
 * Schemas equipo cliente (ficha CRM) y helpers de stock por depósito.
 */
import { equipoClienteCreateSchema, inventarioAjusteSchema } from '../lib/validation'
import { labelOrigenEquipo, labelTipoDeposito } from '../lib/inventario-constants'

const errors: string[] = []

function pass(msg: string) {
  console.log('✅', msg)
}

function fail(msg: string) {
  errors.push(msg)
  console.error('❌', msg)
}

function main() {
  console.log('\n=== Test schema equipo cliente + depósitos ===\n')

  const eq = equipoClienteCreateSchema.parse({
    nombre: 'Bomba de infusión externa',
    marca: 'B Braun',
    numeroSerie: 'EXT-001',
  })
  if (eq.nombre.length < 2) fail('nombre equipo cliente')
  else pass('equipoClienteCreateSchema')

  inventarioAjusteSchema.parse({
    cantidad: 5,
    tipo: 'ENTRADA',
    depositoId: 'dep-1',
    ubicacionDetalle: 'Estante B',
  })
  pass('inventarioAjusteSchema con depositoId')

  if (labelOrigenEquipo('EXTERNO') !== 'Externo') fail('labelOrigenEquipo EXTERNO')
  if (labelOrigenEquipo('MANUAL_ST') !== 'Alta ST') fail('labelOrigenEquipo MANUAL_ST')
  pass('labels origen equipo')

  if (labelTipoDeposito('SHOWROOM') !== 'Showroom') fail('labelTipoDeposito')
  pass('labels tipo depósito')

  console.log('')
  if (errors.length > 0) {
    console.error(`${errors.length} fallo(s).\n`)
    process.exit(1)
  }
  console.log('OK — schema equipo cliente + depósitos\n')
}

main()
