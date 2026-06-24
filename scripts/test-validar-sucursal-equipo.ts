/**
 * Tests puros — validación sucursal equipo UI = API (regla tipoArticulo).
 * Uso: npx tsx scripts/test-validar-sucursal-equipo.ts
 */
import {
  esItemEquipoInstalacion,
  validarSucursalesInstalacionEquipoCliente,
} from '../lib/facturas/equipo-instalacion-client'

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
  else pass(`${label}: ${err.slice(0, 55)}…`)
}

function assertOk(label: string, fn: () => string | null) {
  const err = fn()
  if (err) fail(`${label}: ${err}`)
  else pass(label)
}

function main() {
  console.log('\n=== Test validación sucursal equipo ===\n')

  if (!esItemEquipoInstalacion({ tipoArticulo: 'EQUIPO' })) {
    fail('esItemEquipoInstalacion: EQUIPO')
  } else {
    pass('esItemEquipoInstalacion: EQUIPO')
  }

  if (esItemEquipoInstalacion({ tipoArticulo: 'REPUESTO' })) {
    fail('esItemEquipoInstalacion: REPUESTO no debe ser equipo')
  } else {
    pass('esItemEquipoInstalacion: REPUESTO ignorado')
  }

  assertError('equipo sin sucursal (tipoArticulo)', () =>
    validarSucursalesInstalacionEquipoCliente([
      { descripcion: 'Monitor UCI', tipoArticulo: 'EQUIPO', sucursalInstalacionId: null },
    ]),
  )

  assertError('equipo sin sucursal ni inventarioId', () =>
    validarSucursalesInstalacionEquipoCliente([
      { descripcion: 'Desfibrilador', tipoArticulo: 'EQUIPO' },
    ]),
  )

  assertOk('equipo con sucursal', () =>
    validarSucursalesInstalacionEquipoCliente([
      {
        descripcion: 'Monitor UCI',
        tipoArticulo: 'EQUIPO',
        inventarioId: 'inv-1',
        sucursalInstalacionId: 'suc-1',
      },
    ]),
  )

  assertOk('repuesto sin sucursal', () =>
    validarSucursalesInstalacionEquipoCliente([
      { descripcion: 'Cable', tipoArticulo: 'REPUESTO', inventarioId: 'inv-2' },
    ]),
  )

  assertOk('ítem manual sin tipo', () =>
    validarSucursalesInstalacionEquipoCliente([{ descripcion: 'Servicio técnico' }]),
  )

  console.log('')
  if (errors.length > 0) {
    console.error(`${errors.length} fallo(s).\n`)
    process.exit(1)
  }
  console.log('OK — validación sucursal equipo\n')
}

main()
