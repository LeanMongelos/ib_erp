/**
 * Tests Compras Fase D — cuenta corriente, alertas dismiss, cheques débito, RBAC.
 * Requiere BD con migración 20260626220000_compras_fase_d aplicada.
 */
import { prisma } from '../lib/prisma'
import {
  evaluarUmbralAlerta,
  evaluarUmbralChequeDebito,
  generarAlertKey,
  UMBRALES_CHEQUE_DEBITO,
} from '../lib/compras/alertas-compra'
import { bucketAging } from '../lib/compras/cuenta-corriente'
import { alertaCompraDismissSchema } from '../lib/validation'
import { ROLE_PERMISSIONS } from '../lib/rbac'

const errors: string[] = []

function pass(msg: string) {
  console.log('✅', msg)
}

function fail(msg: string) {
  errors.push(msg)
  console.error('❌', msg)
}

async function main() {
  console.log('\n=== Test Compras Fase D ===\n')

  // --- Aging buckets (pure) ---
  if (bucketAging(0) !== '0-30') fail('0 días → bucket 0-30')
  else pass('bucket aging: 0 días')

  if (bucketAging(30) !== '0-30') fail('30 días → bucket 0-30')
  else pass('bucket aging: 30 días')

  if (bucketAging(45) !== '31-60') fail('45 días → bucket 31-60')
  else pass('bucket aging: 45 días')

  if (bucketAging(100) !== '90+') fail('100 días → bucket 90+')
  else pass('bucket aging: 100 días')

  // --- Cheque débito umbrales ---
  if (evaluarUmbralChequeDebito(10) !== null) fail('10 días no debería alertar cheque')
  else pass('cheque: 10 días sin alerta')

  if (evaluarUmbralChequeDebito(7) !== 7) fail('7 días debería umbral 7')
  else pass('cheque: 7 días')

  if (evaluarUmbralChequeDebito(3) !== 3) fail('3 días debería umbral 3')
  else pass('cheque: 3 días')

  if (evaluarUmbralChequeDebito(1) !== 1) fail('1 día debería umbral 1')
  else pass('cheque: 1 día')

  if (evaluarUmbralChequeDebito(0) !== 1) fail('0 días (hoy) debería umbral 1')
  else pass('cheque: vence hoy')

  if (UMBRALES_CHEQUE_DEBITO.length !== 3) fail('debería haber 3 umbrales cheque')
  else pass('umbrales cheque 1/3/7 definidos')

  // --- Alert key estable ---
  const key1 = generarAlertKey({
    tipo: 'FC_PENDIENTE_REGISTRO',
    facturaCompraId: 'fc-123',
    numero: 'FC-001',
  })
  if (key1 !== 'FC_PENDIENTE_REGISTRO:fc-123') fail('alertKey factura incorrecta')
  else pass('generarAlertKey factura')

  const key2 = generarAlertKey({
    tipo: 'CHEQUE_PROXIMO_DEBITO',
    chequeEmitidoId: 'ch-456',
    numero: '12345',
  })
  if (key2 !== 'CHEQUE_PROXIMO_DEBITO:ch-456') fail('alertKey cheque incorrecta')
  else pass('generarAlertKey cheque')

  // --- FC umbrales (regresión fase C) ---
  if (evaluarUmbralAlerta(2) !== null) fail('regresión: 2 días FC sin alerta')
  else pass('regresión umbral FC 2 días')

  // --- Schema dismiss ---
  try {
    alertaCompraDismissSchema.parse({ alertKey: 'FC_PENDIENTE_REGISTRO:abc' })
    pass('schema dismiss alerta')
  } catch {
    fail('schema dismiss debería aceptar alertKey')
  }

  try {
    alertaCompraDismissSchema.parse({ alertKey: '' })
    fail('schema dismiss debería rechazar alertKey vacío')
  } catch {
    pass('schema rechaza alertKey vacío')
  }

  // --- RBAC FACTURACION ---
  const factPerms = ROLE_PERMISSIONS.FACTURACION ?? []
  if (!factPerms.includes('compras.read')) fail('FACTURACION debería tener compras.read')
  else pass('RBAC FACTURACION: compras.read')

  if (!factPerms.includes('compras.pay')) fail('FACTURACION debería tener compras.pay')
  else pass('RBAC FACTURACION: compras.pay')

  // --- BD: tabla dismiss ---
  const migracionOk = await prisma.$queryRaw<Array<{ exists: boolean }>>`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables WHERE table_name = 'alertas_compra_dismiss'
    ) as exists
  `.catch(() => [{ exists: false }])

  if (!migracionOk[0]?.exists) {
    fail('Migración 20260626220000_compras_fase_d no aplicada (tabla alertas_compra_dismiss ausente)')
    console.log('\n⚠️  Ejecutá: npx prisma migrate deploy && npx prisma generate')
  } else {
    pass('tabla alertas_compra_dismiss existe')

    const vencCount = await prisma.vencimientoPago.count({
      where: { pagado: false, saldo: { gt: 0 }, facturaCompra: { estado: 'REGISTRADA' } },
    })
    console.log(`ℹ️  ${vencCount} vencimiento(s) AP pendiente(s) en BD`)

    const egresoProv = await prisma.movimientoTesoreria.findFirst({
      where: { tipo: 'EGRESO', pagoProveedorId: { not: null }, anuladoEn: null },
      include: { pagoProveedor: { select: { proveedor: { select: { razonSocial: true } } } } },
    })
    if (egresoProv?.pagoProveedor) {
      pass('egreso tesorería vinculado a pago proveedor')
    } else {
      console.log('⏭️  Sin egreso pago proveedor en BD — omitido test conciliación')
    }
  }

  console.log('\n---')
  if (errors.length === 0) {
    console.log('✅ Todos los tests Fase D pasaron\n')
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
