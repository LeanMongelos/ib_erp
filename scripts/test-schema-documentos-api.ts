/**
 * Schemas factura/presupuesto/inventario centralizados en lib/validation.ts.
 */
import {
  facturaCreateSchema,
  facturaUpdateSchema,
  presupuestoCreateSchema,
  presupuestoUpdateSchema,
  inventarioCreateSchema,
  inventarioUpdateSchema,
  inventarioAjusteSchema,
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
  console.log('\n=== Test schemas documentos API ===\n')

  facturaCreateSchema.parse({
    clienteId: 'cli-1',
    tipo: 'B',
    items: [{ descripcion: 'Servicio', cantidad: 1, precioUnit: 1000 }],
  })
  pass('facturaCreateSchema acepta payload mínimo')

  try {
    facturaCreateSchema.parse({
      clienteId: 'cli-1',
      tipo: 'B',
      items: [],
    })
    fail('facturaCreateSchema debería exigir al menos un ítem')
  } catch {
    pass('facturaCreateSchema rechaza items vacíos')
  }

  const facPatch = facturaUpdateSchema.parse({
    observaciones: 'Actualizado',
    bonificacionPct: 5,
  })
  if (facPatch.bonificacionPct !== 5) {
    fail('facturaUpdateSchema no parseó bonificacionPct')
  } else {
    pass('facturaUpdateSchema PATCH parcial OK')
  }

  try {
    facturaUpdateSchema.parse({})
    fail('facturaUpdateSchema debería rechazar body vacío')
  } catch {
    pass('facturaUpdateSchema exige al menos un campo')
  }

  presupuestoCreateSchema.parse({
    clienteId: 'cli-1',
    items: [{ descripcion: 'Monitor', cantidad: 1, precioUnit: 50000 }],
  })
  pass('presupuestoCreateSchema acepta payload mínimo')

  presupuestoUpdateSchema.parse({ vigenciaDias: 30 })
  pass('presupuestoUpdateSchema PATCH parcial OK')

  inventarioCreateSchema.parse({
    nombre: 'Filtro HEPA',
    tipoArticulo: 'REPUESTO',
  })
  pass('inventarioCreateSchema acepta payload mínimo')

  inventarioUpdateSchema.parse({ stockMinimo: 10 })
  pass('inventarioUpdateSchema PATCH parcial OK')

  inventarioAjusteSchema.parse({ cantidad: 3, tipo: 'ENTRADA' })
  pass('inventarioAjusteSchema acepta ajuste de stock')

  console.log('')
  if (errors.length > 0) {
    console.error(`${errors.length} fallo(s).\n`)
    process.exit(1)
  }
  console.log('OK — schemas documentos API\n')
}

main()
