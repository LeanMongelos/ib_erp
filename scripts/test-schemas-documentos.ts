/**
 * Schemas de ítems: presupuesto no persiste sucursal (Pr1); factura sí (F2).
 */
import { itemFacturaSchema, itemPresupuestoSchema } from '../lib/validation'

const errors: string[] = []

function pass(msg: string) {
  console.log('✅', msg)
}

function fail(msg: string) {
  errors.push(msg)
  console.error('❌', msg)
}

function main() {
  console.log('\n=== Test schemas documentos ===\n')

  const pres = itemPresupuestoSchema.parse({
    descripcion: 'Monitor',
    cantidad: 1,
    precioUnit: 1000,
    tipoArticulo: 'EQUIPO',
    sucursalInstalacionId: 'suc-fantasma',
  })
  if ('sucursalInstalacionId' in pres && pres.sucursalInstalacionId != null) {
    fail('itemPresupuestoSchema no debe incluir sucursalInstalacionId')
  } else {
    pass('itemPresupuestoSchema omite sucursalInstalacionId')
  }

  const fac = itemFacturaSchema.parse({
    descripcion: 'Monitor',
    cantidad: 1,
    precioUnit: 1000,
    tipoArticulo: 'EQUIPO',
    sucursalInstalacionId: 'suc-1',
  })
  if (fac.sucursalInstalacionId !== 'suc-1') {
    fail('itemFacturaSchema debe aceptar sucursalInstalacionId')
  } else {
    pass('itemFacturaSchema acepta sucursalInstalacionId')
  }

  console.log('')
  if (errors.length > 0) {
    console.error(`${errors.length} fallo(s).\n`)
    process.exit(1)
  }
  console.log('OK — schemas documentos\n')
}

main()
