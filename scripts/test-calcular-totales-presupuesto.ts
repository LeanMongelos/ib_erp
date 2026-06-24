/**
 * Tests — totales presupuesto incluyen interés de financiación (Pr2).
 */
import { calcularTotalesPresupuesto } from '../lib/presupuestos/calcular-total-presupuesto'

const errors: string[] = []

function pass(msg: string) {
  console.log('✅', msg)
}

function fail(msg: string) {
  errors.push(msg)
  console.error('❌', msg)
}

function main() {
  console.log('\n=== Test totales presupuesto ===\n')

  const base = calcularTotalesPresupuesto({
    items: [{ descripcion: 'Servicio', cantidad: 1, precioUnit: 10000 }],
    alicuotaIvaPct: 21,
    plazosCobranza: [30, 60, 90],
    tasaFinanciacionPct: 2,
  })

  if (base.interesFinanciacion <= 0) {
    fail('interés financiación debería ser > 0 con plazos y tasa')
  } else {
    pass(`interés calculado: ${base.interesFinanciacion}`)
  }

  const esperadoTotal = base.subtotal + base.iva + base.interesFinanciacion
  if (Math.abs(base.total - esperadoTotal) > 0.01) {
    fail(`total ${base.total} ≠ subtotal+iva+interés (${esperadoTotal})`)
  } else {
    pass('total = subtotal + iva + interés')
  }

  const sinInteres = calcularTotalesPresupuesto({
    items: [{ descripcion: 'Repuesto', cantidad: 1, precioUnit: 5000 }],
    condicionPago: 'Contado',
  })
  if (sinInteres.interesFinanciacion !== 0) {
    fail('contado no debería generar interés')
  } else {
    pass('contado → interés 0')
  }

  console.log('')
  if (errors.length > 0) {
    console.error(`${errors.length} fallo(s).\n`)
    process.exit(1)
  }
  console.log('OK — totales presupuesto\n')
}

main()
