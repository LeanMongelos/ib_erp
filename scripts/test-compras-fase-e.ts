/**
 * Tests Compras Fase E — cuotas AP, transferencias, CSV extracto, constatación mock.
 */
import { prisma } from '../lib/prisma'
import {
  plantillaCuotas306090,
  plantillaCuotas30Dias,
  sumaCuotas,
  validarSumaCuotas,
} from '../lib/compras/cuotas-ap'
import { parseExtractoCsv } from '../lib/tesoreria/parse-extracto-csv'
import { montoConSigno } from '../lib/tesoreria/saldo'
import { constatarComprobanteCompra } from '../lib/afip/constatar-comprobante'
import { facturaCompraCreateSchema } from '../lib/validation'

const errors: string[] = []

function pass(msg: string) {
  console.log('✅', msg)
}

function fail(msg: string) {
  errors.push(msg)
  console.error('❌', msg)
}

async function main() {
  console.log('\n=== Test Compras Fase E ===\n')

  const cuotas30 = plantillaCuotas30Dias(new Date('2026-06-01'), 1210)
  if (cuotas30.length === 1 && validarSumaCuotas(cuotas30, 1210)) pass('plantilla 30 días')
  else fail('plantilla 30 días')

  const cuotas306090 = plantillaCuotas306090(new Date('2026-06-01'), 900)
  if (cuotas306090.length === 3 && validarSumaCuotas(cuotas306090, 900)) pass('plantilla 30/60/90')
  else fail(`plantilla 30/60/90 sum=${sumaCuotas(cuotas306090)}`)

  try {
    facturaCompraCreateSchema.parse({
      proveedorId: 'x',
      tipo: 'CONCEPTOS',
      fecha: '2026-06-01',
      puntoVenta: 1,
      numeroComprobante: 100,
      ordenCompraId: 'oc1',
      items: [{ descripcion: 'A', cantidad: 1, precioUnitario: 1000, alicuotaIvaPct: 21 }],
      cuotas: [
        { numeroCuota: 1, fecha: '2026-07-01', monto: 605 },
        { numeroCuota: 2, fecha: '2026-08-01', monto: 606 },
      ],
    })
    fail('schema debería rechazar cuotas != total')
  } catch {
    pass('schema rechaza suma cuotas incorrecta')
  }

  try {
    facturaCompraCreateSchema.parse({
      proveedorId: 'x',
      tipo: 'CONCEPTOS',
      fecha: '2026-06-01',
      puntoVenta: 1,
      numeroComprobante: 100,
      ordenCompraId: 'oc1',
      items: [{ descripcion: 'A', cantidad: 1, precioUnitario: 1000, alicuotaIvaPct: 21 }],
      cuotas: [{ numeroCuota: 1, fecha: '2026-07-01', monto: 1210 }],
    })
    pass('schema acepta cuota única = total')
  } catch {
    fail('schema cuota única')
  }

  const csv = `fecha;descripcion;debito;credito
01/06/2026;Transferencia recibida;;1500.50
02/06/2026;Pago proveedor;800,00;
`
  const lineas = parseExtractoCsv(csv)
  if (lineas.length === 2 && lineas[0].montoSigned > 0 && lineas[1].montoSigned < 0) {
    pass('parseExtractoCsv es-AR')
  } else fail('parseExtractoCsv')

  const signed = montoConSigno('EGRESO', 100)
  if (signed === -100) pass('montoConSigno EGRESO')
  else fail('montoConSigno')

  try {
    const mock = await constatarComprobanteCompra({
      cuitEmisor: '20-12345678-9',
      tipoComprobante: 1,
      puntoVenta: 1,
      numeroComprobante: 100,
      fecha: new Date('2026-06-01'),
      importeTotal: 1210,
      cae: '70428000005029',
      cuitReceptor: '30-12345678-9',
    })
    if (mock.ok && (mock.resultado === 'A' || mock.simulado)) pass('constatacion mock/simulada')
    else fail(`constatacion mock: ${mock.observaciones}`)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg.includes('ECONNREFUSED') || msg.includes('P1001')) {
      console.log('⚠️  BD no disponible — test constatación omitido (simulación requiere emisor)')
    } else {
      fail(`constatacion: ${msg}`)
    }
  }

  try {
    const cuentas = await prisma.cuentaTesoreria.findMany({ where: { activa: true }, take: 2 })
    if (cuentas.length >= 2) {
      const { crearTransferencia } = await import('../lib/tesoreria/transferencia')
      const usuario = await prisma.usuario.findFirst({ where: { activo: true } })
      if (usuario) {
        const saldoAntes = await import('../lib/tesoreria/saldo').then((m) => m.calcularSaldo(cuentas[0].id))
        if (saldoAntes >= 10) {
          const tx = await crearTransferencia({
            cuentaOrigenId: cuentas[0].id,
            cuentaDestinoId: cuentas[1].id,
            monto: 1,
            fecha: new Date(),
            descripcion: 'Test Fase E',
            creadoPorId: usuario.id,
          })
          const saldoDespues = await import('../lib/tesoreria/saldo').then((m) => m.calcularSaldo(cuentas[0].id))
          if (Math.abs(saldoDespues - (saldoAntes - 1)) < 0.02) pass('transferencia balance origen')
          else fail('transferencia balance')
          await prisma.movimientoTesoreria.deleteMany({ where: { transferenciaId: tx.transferenciaId } })
        } else {
          console.log('⚠️  Saldo insuficiente — test transferencia omitido')
        }
      }
    } else {
      console.log('⚠️  Menos de 2 cuentas — test transferencia omitido')
    }
  } catch (e: unknown) {
    const code = typeof e === 'object' && e && 'code' in e ? String((e as { code: unknown }).code) : ''
    const msg = e instanceof Error ? e.message : String(e)
    if (
      code === 'ECONNREFUSED' ||
      code === 'P1001' ||
      msg.includes('ECONNREFUSED') ||
      msg.includes('P1001') ||
      msg.includes("Can't reach database")
    ) {
      console.log('⚠️  BD no disponible — tests de transferencia omitidos')
    } else {
      fail(`transferencia BD: ${msg}`)
    }
  }

  console.log('\n---')
  if (errors.length) {
    console.error(`Fallaron ${errors.length} checks`)
    process.exit(1)
  }
  console.log('Todos los checks pasaron.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
}).finally(async () => {
  await prisma.$disconnect()
})
