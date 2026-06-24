/**
 * Reparación opcional de advertencias I2–I5 (y Pr3 presupuestos vencidos).
 * Por defecto solo informa (--dry-run). Con --execute aplica correcciones seguras.
 *
 * Uso:
 *   npm run integridad:reparar              # dry-run (default)
 *   npm run integridad:reparar -- --execute # aplicar fixes seguros
 *   npm run integridad:reparar -- --execute --only I2,Pr3
 */
import { prisma } from '../lib/prisma'
import { actualizarOTsVencidas } from '../lib/ots'
import { actualizarPresupuestosVencidos } from '../lib/presupuestos/actualizar-vencidos'
import { criterioPresupuestosVencidos } from '../lib/presupuestos/vencimiento'

type Hallazgo = {
  codigo: string
  cantidad: number
  mensaje: string
  sugerencia: string
  autoReparable: boolean
}

const hallazgos: Hallazgo[] = []

function registrar(h: Hallazgo) {
  hallazgos.push(h)
  const icon = h.autoReparable ? '🔧' : '📋'
  console.log(`${icon} [${h.codigo}] ${h.mensaje}`)
  console.log(`   Sugerencia: ${h.sugerencia}`)
}

async function checkI2() {
  const ahora = new Date()
  const count = await prisma.ordenTrabajo.count({
    where: {
      estado: { in: ['ABIERTA', 'EN_PROCESO'] },
      slaVence: { lt: ahora },
    },
  })

  if (count === 0) {
    console.log('✅ [I2] OTs: ninguna ABIERTA/EN_PROCESO con SLA vencido')
    return
  }

  registrar({
    codigo: 'I2',
    cantidad: count,
    mensaje: `${count} OT(s) ABIERTA/EN_PROCESO con SLA vencido sin marcar VENCIDA`,
    sugerencia:
      'await prisma — actualizarOTsVencidas() o npm run cron:ots-vencidas',
    autoReparable: true,
  })
}

async function checkPr3() {
  const count = await prisma.presupuesto.count({
    where: criterioPresupuestosVencidos(),
  })

  if (count === 0) {
    console.log('✅ [Pr3] Presupuestos: ninguno ENVIADO/APROBADO con vigencia vencida')
    return
  }

  registrar({
    codigo: 'Pr3',
    cantidad: count,
    mensaje: `${count} presupuesto(s) ENVIADO/APROBADO con fechaVencimiento pasada`,
    sugerencia:
      'UPDATE estado=VENCIDO — actualizarPresupuestosVencidos() o npm run cron:presupuestos-vencidos',
    autoReparable: true,
  })
}

async function checkI3() {
  const count = await prisma.conversacionCRM.count({
    where: {
      clienteId: null,
      estado: { in: ['ABIERTA', 'PENDIENTE'] },
    },
  })

  if (count === 0) {
    console.log('✅ [I3] CRM: conversaciones abiertas vinculadas a cliente')
    return
  }

  registrar({
    codigo: 'I3',
    cantidad: count,
    mensaje: `${count} conversación(es) CRM abierta(s) sin clienteId`,
    sugerencia:
      'Vincular manualmente en /crm/inbox o cerrar la conversación — no hay fix automático seguro',
    autoReparable: false,
  })
}

async function checkI4() {
  const problemas: string[] = []

  for (const tipo of ['FACTURA', 'PRESUPUESTO'] as const) {
    const rows = await prisma.plantillaImpresion.findMany({
      where: { tipo, predeterminado: true, activo: true },
      select: { nombre: true },
    })
    if (rows.length > 1) {
      problemas.push(`${tipo}: ${rows.length} predeterminadas (${rows.map((r) => r.nombre).join(', ')})`)
    }
  }

  const emisoresDup = await prisma.emisor.findMany({
    where: { predeterminado: true, activo: true },
    select: { razonSocial: true },
  })
  if (emisoresDup.length > 1) {
    problemas.push(`Emisores: ${emisoresDup.map((e) => e.razonSocial).join(', ')}`)
  }

  const listasDup = await prisma.listaPrecios.findMany({
    where: { predeterminada: true, activo: true },
    select: { nombre: true },
  })
  if (listasDup.length > 1) {
    problemas.push(`Listas: ${listasDup.map((l) => l.nombre).join(', ')}`)
  }

  if (problemas.length === 0) {
    console.log('✅ [I4] Predeterminados activos únicos por tipo')
    return
  }

  registrar({
    codigo: 'I4',
    cantidad: problemas.length,
    mensaje: problemas.join(' · '),
    sugerencia:
      'En /configuracion desmarcar predeterminado duplicado — requiere decisión del operador',
    autoReparable: false,
  })
}

async function checkI5() {
  const count = await prisma.negocioEmbudo.count({
    where: {
      activo: true,
      etapa: { not: 'CIERRE' },
      clienteId: null,
    },
  })

  if (count === 0) {
    console.log('✅ [I5] Embudo: negocios activos vinculados a cliente')
    return
  }

  registrar({
    codigo: 'I5',
    cantidad: count,
    mensaje: `${count} negocio(s) embudo activo(s) sin clienteId en BD`,
    sugerencia:
      'Vincular cliente en /crm/embudo — el campo texto libre no reemplaza clienteId',
    autoReparable: false,
  })
}

async function aplicarReparaciones() {
  const reparables = hallazgos.filter((h) => h.autoReparable)
  if (reparables.length === 0) {
    console.log('\nSin correcciones automáticas pendientes.\n')
    return
  }

  console.log('\n--- Aplicando correcciones seguras ---\n')

  if (reparables.some((h) => h.codigo === 'I2')) {
    const n = await actualizarOTsVencidas()
    console.log(`✅ [I2] ${n} OT(s) marcadas VENCIDA`)
  }

  if (reparables.some((h) => h.codigo === 'Pr3')) {
    const n = await actualizarPresupuestosVencidos()
    console.log(`✅ [Pr3] ${n} presupuesto(s) marcados VENCIDO`)
  }

  console.log('')
}

function parseOnlyCodes(): string[] | null {
  const idx = process.argv.indexOf('--only')
  if (idx >= 0) {
    const next = process.argv[idx + 1]
    if (next && !next.startsWith('--')) {
      return next.split(',').map((s) => s.trim()).filter(Boolean)
    }
  }
  const combined = process.argv.find((a) => a.startsWith('--only='))
  if (combined) {
    return combined.slice('--only='.length).split(',').map((s) => s.trim()).filter(Boolean)
  }
  const prefixed = process.argv.find((a) => a.startsWith('--only') && a.length > 6 && a !== '--only')
  if (prefixed) {
    return prefixed.replace('--only', '').split(',').map((s) => s.trim()).filter(Boolean)
  }
  return null
}

async function main() {
  const execute = process.argv.includes('--execute')
  const onlyCodes = parseOnlyCodes()
  const shouldRun = (codigo: string) => !onlyCodes || onlyCodes.includes(codigo)

  const mode = execute ? 'EJECUCIÓN' : 'DRY-RUN (solo informe)'
  const onlyLabel = onlyCodes ? ` · solo ${onlyCodes.join(',')}` : ''

  console.log(`\n=== Reparar integridad I2–I5 · ${mode}${onlyLabel} ===\n`)

  if (execute) {
    console.log('⚠️  Modo --execute: se aplicarán solo correcciones automáticas seguras.\n')
  } else {
    console.log('Modo dry-run. Para aplicar fixes seguros: npm run integridad:reparar -- --execute\n')
  }

  if (shouldRun('I2')) await checkI2()
  if (shouldRun('Pr3')) await checkPr3()
  if (shouldRun('I3')) await checkI3()
  if (shouldRun('I4')) await checkI4()
  if (shouldRun('I5')) await checkI5()

  const auto = hallazgos.filter((h) => h.autoReparable)
  const manual = hallazgos.filter((h) => !h.autoReparable)

  console.log(
    `\n--- ${hallazgos.length} hallazgo(s): ${auto.length} auto-reparable(s), ${manual.length} manual(es) ---\n`,
  )

  if (execute && auto.length > 0) {
    await aplicarReparaciones()
  } else if (!execute && auto.length > 0) {
    console.log(
      'Correcciones automáticas disponibles (I2, Pr3). Confirmá y ejecutá:\n  npm run integridad:reparar -- --execute\n',
    )
  }

  if (manual.length > 0) {
    console.log('Hallazgos que requieren intervención manual: I3, I4, I5 (ver sugerencias arriba).\n')
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
