/**
 * Schemas sucursales instalación centralizados en lib/validation.ts.
 */
import {
  sucursalInstalacionCreateSchema,
  sucursalInstalacionUpdateSchema,
  sucursalClienteSchema,
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
  console.log('\n=== Test schemas sucursales API ===\n')

  sucursalInstalacionCreateSchema.parse({
    nombre: 'Sede Norte',
    direccion: 'Av. Belgrano',
    numero: '500',
    ciudad: 'Formosa',
    lat: -26.18,
    lng: -58.17,
  })
  pass('sucursalInstalacionCreateSchema acepta payload mínimo')

  try {
    sucursalInstalacionCreateSchema.parse({ nombre: 'X' })
    fail('sucursalInstalacionCreateSchema debería exigir nombre ≥ 2 caracteres')
  } catch {
    pass('sucursalInstalacionCreateSchema rechaza nombre corto')
  }

  sucursalInstalacionUpdateSchema.parse({ notas: 'Actualizado' })
  pass('sucursalInstalacionUpdateSchema PATCH parcial OK')

  try {
    sucursalInstalacionUpdateSchema.parse({})
    fail('sucursalInstalacionUpdateSchema debería rechazar body vacío')
  } catch {
    pass('sucursalInstalacionUpdateSchema exige al menos un campo')
  }

  const createFields = Object.keys(sucursalInstalacionCreateSchema.shape)
  const clienteFields = Object.keys(sucursalClienteSchema.shape)
  const shared = clienteFields.every((f) => createFields.includes(f))
  if (!shared) {
    fail('sucursalInstalacionCreateSchema no incluye todos los campos de sucursalClienteSchema')
  } else {
    pass('sucursalInstalacionCreateSchema alineado con sucursalClienteSchema')
  }

  console.log('')
  if (errors.length > 0) {
    console.error(`${errors.length} fallo(s).\n`)
    process.exit(1)
  }
  console.log('OK — schemas sucursales API\n')
}

main()
