/**
 * Tests Compras Fase B — FacturaCompra, AP vencimientos, libro compras.
 * Requiere BD con migración 20260626180000_compras_fase_b aplicada.
 */
import { prisma } from '../lib/prisma'
import {
  calcularTotalesFacturaCompra,
  ocEstaAprobada,
  ocRecepcionCompleta,
  prefillsDesdeOC,
  saldoPendienteFactura,
  validarReglasFacturaCompra,
} from '../lib/compras/factura-compra'
import { libroComprasACsv, totalesLibroCompras } from '../lib/compras/libro-compras'
import { facturaCompraCreateSchema, tipoFacturaCompraEnum } from '../lib/validation'

const errors: string[] = []

function pass(msg: string) {
  console.log('✅', msg)
}

function fail(msg: string) {
  errors.push(msg)
  console.error('❌', msg)
}

async function main() {
  console.log('\n=== Test Compras Fase B ===\n')

  try {
    facturaCompraCreateSchema.parse({
      proveedorId: 'x',
      tipo: 'CONCEPTOS',
      fecha: '2026-06-01',
      puntoVenta: 1,
      numeroComprobante: 100,
      ordenCompraId: 'oc1',
      items: [{ descripcion: 'Servicio', cantidad: 1, precioUnitario: 1000 }],
    })
    pass('schema FC conceptos con OC')
  } catch {
    fail('schema FC conceptos debería aceptar OC')
  }

  if (!tipoFacturaCompraEnum.safeParse('REMITO').success) fail('enum REMITO')
  else pass('enum tipoFacturaCompra')

  const tot = calcularTotalesFacturaCompra([
    { descripcion: 'A', cantidad: 2, precioUnitario: 100, alicuotaIvaPct: 21 },
  ])
  if (tot.neto === 200 && tot.iva === 42 && tot.total === 242) pass('calcularTotalesFacturaCompra')
  else fail(`totales esperados 200/42/242, obtuvo ${tot.neto}/${tot.iva}/${tot.total}`)

  const errConceptos = validarReglasFacturaCompra({ tipo: 'CONCEPTOS', ordenCompraId: null })
  if (errConceptos) pass('CONCEPTOS sin OC rechazado')
  else fail('CONCEPTOS sin OC debería fallar')

  const errRemito = validarReglasFacturaCompra({
    tipo: 'REMITO',
    oc: {
      id: '1',
      proveedorId: 'p',
      estado: 'APROBADA',
      items: [{ id: 'i', cantidad: 5, cantidadRecibida: 0, inventarioId: 'inv' }],
    },
    fcSinRecepcion: false,
  })
  if (errRemito) pass('REMITO sin recepción rechazado')
  else fail('REMITO sin recepción debería fallar')

  const okRemito = validarReglasFacturaCompra({
    tipo: 'REMITO',
    fcSinRecepcion: true,
    notaFcSinRecepcion: 'Factura anticipada',
  })
  if (!okRemito) pass('REMITO fcSinRecepcion con nota')
  else fail('REMITO fcSinRecepcion debería pasar')

  const pref = prefillsDesdeOC({
    proveedorId: 'p',
    items: [{
      id: 'it1',
      descripcion: 'Gasto',
      concepto: 'Luz',
      cantidad: 1,
      cantidadRecibida: 0,
      precioUnit: 500,
      inventarioId: null,
    }],
  }, 'CONCEPTOS')
  if (pref.length === 1 && pref[0].itemOrdenCompraId === 'it1') pass('prefillsDesdeOC conceptos')
  else fail('prefillsDesdeOC conceptos')

  const saldo = saldoPendienteFactura([
    { saldo: 100, pagado: false },
    { saldo: 50, pagado: true },
  ])
  if (saldo === 100) pass('saldoPendienteFactura')
  else fail(`saldo pendiente esperado 100, obtuvo ${saldo}`)

  const lineas = [{
    facturaCompraId: '1',
    numeroInterno: 'FC-2026-0001',
    fecha: new Date('2026-06-15'),
    proveedorRazonSocial: 'Proveedor Test',
    proveedorCuit: '20-12345678-9',
    tipoComprobante: '1 A',
    puntoVenta: 1,
    numeroComprobante: 100,
    neto: 100,
    iva: 21,
    total: 121,
    moneda: 'ARS',
  }]
  const csv = libroComprasACsv(lineas)
  if (csv.includes('Proveedor Test') && csv.includes('121.00')) pass('libroComprasACsv')
  else fail('libroComprasACsv')

  const totLibro = totalesLibroCompras(lineas)
  if (totLibro.total === 121 && totLibro.cantidad === 1) pass('totalesLibroCompras')
  else fail('totalesLibroCompras')

  // BD
  let usuario
  try {
    usuario = await prisma.usuario.findFirst({ where: { activo: true } })
  } catch (e: unknown) {
    const code = typeof e === 'object' && e && 'code' in e ? String((e as { code: unknown }).code) : ''
    const msg = e instanceof Error ? e.message : String(e)
    if (
      code === 'ECONNREFUSED' ||
      code === 'P1001' ||
      msg.includes('ECONNREFUSED') ||
      msg.includes("Can't reach database") ||
      msg.includes('P1001') ||
      msg.includes('facturas_compra')
    ) {
      console.log('\n⚠️  BD no disponible o migración pendiente — tests de flujo omitidos')
      process.exit(errors.length ? 1 : 0)
    }
    throw e
  }

  if (!usuario) {
    fail('No hay usuario activo')
    process.exit(1)
  }

  let prov = await prisma.proveedor.findFirst({ where: { tipoCompra: 'CONCEPTOS', activo: true } })
  if (!prov) {
    prov = await prisma.proveedor.create({
      data: { razonSocial: 'Test FC B ' + Date.now(), tipoCompra: 'CONCEPTOS' },
    })
  }

  const numeroOc = 'TEST-OC-FCB-' + Date.now()
  const oc = await prisma.ordenCompra.create({
    data: {
      numero: numeroOc,
      proveedorId: prov.id,
      estado: 'APROBADA',
      subtotal: 1000,
      total: 1000,
      creadoPorId: usuario.id,
      aprobadoEn: new Date(),
      items: {
        create: [{
          descripcion: 'Servicio test',
          concepto: 'Mantenimiento',
          cantidad: 1,
          precioUnit: 1000,
          subtotal: 1000,
        }],
      },
    },
    include: { items: true },
  })
  if (ocEstaAprobada(oc.estado)) pass('OC aprobada para FC conceptos')
  else fail('OC estado')

  const numeroFc = 'TEST-FCB-' + Date.now()
  const fc = await prisma.facturaCompra.create({
    data: {
      numero: numeroFc,
      proveedorId: prov.id,
      tipo: 'CONCEPTOS',
      estado: 'BORRADOR',
      fecha: new Date(),
      puntoVenta: 1,
      numeroComprobante: Math.floor(Date.now() % 900000) + 10000,
      neto: 1000,
      iva: 210,
      total: 1210,
      ordenCompraId: oc.id,
      recepcionCompleta: false,
      creadoPorId: usuario.id,
      items: {
        create: [{
          descripcion: 'Servicio test',
          concepto: 'Mantenimiento',
          cantidad: 1,
          precioUnitario: 1000,
          alicuotaIvaPct: 21,
          neto: 1000,
          iva: 210,
          itemOrdenCompraId: oc.items[0].id,
        }],
      },
    },
  })
  pass('FacturaCompra borrador creada')

  await prisma.vencimientoPago.create({
    data: {
      facturaCompraId: fc.id,
      numeroCuota: 1,
      fecha: new Date(),
      monto: 1210,
      saldo: 1210,
      pagado: false,
    },
  })

  const registrada = await prisma.facturaCompra.update({
    where: { id: fc.id },
    data: { estado: 'REGISTRADA', registradaEn: new Date() },
  })
  if (registrada.estado === 'REGISTRADA') pass('FC registrada en BD')
  else fail('registro FC')

  const enLibro = await prisma.facturaCompra.findMany({
    where: { estado: 'REGISTRADA', id: fc.id },
  })
  if (enLibro.length === 1) pass('FC en consulta libro (REGISTRADA)')
  else fail('consulta libro')

  await prisma.vencimientoPago.deleteMany({ where: { facturaCompraId: fc.id } })
  await prisma.itemFacturaCompra.deleteMany({ where: { facturaCompraId: fc.id } })
  await prisma.facturaCompra.delete({ where: { id: fc.id } })
  await prisma.itemOrdenCompra.deleteMany({ where: { ordenCompraId: oc.id } })
  await prisma.ordenCompra.delete({ where: { id: oc.id } })
  pass('datos de prueba eliminados')

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
