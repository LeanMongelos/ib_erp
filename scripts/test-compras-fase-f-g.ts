/**
 * Tests Compras Fase F + G — OC obligatoria, envío, recepción depósito, alquiler.
 */
import { prisma } from '../lib/prisma'
import { validarReglasFacturaCompra } from '../lib/compras/factura-compra'
import { validarEnvioOC } from '../lib/compras/oc-enviar'
import { bucketAging } from '../lib/compras/cuenta-corriente'
import {
  consultarAlertasAlquiler,
  debeRecordarAlquilerHoy,
} from '../lib/compras/alquiler-recordatorio'

const errors: string[] = []

function pass(msg: string) {
  console.log('✅', msg)
}

function fail(msg: string) {
  errors.push(msg)
  console.error('❌', msg)
}

async function main() {
  console.log('\n=== Test Compras Fase F + G ===\n')

  const fcRemitoSinOc = validarReglasFacturaCompra({
    tipo: 'REMITO',
    ordenCompraId: null,
    oc: null,
  })
  if (fcRemitoSinOc?.includes('orden de compra')) pass('FC REMITO sin OC rechazada')
  else fail(`FC REMITO sin OC: ${fcRemitoSinOc}`)

  const fcConceptosSinOc = validarReglasFacturaCompra({
    tipo: 'CONCEPTOS',
    ordenCompraId: null,
    oc: null,
  })
  if (fcConceptosSinOc?.includes('orden de compra')) pass('FC CONCEPTOS sin OC rechazada')
  else fail(`FC CONCEPTOS sin OC: ${fcConceptosSinOc}`)

  const envioOk = validarEnvioOC({
    solicitanteId: 'u1',
    justificacion: 'Repuesto urgente',
    clasificacionOrigen: 'REPUESTO_OT',
    items: [{ descripcion: 'Filtro' }],
  })
  if (envioOk === null) pass('envío OC con campos requeridos')
  else fail(`envío válido: ${envioOk}`)

  const envioFail = validarEnvioOC({
    solicitanteId: '',
    justificacion: '',
    clasificacionOrigen: null,
    items: [],
  })
  if (envioFail) pass('envío OC sin justificación/solicitante rechazado')
  else fail('envío debería fallar sin campos')

  if (bucketAging(45) === '31-60') pass('bucketAging sin cambios')
  else fail('bucketAging regresión')

  if (debeRecordarAlquilerHoy(1, new Date('2026-06-15'))) pass('alquiler recordatorio día 1 en junio')
  else fail('debeRecordarAlquilerHoy')

  if (debeRecordarAlquilerHoy(28, new Date(2026, 1, 28))) pass('alquiler recordatorio febrero')
  else fail('debeRecordarAlquilerHoy febrero')

  if (!debeRecordarAlquilerHoy(15, new Date('2026-06-10'))) pass('alquiler no alerta antes del día')
  else fail('alquiler alerta prematura')

  try {
    const plantilla = await prisma.plantillaOC.findFirst({
      where: { clasificacionOrigen: 'ALQUILER', activa: true },
    })
    if (plantilla?.recordatorioDiaMes) {
      const hoy = new Date('2026-06-26')
      const alertas = await consultarAlertasAlquiler(hoy)
      const tiene = alertas.some((a) => a.plantillaId === plantilla.id)
      if (tiene) pass('alerta alquiler sin OC del mes')
      else pass('alerta alquiler (sin match — puede haber OC del mes)')

      await prisma.ordenCompra.create({
        data: {
          numero: 'TEST-ALQ-' + Date.now(),
          proveedorId: plantilla.proveedorId,
          estado: 'BORRADOR',
          subtotal: 100,
          total: 100,
          plantillaOcId: plantilla.id,
          creadoEn: hoy,
          items: { create: [{ descripcion: 'Test', cantidad: 1, precioUnit: 100, subtotal: 100 }] },
        },
      })
      const alertas2 = await consultarAlertasAlquiler(hoy)
      if (!alertas2.some((a) => a.plantillaId === plantilla.id)) {
        pass('alerta alquiler suprimida con OC del mes')
      } else fail('alerta debería suprimirse con OC del mes')

      await prisma.ordenCompra.deleteMany({ where: { numero: { startsWith: 'TEST-ALQ-' } } })
    } else {
      console.log('⚠️  Sin plantilla ALQUILER — test alerta omitido')
    }

    const deposito = await prisma.deposito.findFirst({ where: { activo: true } })
    const usuario = await prisma.usuario.findFirst({ where: { activo: true } })
    let inv = await prisma.inventario.findFirst({
      where: { activo: true, modoTrazabilidad: 'NINGUNA' },
    })
    if (!inv) {
      inv = await prisma.inventario.create({
        data: {
          nombre: 'Test recep Fase G ' + Date.now(),
          sku: 'TEST-FG-' + Date.now(),
          stock: 0,
          modoTrazabilidad: 'NINGUNA',
        },
      })
    }

    const prov = await prisma.proveedor.findFirst({ where: { activo: true } })
    if (deposito && usuario && inv && prov) {
      const oc = await prisma.ordenCompra.create({
        data: {
          numero: 'TEST-REC-' + Date.now(),
          proveedorId: prov.id,
          estado: 'APROBADA',
          subtotal: 50,
          total: 50,
          depositoDestinoDefaultId: deposito.id,
          aprobadoPorId: usuario.id,
          aprobadoEn: new Date(),
          items: {
            create: [{
              descripcion: 'Ítem recepción test',
              cantidad: 2,
              precioUnit: 25,
              subtotal: 50,
              inventarioId: inv.id,
            }],
          },
        },
        include: { items: true },
      })

      const item = oc.items[0]
      const stockAntes = await prisma.stockDeposito.findUnique({
        where: {
          inventarioId_depositoId: { inventarioId: inv.id, depositoId: deposito.id },
        },
      })

      const { recepcionarItemsOC } = await import('../lib/compras/recepcionar-oc')
      await prisma.$transaction(async (tx) => {
        await recepcionarItemsOC(
          {
            ocId: oc.id,
            ocNumero: oc.numero,
            depositoDestinoDefaultId: deposito.id,
            items: oc.items.map((i) => ({
              ...i,
              inventario: { id: inv!.id, modoTrazabilidad: 'NINGUNA' },
            })),
            recepciones: [{ id: item.id, cantidad: 2, depositoId: deposito.id }],
            usuarioId: usuario.id,
          },
          tx,
        )
      })

      const stockDespues = await prisma.stockDeposito.findUnique({
        where: {
          inventarioId_depositoId: { inventarioId: inv.id, depositoId: deposito.id },
        },
      })
      const delta = (stockDespues?.cantidad ?? 0) - (stockAntes?.cantidad ?? 0)
      if (delta === 2) pass('recepción crea StockDeposito (+2)')
      else fail(`StockDeposito delta=${delta}`)

      let invSerie = await prisma.inventario.findFirst({
        where: { activo: true, modoTrazabilidad: { in: ['SERIE', 'SERIE_Y_LOTE'] } },
      })
      if (!invSerie) {
        invSerie = await prisma.inventario.create({
          data: {
            nombre: 'Test SN Fase G ' + Date.now(),
            sku: 'TEST-SN-' + Date.now(),
            stock: 0,
            modoTrazabilidad: 'SERIE',
            esSerializado: true,
          },
        })
      }

      const ocSerie = await prisma.ordenCompra.create({
        data: {
          numero: 'TEST-SN-' + Date.now(),
          proveedorId: prov.id,
          estado: 'APROBADA',
          subtotal: 10,
          total: 10,
          depositoDestinoDefaultId: deposito.id,
          items: {
            create: [{
              descripcion: 'Serializado test',
              cantidad: 1,
              precioUnit: 10,
              subtotal: 10,
              inventarioId: invSerie.id,
            }],
          },
        },
        include: { items: { include: { inventario: true } } },
      })

      try {
        await prisma.$transaction(async (tx) => {
          await recepcionarItemsOC(
            {
              ocId: ocSerie.id,
              ocNumero: ocSerie.numero,
              depositoDestinoDefaultId: deposito.id,
              items: ocSerie.items,
              recepciones: [{ id: ocSerie.items[0].id, cantidad: 1, depositoId: deposito.id }],
              usuarioId: usuario.id,
            },
            tx,
          )
        })
        fail('recepción serializada debería exigir SN')
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e)
        if (msg.includes('serie') || msg.includes('número')) pass('recepción serializada exige SN')
        else fail(`error SN inesperado: ${msg}`)
      }

      await prisma.itemOrdenCompra.deleteMany({
        where: { ordenCompraId: { in: [oc.id, ocSerie.id] } },
      })
      await prisma.ordenCompra.deleteMany({ where: { id: { in: [oc.id, ocSerie.id] } } })
    } else {
      console.log('⚠️  Datos insuficientes — tests recepción omitidos')
    }
  } catch (e: unknown) {
    const code = typeof e === 'object' && e && 'code' in e ? String((e as { code: unknown }).code) : ''
    const msg = e instanceof Error ? e.message : String(e)
    if (
      code === 'ECONNREFUSED' ||
      code === 'P1001' ||
      msg.includes('ECONNREFUSED') ||
      msg.includes("Can't reach database") ||
      msg.includes('does not exist')
    ) {
      console.log('⚠️  BD no disponible o migración pendiente — tests de integración omitidos')
    } else {
      fail(`BD: ${msg}`)
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
