/**
 * Chequeos de integridad post-deploy (solo lectura + conteos).
 * Errores → exit 1 (bloquea deploy). Advertencias → log y exit 0.
 *
 * Uso: npx tsx --env-file=.env scripts/integridad-prod.ts
 */
import { prisma } from '../lib/prisma'

type Resultado = { nivel: 'ok' | 'warn' | 'error'; msg: string }

const resultados: Resultado[] = []

function ok(msg: string) {
  resultados.push({ nivel: 'ok', msg })
  console.log('✅', msg)
}

function warn(msg: string) {
  resultados.push({ nivel: 'warn', msg })
  console.warn('⚠️ ', msg)
}

function error(msg: string) {
  resultados.push({ nivel: 'error', msg })
  console.error('❌', msg)
}

async function checkPlantillaPredeterminada() {
  for (const tipo of ['FACTURA', 'PRESUPUESTO'] as const) {
    const count = await prisma.plantillaImpresion.count({
      where: { tipo, predeterminado: true, activo: true },
    })
    if (count === 1) {
      ok(`Plantilla predeterminada activa para ${tipo}`)
    } else {
      warn(`${tipo}: ${count} plantilla(s) predeterminada(s) activa(s) (esperado 1)`)
    }
  }
}

async function checkPlantillaSnapshot() {
  const [sinFactura, sinPresup] = await Promise.all([
    prisma.factura.count({ where: { plantillaId: null } }),
    prisma.presupuesto.count({ where: { plantillaId: null } }),
  ])
  if (sinFactura === 0 && sinPresup === 0) {
    ok('Todos los documentos tienen plantillaId')
  } else {
    warn(`${sinFactura} factura(s) y ${sinPresup} presupuesto(s) sin plantillaId — correr backfill`)
  }
}

async function checkEquiposSinSucursal() {
  const count = await prisma.itemFactura.count({
    where: {
      sucursalInstalacionId: null,
      inventario: { tipoArticulo: 'EQUIPO' },
      factura: { estado: { notIn: ['BORRADOR', 'ANULADA', 'RECHAZADA'] } },
    },
  })
  if (count === 0) {
    ok('Facturas emitidas: equipos con sucursal de instalación')
  } else {
    error(`${count} ítem(s) EQUIPO en facturas emitidas sin sucursalInstalacionId`)
  }
}

async function checkOtCierreStock() {
  const ots = await prisma.ordenTrabajo.findMany({
    where: {
      estado: 'CERRADA',
      repuestos: { some: { inventarioId: { not: null } } },
    },
    select: { id: true, numero: true },
    take: 200,
    orderBy: { fechaCierre: 'desc' },
  })

  let sinMovimiento = 0
  for (const ot of ots) {
    const movs = await prisma.movimientoStock.count({
      where: { referencia: `ot:${ot.id}:cierre` },
    })
    if (movs === 0) sinMovimiento++
  }

  if (sinMovimiento === 0) {
    ok(`OTs cerradas con repuestos (${ots.length} revisadas): movimientos de stock OK`)
  } else {
    warn(`${sinMovimiento} OT(s) cerradas con repuestos de inventario sin movimiento ot:*:cierre`)
  }
}

async function checkConfigOperativa() {
  const [emisoresPred, listasPred, cfg] = await Promise.all([
    prisma.emisor.count({ where: { predeterminado: true, activo: true } }),
    prisma.listaPrecios.count({ where: { predeterminada: true, activo: true } }),
    prisma.configuracionContable.findUnique({ where: { id: 'default' } }),
  ])

  if (emisoresPred === 1) ok('Un emisor predeterminado activo')
  else warn(`Emisores predeterminados activos: ${emisoresPred} (esperado 1)`)

  if (listasPred >= 1) ok(`${listasPred} lista(s) de precios predeterminada(s)`)
  else warn('Sin lista de precios predeterminada activa')

  if (cfg?.cotizacionUsdManual && cfg.cotizacionUsdManual > 0) {
    ok('Cotización USD manual configurada')
  } else {
    warn('Sin cotización USD en contabilidad — documentos USD requieren ingreso manual')
  }
}

async function checkUsuariosActivos() {
  const usuarios = await prisma.usuario.findMany({
    where: { activo: true },
    select: { email: true },
  })
  const legacy = usuarios.filter((u) => u.email.endsWith('@ibiomedica.com'))
  if (legacy.length === 0) {
    ok(`${usuarios.length} usuario(s) activo(s) sin emails legacy @ibiomedica.com`)
  } else {
    warn(`${legacy.length} usuario(s) activo(s) aún con @ibiomedica.com — correr migrate-emails`)
  }
}

async function main() {
  console.log('\n=== Integridad producción ===\n')

  await checkPlantillaPredeterminada()
  await checkPlantillaSnapshot()
  await checkEquiposSinSucursal()
  await checkOtCierreStock()
  await checkConfigOperativa()
  await checkUsuariosActivos()

  const errs = resultados.filter((r) => r.nivel === 'error')
  const warns = resultados.filter((r) => r.nivel === 'warn')
  const oks = resultados.filter((r) => r.nivel === 'ok')

  console.log(`\n--- ${oks.length} OK | ${warns.length} advertencias | ${errs.length} errores ---\n`)

  if (errs.length > 0) {
    process.exit(1)
  }
  console.log('Integridad OK (con advertencias si las hubo)\n')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
