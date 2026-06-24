/**
 * Chequeos de integridad post-deploy (solo lectura + conteos).
 * Errores → exit 1 (bloquea deploy). Advertencias → log y exit 0.
 *
 * Uso: npx tsx --env-file=.env scripts/integridad-prod.ts
 */
import { prisma } from '../lib/prisma'
import { emisorTieneCertificados } from '../lib/afip/validar-emision'

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

async function checkFacturasEmitidasPlantilla() {
  const count = await prisma.factura.count({
    where: {
      plantillaId: null,
      estado: { in: ['EMITIDA', 'PAGADA', 'VENCIDA'] },
    },
  })
  if (count === 0) {
    ok('Facturas emitidas/cobradas: todas con plantillaId')
  } else {
    error(`${count} factura(s) EMITIDA/PAGADA/VENCIDA sin plantillaId — correr backfill-plantillas-documentos`)
  }
}

async function checkPresupuestoConvertidoSinFactura() {
  const count = await prisma.presupuesto.count({
    where: {
      estado: 'CONVERTIDO',
      factura: { is: null },
    },
  })
  if (count === 0) {
    ok('Presupuestos CONVERTIDO: todos vinculados a factura')
  } else {
    error(`${count} presupuesto(s) CONVERTIDO sin factura vinculada`)
  }
}

async function checkPresupuestosVigenciaVencida() {
  const ahora = new Date()
  const count = await prisma.presupuesto.count({
    where: {
      estado: { in: ['ENVIADO', 'APROBADO'] },
      fechaVencimiento: { lt: ahora },
    },
  })
  if (count === 0) {
    ok('Presupuestos ENVIADO/APROBADO: ninguno con vigencia vencida sin marcar VENCIDO')
  } else {
    warn(
      `${count} presupuesto(s) ENVIADO/APROBADO con fechaVencimiento pasada — ejecutar actualizarPresupuestosVencidos (cron o npm run cron:presupuestos-vencidos)`,
    )
  }
}

async function checkEmisoresProduccionCertificados() {
  const emisores = await prisma.emisor.findMany({
    where: { ambiente: 'PRODUCCION', activo: true },
    select: { razonSocial: true, certificadoPath: true, clavePrivadaPath: true },
  })

  if (emisores.length === 0) {
    ok('AFIP: sin emisor activo en PRODUCCION')
    return
  }

  const sinCert = emisores.filter((e) => !emisorTieneCertificados(e))
  if (sinCert.length === 0) {
    ok(`AFIP: ${emisores.length} emisor(es) PRODUCCION con certificados`)
  } else {
    error(
      `AFIP PRODUCCION: ${sinCert.map((e) => e.razonSocial).join(', ')} sin certificado/clave — bloquea emisión fiscal`,
    )
  }
}

async function checkFacturasEmitidasSinCae() {
  const count = await prisma.factura.count({
    where: {
      estado: { in: ['EMITIDA', 'PAGADA', 'VENCIDA'] },
      OR: [{ cae: null }, { cae: '' }],
    },
  })

  if (count === 0) {
    ok('Facturas emitidas/cobradas: todas con CAE')
    return
  }

  const emisorProduccion = await prisma.emisor.count({
    where: { ambiente: 'PRODUCCION', activo: true },
  })

  const msg = `${count} factura(s) EMITIDA/PAGADA/VENCIDA sin CAE — emitir en AFIP o corregir estado`

  if (emisorProduccion > 0) {
    error(msg)
  } else {
    warn(`${msg} (homologación: advertencia; en producción fiscal sería error)`)
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

async function checkOtSlaVencido() {
  const ahora = new Date()

  const [estadoDesactualizado, abiertasVencidas] = await Promise.all([
    prisma.ordenTrabajo.count({
      where: {
        estado: { in: ['ABIERTA', 'EN_PROCESO'] },
        slaVence: { lt: ahora },
      },
    }),
    prisma.ordenTrabajo.count({
      where: {
        estado: { notIn: ['CERRADA', 'CANCELADA'] },
        slaVence: { lt: ahora },
      },
    }),
  ])

  if (estadoDesactualizado === 0) {
    ok('OTs: ninguna ABIERTA/EN_PROCESO con SLA vencido sin marcar VENCIDA')
  } else {
    warn(
      `${estadoDesactualizado} OT(s) ABIERTA/EN_PROCESO con SLA vencido — ejecutar actualizarOTsVencidas al listar`,
    )
  }

  if (abiertasVencidas === 0) {
    ok('OTs: ninguna abierta con SLA vencido')
  } else {
    warn(`${abiertasVencidas} OT(s) no cerradas con SLA vencido (incluye VENCIDA)`)
  }
}

async function checkConversacionesHuerfanas() {
  const count = await prisma.conversacionCRM.count({
    where: {
      clienteId: null,
      estado: { in: ['ABIERTA', 'PENDIENTE'] },
    },
  })

  if (count === 0) {
    ok('CRM: conversaciones abiertas vinculadas a cliente')
  } else {
    warn(`${count} conversación(es) CRM abierta(s) sin clienteId — vincular o cerrar`)
  }
}

async function checkDuplicadosPredeterminado() {
  let dupPlantillas = 0
  for (const tipo of ['FACTURA', 'PRESUPUESTO'] as const) {
    const rows = await prisma.plantillaImpresion.findMany({
      where: { tipo, predeterminado: true, activo: true },
      select: { id: true, nombre: true },
    })
    if (rows.length > 1) {
      dupPlantillas++
      warn(
        `${tipo}: ${rows.length} predeterminadas activas (${rows.map((r) => r.nombre).join(', ')})`,
      )
    }
  }
  if (dupPlantillas === 0) {
    ok('Plantillas: sin duplicados predeterminado activo por tipo')
  }

  const emisoresDup = await prisma.emisor.findMany({
    where: { predeterminado: true, activo: true },
    select: { id: true, razonSocial: true },
  })
  if (emisoresDup.length <= 1) {
    ok('Emisores: predeterminado activo único o ninguno')
  } else {
    warn(
      `${emisoresDup.length} emisores predeterminados activos: ${emisoresDup.map((e) => e.razonSocial).join(', ')}`,
    )
  }

  const listasDup = await prisma.listaPrecios.findMany({
    where: { predeterminada: true, activo: true },
    select: { id: true, nombre: true },
  })
  if (listasDup.length <= 1) {
    ok('Listas de precios: predeterminada activa única o ninguna')
  } else {
    warn(
      `${listasDup.length} listas predeterminadas activas: ${listasDup.map((l) => l.nombre).join(', ')}`,
    )
  }
}

async function checkNegociosEmbudoSinCliente() {
  const count = await prisma.negocioEmbudo.count({
    where: {
      activo: true,
      etapa: { not: 'CIERRE' },
      clienteId: null,
    },
  })

  if (count === 0) {
    ok('Embudo: negocios activos vinculados a cliente en BD')
  } else {
    warn(`${count} negocio(s) embudo activo(s) sin clienteId — solo texto libre en campo cliente`)
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

async function checkCuotasVencidasSinAviso() {
  const ahora = new Date()
  const count = await prisma.vencimientoCobranza.count({
    where: {
      estado: 'PENDIENTE',
      fechaVencimiento: { lt: ahora },
      factura: { estado: { in: ['EMITIDA', 'VENCIDA', 'PAGADA'] } },
    },
  })

  if (count === 0) {
    ok('Cobranzas: ninguna cuota vencida PENDIENTE sin aviso')
  } else {
    warn(
      `${count} cuota(s) vencida(s) en estado PENDIENTE — ejecutar cron cobranzas (POST /api/cron/cobranzas-vencimientos)`,
    )
  }
}

async function checkStockMinimo() {
  const { listarArticulosStockBajo } = await import('../lib/inventario/alerta-stock-minimo')
  const bajos = await listarArticulosStockBajo()

  if (bajos.length === 0) {
    ok('Inventario: ningún artículo activo bajo stock mínimo')
  } else {
    const sinStock = bajos.filter((i) => i.stock === 0).length
    warn(
      `${bajos.length} artículo(s) con stock ≤ mínimo (${sinStock} sin stock) — cron stock-minimo o revisar inventario`,
    )
  }
}

async function main() {
  console.log('\n=== Integridad producción ===\n')

  await checkPlantillaPredeterminada()
  await checkPlantillaSnapshot()
  await checkFacturasEmitidasPlantilla()
  await checkEmisoresProduccionCertificados()
  await checkFacturasEmitidasSinCae()
  await checkPresupuestoConvertidoSinFactura()
  await checkPresupuestosVigenciaVencida()
  await checkEquiposSinSucursal()
  await checkOtCierreStock()
  await checkOtSlaVencido()
  await checkConversacionesHuerfanas()
  await checkDuplicadosPredeterminado()
  await checkNegociosEmbudoSinCliente()
  await checkConfigOperativa()
  await checkUsuariosActivos()
  await checkCuotasVencidasSinAviso()
  await checkStockMinimo()

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
