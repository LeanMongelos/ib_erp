/**
 * Tests código interno inventario (lib/inventario/codigo-interno.ts).
 */
import { validarCodigoInterno, normalizarCodigoInterno } from '../lib/inventario/codigo-interno'
import { inventarioCreateSchema } from '../lib/validation'

const errors: string[] = []

function pass(msg: string) {
  console.log('✅', msg)
}

function fail(msg: string) {
  errors.push(msg)
  console.error('❌', msg)
}

function main() {
  console.log('\n=== Test código interno inventario ===\n')

  for (const ok of ['HOE098', 'ABC123', 'ABCD1234', 'FIL1234']) {
    const r = validarCodigoInterno(ok)
    if (r.ok && r.codigo === ok) pass(`válido ${ok}`)
    else fail(`${ok} debería ser válido`)
  }

  for (const bad of ['AB12', 'AB123', '123456', 'HOE', 'HOE09899', 'HO1E98']) {
    const r = validarCodigoInterno(bad)
    if (!r.ok) pass(`rechaza ${bad}`)
    else fail(`${bad} debería ser inválido`)
  }

  if (normalizarCodigoInterno('  hoe-098 ') === 'HOE098') {
    pass('normalizar quita espacios/guiones y mayúsculas')
  } else {
    fail('normalizarCodigoInterno falló')
  }

  inventarioCreateSchema.parse({
    nombre: 'Filtro HEPA',
    sku: 'FIL123',
    tipoArticulo: 'REPUESTO',
  })
  pass('inventarioCreateSchema exige código interno válido')

  try {
    inventarioCreateSchema.parse({ nombre: 'X', sku: 'BAD', tipoArticulo: 'REPUESTO' })
    fail('debería rechazar código inválido')
  } catch {
    pass('inventarioCreateSchema rechaza código inválido')
  }

  console.log('')
  if (errors.length > 0) {
    console.error(`${errors.length} fallo(s).\n`)
    process.exit(1)
  }
  console.log('OK — código interno inventario\n')
}

main()
