/**
 * Tests Compras Fase C — Pagos proveedor, tesorería EGRESO, cheques emitidos, alertas.
 * Requiere BD con migración 20260626200000_compras_fase_c aplicada.
 */
import { prisma } from '../lib/prisma'
import { imputarMontoAVencimiento, revertirImputacionVencimiento } from '../lib/compras/imputacion-vencimiento'
import { evaluarUmbralAlerta, UMBRALES_ALERTA_COMPRA } from '../lib/compras/alertas-compra'
import { pagoProveedorCreateSchema } from '../lib/validation'

const errors: string[] = []

function pass(msg: string) {
  console.log('✅', msg)
}

function fail(msg: string) {
  errors.push(msg)
  console.error('❌', msg)
}

async function main() {
  console.log('\n=== Test Compras Fase C ===\n')

  if (evaluarUmbralAlerta(2) !== null) fail('2 días no debería alertar')
  else pass('umbral: 2 días sin alerta')

  if (evaluarUmbralAlerta(3) !== 3) fail('3 días debería umbral 3')
  else pass('umbral: 3 días')

  if (evaluarUmbralAlerta(6) !== 5) fail('6 días debería umbral 5')
  else pass('umbral: 6 días → 5')

  if (evaluarUmbralAlerta(10) !== 7) fail('10 días debería umbral 7')
  else pass('umbral: 10 días → 7')

  if (UMBRALES_ALERTA_COMPRA.length !== 3) fail('debería haber 3 umbrales')
  else pass('umbrales 3/5/7 definidos')

  try {
    pagoProveedorCreateSchema.parse({
      proveedorId: 'p1',
      monto: 1000,
      medio: 'TRANSFERENCIA',
      cuentaTesoreriaId: 'cta1',
      imputaciones: [{ vencimientoPagoId: 'v1', monto: 1000 }],
    })
    pass('schema pago proveedor transferencia')
  } catch {
    fail('schema pago proveedor debería aceptar transferencia')
  }

  try {
    pagoProveedorCreateSchema.parse({
      proveedorId: 'p1',
      monto: 500,
      medio: 'CHEQUE',
      imputaciones: [{ vencimientoPagoId: 'v1', monto: 500 }],
      cheque: { numero: '12345678' },
    })
    fail('cheque sin cuenta debería fallar')
  } catch {
    pass('schema rechaza cheque sin cuenta tesorería')
  }

  const migracionOk = await prisma.$queryRaw<Array<{ exists: boolean }>>`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables WHERE table_name = 'pagos_proveedor'
    ) as exists
  `.catch(() => [{ exists: false }])

  if (!migracionOk[0]?.exists) {
    fail('Migración 20260626200000_compras_fase_c no aplicada (tabla pagos_proveedor ausente)')
    console.log('\n⚠️  Ejecutá: npx prisma migrate deploy && npx prisma generate')
  } else {
    pass('tabla pagos_proveedor existe')

    const vencPendiente = await prisma.vencimientoPago.findFirst({
      where: { pagado: false, saldo: { gt: 0 }, facturaCompra: { estado: 'REGISTRADA' } },
      include: { facturaCompra: true },
    })

    if (vencPendiente) {
      const saldoAntes = vencPendiente.saldo
      const montoTest = Math.min(10, saldoAntes)

      await prisma.$transaction(async (tx) => {
        await imputarMontoAVencimiento(vencPendiente.id, montoTest, tx)
        const actualizado = await tx.vencimientoPago.findUnique({ where: { id: vencPendiente.id } })
        if (!actualizado || Math.abs(actualizado.saldo - (saldoAntes - montoTest)) > 0.02) {
          throw new Error('saldo no reducido')
        }
        await revertirImputacionVencimiento(vencPendiente.id, montoTest, tx)
        const revertido = await tx.vencimientoPago.findUnique({ where: { id: vencPendiente.id } })
        if (!revertido || Math.abs(revertido.saldo - saldoAntes) > 0.02) {
          throw new Error('saldo no revertido')
        }
      })
      pass('imputación reduce y revierte saldo vencimiento')
    } else {
      console.log('⏭️  Sin vencimiento pendiente en BD — omitido test imputación')
    }

    const pagoTransfer = await prisma.pagoProveedor.findFirst({
      where: { medio: { not: 'CHEQUE' }, estado: 'REGISTRADO' },
      include: { movimientoTesoreria: true },
    })
    if (pagoTransfer?.movimientoTesoreria?.tipo === 'EGRESO') {
      pass('pago transferencia tiene EGRESO tesorería')
    } else if (pagoTransfer) {
      fail('pago no-cheque debería tener movimiento EGRESO')
    } else {
      console.log('⏭️  Sin pago transferencia en BD — omitido test egreso')
    }

    const pagoCheque = await prisma.pagoProveedor.findFirst({
      where: { medio: 'CHEQUE', estado: 'REGISTRADO' },
      include: { movimientoTesoreria: true, chequeEmitido: true },
    })
    if (pagoCheque) {
      if (pagoCheque.chequeEmitido?.estado === 'EMITIDO' && !pagoCheque.movimientoTesoreria) {
        pass('cheque emitido sin egreso hasta debitar')
      } else if (pagoCheque.chequeEmitido?.estado === 'DEBITADO' && pagoCheque.movimientoTesoreria?.tipo === 'EGRESO') {
        pass('cheque debitado tiene EGRESO')
      } else {
        fail('estado cheque/egreso inconsistente')
      }
    } else {
      console.log('⏭️  Sin pago cheque en BD — omitido test cheque')
    }
  }

  console.log('\n---')
  if (errors.length === 0) {
    console.log('✅ Todos los tests Fase C pasaron\n')
    process.exit(0)
  } else {
    console.error(`❌ ${errors.length} error(es)\n`)
    process.exit(1)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
