/**
 * Tests Compras Fase A — OC manual, aprobación, tipoCompra.
 * Requiere BD con migración 20260626160000_compras_fase_a aplicada.
 */
import { prisma } from '../lib/prisma'
import { calcularTotalesOC, filtroProveedorPorTipoCompra, ocEsEditable, ocEsRecepcionable } from '../lib/compras/oc'
import { ordenCompraCreateSchema, ordenCompraRechazarSchema, tipoCompraProveedorEnum } from '../lib/validation'

const errors: string[] = []

function pass(msg: string) {
  console.log('✅', msg)
}

function fail(msg: string) {
  errors.push(msg)
  console.error('❌', msg)
}

async function main() {
  console.log('\n=== Test Compras Fase A ===\n')

  // --- Validación schemas ---
  try {
    ordenCompraCreateSchema.parse({
      proveedorId: 'x',
      items: [{ descripcion: 'Repuesto', cantidad: 2, precioUnit: 100 }],
    })
    pass('schema crear OC válido')
  } catch {
    fail('schema crear OC debería aceptar ítem mínimo')
  }

  try {
    ordenCompraRechazarSchema.parse({ motivo: 'Precio alto' })
    pass('schema rechazar OC válido')
  } catch {
    fail('schema rechazar OC debería aceptar motivo')
  }

  if (!tipoCompraProveedorEnum.safeParse('REMITO').success) fail('enum tipoCompra REMITO')
  else pass('enum tipoCompra REMITO')

  const tot = calcularTotalesOC([{ cantidad: 3, precioUnit: 10.5 }])
  if (tot.total === 31.5) pass('calcularTotalesOC')
  else fail(`calcularTotalesOC esperado 31.5, obtuvo ${tot.total}`)

  if (ocEsEditable('BORRADOR') && ocEsEditable('RECHAZADA') && !ocEsEditable('APROBADA')) {
    pass('ocEsEditable')
  } else fail('ocEsEditable estados incorrectos')

  if (ocEsRecepcionable('APROBADA') && ocEsRecepcionable('ENVIADA') && !ocEsRecepcionable('BORRADOR')) {
    pass('ocEsRecepcionable')
  } else fail('ocEsRecepcionable estados incorrectos')

  const filtroRemito = filtroProveedorPorTipoCompra('REMITO')
  if ('OR' in filtroRemito) pass('filtroProveedorPorTipoCompra REMITO incluye AMBOS')
  else fail('filtroProveedorPorTipoCompra REMITO')

  // --- BD (si disponible) ---
  let usuario
  let aprobador
  try {
    usuario = await prisma.usuario.findFirst({ where: { activo: true } })
    aprobador = await prisma.usuario.findFirst({
      where: { email: { in: ['cesar@ib.com', 'guillermo@ib.com', 'lucas@ib.com'] } },
    })
  } catch (e: unknown) {
    const code = typeof e === 'object' && e && 'code' in e ? String((e as { code: unknown }).code) : ''
    const msg = e instanceof Error ? e.message : String(e)
    if (
      code === 'ECONNREFUSED' ||
      code === 'P1001' ||
      msg.includes('ECONNREFUSED') ||
      msg.includes("Can't reach database") ||
      msg.includes('P1001')
    ) {
      console.log('\n⚠️  BD no disponible — tests de flujo omitidos (aplicar migración 20260626160000_compras_fase_a cuando haya PostgreSQL)')
      process.exit(errors.length ? 1 : 0)
    }
    throw e
  }

  if (!usuario) {
    fail('No hay usuario activo en BD — omitiendo tests de flujo')
    process.exit(errors.length ? 1 : 0)
  }

  let provRemito = await prisma.proveedor.findFirst({ where: { tipoCompra: 'REMITO', activo: true } })
  if (!provRemito) {
    provRemito = await prisma.proveedor.create({
      data: { razonSocial: 'Test Remito ' + Date.now(), tipoCompra: 'REMITO' },
    })
    pass('proveedor REMITO de prueba creado')
  } else {
    pass('proveedor REMITO existente')
  }

  let provConceptos = await prisma.proveedor.findFirst({ where: { tipoCompra: 'CONCEPTOS', activo: true } })
  if (!provConceptos) {
    provConceptos = await prisma.proveedor.create({
      data: { razonSocial: 'Test Conceptos ' + Date.now(), tipoCompra: 'CONCEPTOS' },
    })
    pass('proveedor CONCEPTOS de prueba creado')
  }

  const filtrados = await prisma.proveedor.findMany({
    where: { activo: true, ...filtroProveedorPorTipoCompra('REMITO') },
  })
  if (filtrados.some((p) => p.id === provRemito!.id)) pass('filtro tipoCompra REMITO en BD')
  else fail('filtro tipoCompra REMITO no incluye proveedor esperado')

  const numero = 'TEST-OC-' + Date.now()
  const oc = await prisma.ordenCompra.create({
    data: {
      numero,
      proveedorId: provRemito.id,
      estado: 'BORRADOR',
      subtotal: 500,
      total: 500,
      creadoPorId: usuario.id,
      items: {
        create: [{
          descripcion: 'Ítem test',
          concepto: null,
          cantidad: 5,
          precioUnit: 100,
          subtotal: 500,
        }],
      },
    },
  })
  pass('OC borrador creada')

  const enviada = await prisma.ordenCompra.update({
    where: { id: oc.id },
    data: { estado: 'PENDIENTE_APROBACION', enviadaAprobacionEn: new Date() },
  })
  if (enviada.estado === 'PENDIENTE_APROBACION') pass('OC enviada a aprobación')
  else fail('estado PENDIENTE_APROBACION')

  if (aprobador) {
    const aprobada = await prisma.ordenCompra.update({
      where: { id: oc.id },
      data: { estado: 'APROBADA', aprobadoPorId: aprobador.id, aprobadoEn: new Date() },
    })
    if (aprobada.estado === 'APROBADA') pass('OC aprobada por ' + aprobador.email)
    else fail('aprobación OC')
  } else {
    fail('No se encontró aprobador seed (cesar/guille/lucas)')
  }

  // Flujo rechazo en OC separada
  const ocRech = await prisma.ordenCompra.create({
    data: {
      numero: numero + '-R',
      proveedorId: provConceptos.id,
      estado: 'PENDIENTE_APROBACION',
      subtotal: 200,
      total: 200,
      creadoPorId: usuario.id,
      enviadaAprobacionEn: new Date(),
      items: {
        create: [{
          descripcion: 'Gasto test',
          concepto: 'Servicio',
          cantidad: 1,
          precioUnit: 200,
          subtotal: 200,
        }],
      },
    },
  })

  const rechazada = await prisma.ordenCompra.update({
    where: { id: ocRech.id },
    data: {
      estado: 'RECHAZADA',
      rechazadoMotivo: 'Fuera de presupuesto',
      rechazadoPorId: aprobador?.id ?? usuario.id,
      rechazadoEn: new Date(),
    },
  })
  if (rechazada.estado === 'RECHAZADA' && rechazada.rechazadoMotivo) pass('OC rechazada con motivo')
  else fail('rechazo OC')

  // Cleanup
  await prisma.itemOrdenCompra.deleteMany({ where: { ordenCompraId: { in: [oc.id, ocRech.id] } } })
  await prisma.ordenCompra.deleteMany({ where: { id: { in: [oc.id, ocRech.id] } } })
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
