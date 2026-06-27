/**
 * Tests Compras Fase H + I + J — bonificaciones, moneda USD, historial AP.
 */
import { calcularPrecioNeto, calcularPrecioNetoItem } from '../lib/compras/bonificacion'
import { calcularTotalesFacturaCompra, prefillsDesdeOC, validarReglasFacturaCompra } from '../lib/compras/factura-compra'
import { calcularTotalesOC } from '../lib/compras/oc'
import {
  validarMonedaFcVsOc,
  validarMonedaUnicaImputaciones,
  acumularSaldoPorMoneda,
} from '../lib/compras/moneda-compra'
import { bucketAging } from '../lib/compras/cuenta-corriente'
import { labelEventoAp } from '../lib/compras/historial-ap-types'

const errors: string[] = []

function pass(msg: string) {
  console.log('✅', msg)
}

function fail(msg: string) {
  errors.push(msg)
  console.error('❌', msg)
}

async function main() {
  console.log('\n=== Test Compras Fase H + I + J ===\n')

  // --- Fase H: bonificaciones ---
  const neto10 = calcularPrecioNeto(100, 10)
  if (neto10 === 90) pass('calcularPrecioNeto 10% sobre lista')
  else fail(`calcularPrecioNeto: esperado 90, got ${neto10}`)

  const netoFallback = calcularPrecioNeto(null, 0, 75)
  if (netoFallback === 75) pass('calcularPrecioNeto fallback precioUnit')
  else fail(`fallback: ${netoFallback}`)

  const ocTot = calcularTotalesOC([
    { cantidad: 2, precioUnit: 0, precioLista: 100, bonificacionPct: 10 },
  ])
  if (ocTot.subtotal === 180) pass('calcularTotalesOC con bonificación')
  else fail(`calcularTotalesOC: ${ocTot.subtotal}`)

  const fcTot = calcularTotalesFacturaCompra([
    {
      descripcion: 'Filtro',
      cantidad: 1,
      precioUnitario: 0,
      precioLista: 200,
      bonificacionPct: 5,
    },
  ])
  if (fcTot.neto === 190) pass('calcularTotalesFacturaCompra con bonificación')
  else fail(`calcularTotalesFacturaCompra neto: ${fcTot.neto}`)

  const prefills = prefillsDesdeOC(
    {
      proveedorId: 'p1',
      items: [{
        id: 'i1',
        descripcion: 'Item',
        concepto: null,
        cantidad: 3,
        cantidadRecibida: 0,
        precioUnit: 90,
        precioLista: 100,
        bonificacionPct: 10,
        inventarioId: null,
      }],
    },
    'CONCEPTOS',
  )
  if (prefills[0]?.bonificacionPct === 10 && prefills[0]?.precioLista === 100) {
    pass('prefillsDesdeOC hereda bonificación')
  } else fail('prefillsDesdeOC no heredó bonificación')

  // --- Fase I: moneda ---
  const monedaOk = validarMonedaFcVsOc('USD', 'USD')
  if (monedaOk === null) pass('moneda FC = OC sin nota')
  else fail(`moneda igual: ${monedaOk}`)

  const monedaFail = validarMonedaFcVsOc('USD', 'ARS', null)
  if (monedaFail) pass('moneda distinta sin nota rechazada')
  else fail('moneda distinta debería requerir nota')

  const monedaNota = validarMonedaFcVsOc('USD', 'ARS', 'Factura en USD por contrato')
  if (monedaNota === null) pass('moneda distinta con nota OK')
  else fail(`moneda con nota: ${monedaNota}`)

  const impFail = validarMonedaUnicaImputaciones(['ARS', 'USD'])
  if (impFail) pass('imputaciones multi-moneda rechazadas')
  else fail('imputaciones multi-moneda deberían fallar')

  const impOk = validarMonedaUnicaImputaciones(['USD', 'USD'], 'USD')
  if (impOk === null) pass('imputaciones moneda única OK')
  else fail(`imputaciones USD: ${impOk}`)

  const saldos = acumularSaldoPorMoneda({}, 'USD', 100)
  if (saldos.USD === 100) pass('acumularSaldoPorMoneda USD')
  else fail(`saldos USD: ${JSON.stringify(saldos)}`)

  const reglaMoneda = validarReglasFacturaCompra({
    tipo: 'CONCEPTOS',
    ordenCompraId: 'oc1',
    moneda: 'USD',
    notaMonedaOc: null,
    oc: {
      id: 'oc1',
      proveedorId: 'p1',
      estado: 'APROBADA',
      moneda: 'ARS',
      items: [{ id: 'i1', cantidad: 1, cantidadRecibida: 0, inventarioId: null }],
    },
  })
  if (reglaMoneda?.includes('moneda')) pass('validarReglasFacturaCompra moneda distinta')
  else fail(`regla moneda: ${reglaMoneda}`)

  if (bucketAging(45) === '31-60') pass('bucketAging sin regresión')
  else fail('bucketAging regresión')

  // --- Fase J: historial labels ---
  if (labelEventoAp('FC_REGISTRADA') === 'Factura registrada') pass('labelEventoAp FC')
  else fail('labelEventoAp')

  if (labelEventoAp('PAGO') === 'Pago a proveedor') pass('labelEventoAp PAGO')
  else fail('labelEventoAp PAGO')

  const itemNeto = calcularPrecioNetoItem({ precioUnit: 50, precioLista: 100, bonificacionPct: 20 })
  if (itemNeto === 80) pass('calcularPrecioNetoItem')
  else fail(`calcularPrecioNetoItem: ${itemNeto}`)

  console.log('\n--- Resumen ---')
  if (errors.length === 0) {
    console.log('Todos los tests pasaron.\n')
    process.exit(0)
  } else {
    console.error(`${errors.length} error(es)\n`)
    process.exit(1)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
