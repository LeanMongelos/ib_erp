/**
 * Tests Inventario Fase L — Polo Científico, transferencias, reporte stock.
 */
import { prisma } from '../lib/prisma'
import { seedDepositosBase } from '../lib/inventario/seed-depositos'
import { transferirStockEntreDepositos } from '../lib/inventario/transferir-stock'
import { consultarStockPorDeposito } from '../lib/inventario/stock-por-deposito-report'
import { ajustarStockDeposito } from '../lib/inventario/stock-deposito'

const errors: string[] = []

function pass(msg: string) {
  console.log('✅', msg)
}

function fail(msg: string) {
  errors.push(msg)
  console.error('❌', msg)
}

async function main() {
  console.log('\n=== Test Inventario Fase L ===\n')

  try {
    await seedDepositosBase()
  } catch (e: unknown) {
    const code = typeof e === 'object' && e && 'code' in e ? String((e as { code: unknown }).code) : ''
    const msg = e instanceof Error ? e.message : String(e)
    if (code === 'ECONNREFUSED' || code === 'P1001' || msg.includes('ECONNREFUSED')) {
      console.log('⚠️  BD no disponible — tests omitidos')
      return
    }
    throw e
  }

  const polo = await prisma.deposito.findUnique({ where: { id: 'seed-deposito-polo-cientifico' } })
  if (polo?.nombre === 'Polo Científico' && polo.tipo === 'DEPOSITO') {
    pass('seed Polo Científico existe')
  } else {
    fail(`Polo Científico: ${JSON.stringify(polo)}`)
  }

  const showroom = await prisma.deposito.findUnique({ where: { id: 'seed-deposito-showroom' } })
  const deposito = await prisma.deposito.findUnique({ where: { id: 'seed-deposito-principal' } })
  if (!showroom || !deposito) {
    console.log('⚠️  Depósitos base no encontrados — tests de integración omitidos')
    console.log('\n---')
    if (errors.length) process.exit(1)
    console.log('Checks estáticos OK.')
    return
  }

  try {
    const usuario = await prisma.usuario.findFirst({ where: { activo: true } })
    if (!usuario) {
      console.log('⚠️  Sin usuario — tests de integración omitidos')
    } else {
      const invBulk = await prisma.inventario.create({
        data: {
          nombre: `Test bulk Fase L ${Date.now()}`,
          sku: `TL${String(Date.now()).slice(-6)}`,
          tipoArticulo: 'REPUESTO',
          modoTrazabilidad: 'NINGUNA',
          stock: 0,
          stockMinimo: 1,
        },
      })

      await ajustarStockDeposito({
        inventarioId: invBulk.id,
        depositoId: showroom.id,
        delta: 10,
      })

      await transferirStockEntreDepositos({
        inventarioId: invBulk.id,
        depositoOrigenId: showroom.id,
        depositoDestinoId: polo!.id,
        cantidad: 4,
        usuarioId: usuario.id,
      })

      const stockShowroom = await prisma.stockDeposito.findUnique({
        where: {
          inventarioId_depositoId: { inventarioId: invBulk.id, depositoId: showroom.id },
        },
      })
      const stockPolo = await prisma.stockDeposito.findUnique({
        where: {
          inventarioId_depositoId: { inventarioId: invBulk.id, depositoId: polo!.id },
        },
      })

      if (stockShowroom?.cantidad === 6 && stockPolo?.cantidad === 4) {
        pass('transfer bulk no serializado entre depósitos')
      } else {
        fail(`stock post-transfer bulk: showroom=${stockShowroom?.cantidad} polo=${stockPolo?.cantidad}`)
      }

      const invSerie = await prisma.inventario.create({
        data: {
          nombre: `Test serie Fase L ${Date.now()}`,
          sku: `TS${String(Date.now()).slice(-6)}`,
          tipoArticulo: 'EQUIPO',
          modoTrazabilidad: 'SERIE',
          esSerializado: true,
          stock: 0,
          stockMinimo: 0,
        },
      })

      const unidad = await prisma.inventarioUnidad.create({
        data: {
          inventarioId: invSerie.id,
          numeroSerie: `SN-L-${Date.now()}`,
          estado: 'EN_STOCK',
          depositoId: showroom.id,
        },
      })
      await prisma.inventario.update({ where: { id: invSerie.id }, data: { stock: 1 } })

      await transferirStockEntreDepositos({
        inventarioId: invSerie.id,
        depositoOrigenId: showroom.id,
        depositoDestinoId: polo!.id,
        unidadIds: [unidad.id],
        usuarioId: usuario.id,
      })

      const unidadMovida = await prisma.inventarioUnidad.findUnique({ where: { id: unidad.id } })
      if (unidadMovida?.depositoId === polo!.id) {
        pass('transfer unidad serializada por id')
      } else {
        fail(`unidad no movida: depositoId=${unidadMovida?.depositoId}`)
      }

      const reporte = await consultarStockPorDeposito({ depositoId: polo!.id })
      const tieneBulk = reporte.some((f) => f.inventarioId === invBulk.id && f.cantidad === 4)
      const tieneSerie = reporte.some((f) => f.unidadId === unidad.id)
      if (tieneBulk && tieneSerie) {
        pass('reporte stock por depósito (Polo Científico)')
      } else {
        fail(`reporte incompleto: bulk=${tieneBulk} serie=${tieneSerie}`)
      }

      await prisma.inventarioUnidad.deleteMany({ where: { inventarioId: invSerie.id } })
      await prisma.stockDeposito.deleteMany({ where: { inventarioId: { in: [invBulk.id, invSerie.id] } } })
      await prisma.movimientoStock.deleteMany({ where: { inventarioId: { in: [invBulk.id, invSerie.id] } } })
      await prisma.inventario.deleteMany({ where: { id: { in: [invBulk.id, invSerie.id] } } })
    }
  } catch (e: unknown) {
    const code = typeof e === 'object' && e && 'code' in e ? String((e as { code: unknown }).code) : ''
    const msg = e instanceof Error ? e.message : String(e)
    if (
      code === 'ECONNREFUSED' ||
      code === 'P1001' ||
      msg.includes('ECONNREFUSED') ||
      msg.includes("Can't reach database")
    ) {
      console.log('⚠️  BD no disponible — tests de integración omitidos')
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

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
