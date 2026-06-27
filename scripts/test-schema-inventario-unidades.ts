/**
 * Schemas inventario unidades y trazabilidad.
 */
import {
  inventarioCreateSchema,
  inventarioUnidadCreateSchema,
  inventarioUnidadUpdateSchema,
} from '../lib/validation'
import { trazabilidadActiva, requiereSerie, requiereLote } from '../lib/inventario/unidades'

const errors: string[] = []

function pass(msg: string) {
  console.log('✅', msg)
}

function fail(msg: string) {
  errors.push(msg)
  console.error('❌', msg)
}

function main() {
  console.log('\n=== Test schema inventario unidades ===\n')

  const inv = inventarioCreateSchema.parse({
    nombre: 'Monitor UCI',
    sku: 'MON123',
    tipoArticulo: 'EQUIPO',
    modoTrazabilidad: 'SERIE',
  })
  if (inv.modoTrazabilidad !== 'SERIE') fail('modoTrazabilidad SERIE')
  else pass('inventarioCreateSchema acepta modoTrazabilidad')

  inventarioUnidadCreateSchema.parse({ numeroSerie: 'SN-001' })
  inventarioUnidadCreateSchema.parse({ lote: 'L-2024', depositoId: 'dep-1' })
  pass('inventarioUnidadCreateSchema (SN/lote opcionales)')

  inventarioUnidadUpdateSchema.parse({ estado: 'BAJA' })
  pass('inventarioUnidadUpdateSchema')

  if (!trazabilidadActiva('SERIE')) fail('trazabilidadActiva SERIE')
  if (trazabilidadActiva('NINGUNA')) fail('NINGUNA no es trazabilidad activa')
  if (!requiereSerie('SERIE_Y_LOTE')) fail('requiereSerie SERIE_Y_LOTE')
  if (!requiereLote('LOTE')) fail('requiereLote LOTE')
  pass('helpers trazabilidad')

  console.log('')
  if (errors.length > 0) {
    console.error(`${errors.length} fallo(s).\n`)
    process.exit(1)
  }
  console.log('OK — schema inventario unidades\n')
}

main()
