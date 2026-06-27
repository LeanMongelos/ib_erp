/**
 * Tests módulo tesorería (lib/tesoreria/*).
 * Requiere BD con migración aplicada.
 */
import { prisma } from '../lib/prisma'
import { calcularSaldo } from '../lib/tesoreria/saldo'
import { cargarSaldoInicial } from '../lib/tesoreria/saldo-inicial'
import { crearMovimientoManual } from '../lib/tesoreria/movimientos'
import { registrarIngresoDesdePago } from '../lib/tesoreria/registrar-ingreso-pago'

const errors: string[] = []

function pass(msg: string) {
  console.log('✅', msg)
}

function fail(msg: string) {
  errors.push(msg)
  console.error('❌', msg)
}

async function main() {
  console.log('\n=== Test tesorería ===\n')

  const usuario = await prisma.usuario.findFirst({ where: { activo: true } })
  if (!usuario) {
    fail('No hay usuario activo en BD')
    process.exit(1)
  }

  const cuenta = await prisma.cuentaTesoreria.create({
    data: {
      nombre: 'Test tesorería ' + Date.now(),
      tipo: 'CAJA',
    },
  })

  try {
    await cargarSaldoInicial(cuenta.id, new Date('2026-01-01'), 1000, usuario.id)
    pass('saldo inicial cargado')

    const saldo1 = await calcularSaldo(cuenta.id)
    if (saldo1 === 1000) pass('saldo inicial = 1000')
    else fail(`saldo inicial esperado 1000, obtuvo ${saldo1}`)

    try {
      await cargarSaldoInicial(cuenta.id, new Date('2026-01-01'), 500, usuario.id)
      fail('debería rechazar segundo saldo inicial')
    } catch {
      pass('rechaza doble saldo inicial')
    }

    await crearMovimientoManual({
      cuentaTesoreriaId: cuenta.id,
      fecha: new Date('2026-01-15'),
      tipo: 'INGRESO',
      monto: 200,
      descripcion: 'Test ingreso',
      usuarioId: usuario.id,
    })
    const saldo2 = await calcularSaldo(cuenta.id)
    if (saldo2 === 1200) pass('ingreso aumenta saldo')
    else fail(`saldo tras ingreso esperado 1200, obtuvo ${saldo2}`)

    await crearMovimientoManual({
      cuentaTesoreriaId: cuenta.id,
      fecha: new Date('2026-01-20'),
      tipo: 'EGRESO',
      monto: 300,
      descripcion: 'Test egreso',
      usuarioId: usuario.id,
    })
    const saldo3 = await calcularSaldo(cuenta.id)
    if (saldo3 === 900) pass('egreso disminuye saldo')
    else fail(`saldo tras egreso esperado 900, obtuvo ${saldo3}`)

    const cliente = await prisma.cliente.findFirst({ where: { activo: true } })
    if (!cliente) {
      fail('No hay cliente para test cobranza')
    } else {
      const pago = await prisma.pago.create({
        data: {
          clienteId: cliente.id,
          monto: 150,
          medio: 'TRANSFERENCIA',
          referencia: 'TEST-TES',
        },
      })

      await prisma.$transaction(async (tx) => {
        await registrarIngresoDesdePago(pago.id, usuario.id, tx, cuenta.id)
      })

      const mov = await prisma.movimientoTesoreria.findFirst({
        where: { pagoId: pago.id, anuladoEn: null },
      })
      if (mov && mov.tipo === 'INGRESO' && mov.monto === 150) {
        pass('cobranza crea ingreso en tesorería')
      } else {
        fail('cobranza no creó ingreso correcto')
      }

      const saldo4 = await calcularSaldo(cuenta.id)
      if (saldo4 === 1050) pass('ingreso desde cobranza suma al saldo')
      else fail(`saldo tras cobranza esperado 1050, obtuvo ${saldo4}`)

      await prisma.pago.delete({ where: { id: pago.id } })
    }
  } finally {
    await prisma.movimientoTesoreria.deleteMany({ where: { cuentaTesoreriaId: cuenta.id } })
    await prisma.cuentaTesoreria.delete({ where: { id: cuenta.id } })
  }

  console.log('')
  if (errors.length > 0) {
    console.error(`${errors.length} fallo(s).\n`)
    process.exit(1)
  }
  console.log('OK — tesorería\n')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
