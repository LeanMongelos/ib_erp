/**
 * Tests puros — validación sucursales UI = API.
 * Uso: npx tsx scripts/test-validar-sucursales.ts
 */
import {
  validarListaSucursales,
  validarSucursalEnIndice,
  type SucursalParaValidar,
} from '../lib/clientes/validar-sucursales'

const errors: string[] = []

function pass(msg: string) {
  console.log('✅', msg)
}

function fail(msg: string) {
  errors.push(msg)
  console.error('❌', msg)
}

function assertError(label: string, fn: () => string | null) {
  const err = fn()
  if (!err) fail(`${label}: debía fallar`)
  else pass(`${label}: ${err.slice(0, 50)}…`)
}

function assertOk(label: string, fn: () => string | null) {
  const err = fn()
  if (err) fail(`${label}: ${err}`)
  else pass(label)
}

const sucursalOk: SucursalParaValidar = {
  nombre: 'Hospital Central',
  direccion: 'Av. 25 de Mayo',
  numero: '100',
  ciudad: 'Formosa',
  lat: -26.185,
  lng: -58.175,
}

function main() {
  console.log('\n=== Test validación sucursales ===\n')

  assertOk('sucursal API con lat/lng', () => validarSucursalEnIndice(sucursalOk, 0))

  assertOk('sucursal UI confirmada', () =>
    validarSucursalEnIndice({ ...sucursalOk, geoStatus: 'confirmed' }, 0),
  )

  assertError('sin lat/lng en API', () =>
    validarSucursalEnIndice({ ...sucursalOk, lat: null, lng: null }, 0),
  )

  assertError('UI idle sin confirmar', () =>
    validarSucursalEnIndice({ ...sucursalOk, geoStatus: 'idle' }, 0),
  )

  assertError('sin número', () =>
    validarSucursalEnIndice({ ...sucursalOk, numero: '' }, 0),
  )

  assertError('lista vacía con exigirAlMenosUna', () =>
    validarListaSucursales([], { exigirAlMenosUna: true }),
  )

  assertOk('lista vacía sin exigir', () => validarListaSucursales([]))

  console.log('')
  if (errors.length > 0) {
    console.error(`${errors.length} fallo(s).\n`)
    process.exit(1)
  }
  console.log('OK — validación sucursales\n')
}

main()
