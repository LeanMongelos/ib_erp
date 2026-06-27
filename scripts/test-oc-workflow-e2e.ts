/**
 * E2E flujo OC (workflow real): crear, enviar, aprobar/rechazar, notificaciones, eventos, timeline.
 * Ejecutar: npx tsx --env-file=.env scripts/test-oc-workflow-e2e.ts
 */
import { prisma } from '../lib/prisma'
import {
  aprobarOc,
  enviarOcAprobacion,
  rechazarOc,
  registrarOcCreada,
} from '../lib/compras/oc-workflow/aprobacion'
import { APROBADORES_OC_EMAILS } from '../lib/compras/oc-workflow/constants'
import { construirTimelineOc } from '../lib/compras/oc-workflow/timeline'

type StepResult = { step: string; ok: boolean; detail?: string }
const results: StepResult[] = []

function record(step: string, ok: boolean, detail?: string) {
  results.push({ step, ok, detail })
  const prefix = ok ? 'PASS' : 'FAIL'
  console.log(`${prefix} | ${step}${detail ? ` — ${detail}` : ''}`)
}

function printSummary() {
  console.log('\n=== Resumen ===')
  for (const r of results) {
    console.log(`${r.ok ? 'OK' : 'X'}  ${r.step}${r.detail ? `: ${r.detail}` : ''}`)
  }
  const failed = results.filter((r) => !r.ok).length
  console.log(`\nTotal: ${results.length} | Fallos: ${failed}`)
}

async function assertEvento(
  ordenCompraId: string,
  tipo: 'OC_CREADA' | 'OC_ENVIADA_APROBACION' | 'OC_APROBADA' | 'OC_RECHAZADA',
  label: string,
) {
  const ev = await prisma.eventoOrdenCompra.findFirst({
    where: { ordenCompraId, tipo },
  })
  record(label, !!ev, ev ? `evento ${tipo}` : `falta evento ${tipo}`)
}

async function cleanupOcIds(ids: string[]) {
  if (ids.length === 0) return
  await prisma.notificacionUsuario.deleteMany({ where: { ordenCompraId: { in: ids } } })
  await prisma.eventoOrdenCompra.deleteMany({ where: { ordenCompraId: { in: ids } } })
  await prisma.itemOrdenCompra.deleteMany({ where: { ordenCompraId: { in: ids } } })
  await prisma.ordenCompra.deleteMany({ where: { id: { in: ids } } })
}

async function ensureProveedorRemito() {
  let prov = await prisma.proveedor.findFirst({ where: { tipoCompra: 'REMITO', activo: true } })
  if (!prov) {
    prov = await prisma.proveedor.create({
      data: { razonSocial: `TEST Proveedor ${Date.now()}`, tipoCompra: 'REMITO' },
    })
  }
  return prov
}

async function main() {
  console.log('\n=== Test OC workflow E2E ===\n')
  const ocIds: string[] = []

  try {
    await prisma.$queryRaw`SELECT 1 as ok`
    record('Conexion PostgreSQL', true)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    record('Conexion PostgreSQL', false, msg)
    printSummary()
    process.exit(1)
  }

  const aprobadores = await prisma.usuario.findMany({
    where: { activo: true, email: { in: [...APROBADORES_OC_EMAILS] } },
    select: { id: true, email: true, nombre: true },
  })
  const emailsFound = aprobadores.map((u) => u.email)
  const missingApprovers = APROBADORES_OC_EMAILS.filter((e) => !emailsFound.includes(e))
  record(
    'Aprobadores seed (cesar/guillermo/lucas)',
    missingApprovers.length === 0,
    missingApprovers.length ? `faltan: ${missingApprovers.join(', ')}` : `${aprobadores.length} usuarios`,
  )

  const solicitante =
    (await prisma.usuario.findFirst({
      where: {
        activo: true,
        email: { notIn: [...APROBADORES_OC_EMAILS] },
      },
    })) ?? (await prisma.usuario.findFirst({ where: { activo: true } }))

  const aprobadorActor = aprobadores.find((u) => u.email === 'cesar@ib.com') ?? aprobadores[0]

  if (!solicitante) {
    record('Usuario solicitante', false, 'no hay usuario activo')
    printSummary()
    process.exit(1)
  }
  record('Usuario solicitante', true, solicitante.email ?? solicitante.id)

  if (!aprobadorActor) {
    record('Usuario aprobador', false, 'sin aprobadores en BD')
    printSummary()
    process.exit(1)
  }
  record('Usuario aprobador', true, aprobadorActor.email)

  const proveedor = await ensureProveedorRemito()
  const numero = `TEST-${Date.now()}`

  const oc = await prisma.ordenCompra.create({
    data: {
      numero,
      proveedorId: proveedor.id,
      estado: 'BORRADOR',
      subtotal: 1000,
      total: 1000,
      creadoPorId: solicitante.id,
      solicitanteId: solicitante.id,
      justificacion: 'Prueba E2E workflow OC',
      clasificacionOrigen: 'STOCK_REPOSICION',
      items: {
        create: [
          {
            descripcion: 'Repuesto test E2E',
            cantidad: 2,
            precioUnit: 500,
            subtotal: 1000,
          },
        ],
      },
    },
  })
  ocIds.push(oc.id)
  record('Crear OC borrador TEST-*', true, numero)

  await registrarOcCreada(oc.id, solicitante.id, numero)
  await assertEvento(oc.id, 'OC_CREADA', 'Evento OC_CREADA')

  try {
    await enviarOcAprobacion(oc.id, solicitante.id)
    record('enviarOcAprobacion', true, 'estado PENDIENTE_APROBACION')
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    record('enviarOcAprobacion', false, msg)
  }

  const ocPend = await prisma.ordenCompra.findUnique({ where: { id: oc.id } })
  record(
    'Estado tras envio',
    ocPend?.estado === 'PENDIENTE_APROBACION',
    ocPend?.estado ?? 'desconocido',
  )

  await assertEvento(oc.id, 'OC_ENVIADA_APROBACION', 'Evento OC_ENVIADA_APROBACION')

  for (const email of APROBADORES_OC_EMAILS) {
    const user = aprobadores.find((u) => u.email === email)
    if (!user) {
      record(`Notif pendiente ${email}`, false, 'usuario no existe')
      continue
    }
    const notif = await prisma.notificacionUsuario.findFirst({
      where: {
        usuarioId: user.id,
        ordenCompraId: oc.id,
        tipo: 'OC_PENDIENTE_APROBACION',
        resueltaEn: null,
      },
    })
    record(`Notif OC_PENDIENTE_APROBACION ${email}`, !!notif, notif?.id ?? 'sin notificacion')
  }

  try {
    await aprobarOc(oc.id, aprobadorActor.id, aprobadorActor.nombre)
    record('aprobarOc', true, `por ${aprobadorActor.email}`)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    record('aprobarOc', false, msg)
  }

  const pendientes = await prisma.notificacionUsuario.count({
    where: {
      ordenCompraId: oc.id,
      tipo: 'OC_PENDIENTE_APROBACION',
      resueltaEn: null,
    },
  })
  record('Notificaciones aprobacion resueltas', pendientes === 0, `${pendientes} pendientes`)

  const notifSolicitante = await prisma.notificacionUsuario.findFirst({
    where: {
      ordenCompraId: oc.id,
      tipo: 'OC_APROBADA',
      usuarioId: solicitante.id,
    },
    orderBy: { creadaEn: 'desc' },
  })
  record('Notificacion solicitante OC_APROBADA', !!notifSolicitante)

  await assertEvento(oc.id, 'OC_APROBADA', 'Evento OC_APROBADA')

  const timeline = await construirTimelineOc(oc.id)
  if (!timeline) {
    record('construirTimelineOc', false, 'null')
  } else {
    const pasoSol = timeline.pasos.find((p) => p.id === 'solicitud')
    const pasoApr = timeline.pasos.find((p) => p.id === 'aprobacion')
    const tiposEventos = timeline.eventos.map((e) => e.tipo)
    const timelineOk =
      timeline.estado === 'APROBADA' &&
      pasoSol?.estado === 'completo' &&
      pasoApr?.estado === 'completo' &&
      tiposEventos.includes('OC_CREADA') &&
      tiposEventos.includes('OC_ENVIADA_APROBACION') &&
      tiposEventos.includes('OC_APROBADA')
    record(
      'construirTimelineOc pasos/eventos',
      timelineOk,
      `estado=${timeline.estado} solicitud=${pasoSol?.estado} aprobacion=${pasoApr?.estado}`,
    )
  }

  // --- Rechazo en segunda OC ---
  const numeroRech = `${numero}-RECH`
  const ocRech = await prisma.ordenCompra.create({
    data: {
      numero: numeroRech,
      proveedorId: proveedor.id,
      estado: 'BORRADOR',
      subtotal: 300,
      total: 300,
      creadoPorId: solicitante.id,
      solicitanteId: solicitante.id,
      justificacion: 'Prueba rechazo E2E',
      clasificacionOrigen: 'SERVICIO',
      items: {
        create: [
          {
            descripcion: 'Servicio test rechazo',
            concepto: 'Servicio',
            cantidad: 1,
            precioUnit: 300,
            subtotal: 300,
          },
        ],
      },
    },
  })
  ocIds.push(ocRech.id)
  await registrarOcCreada(ocRech.id, solicitante.id, numeroRech)

  try {
    await enviarOcAprobacion(ocRech.id, solicitante.id)
    await rechazarOc(ocRech.id, aprobadorActor.id, aprobadorActor.nombre, 'Fuera de presupuesto E2E')
    record('rechazarOc (2da OC)', true)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    record('rechazarOc (2da OC)', false, msg)
  }

  const ocRechDb = await prisma.ordenCompra.findUnique({ where: { id: ocRech.id } })
  record(
    'Estado OC rechazada',
    ocRechDb?.estado === 'RECHAZADA',
    ocRechDb?.estado ?? 'desconocido',
  )
  await assertEvento(ocRech.id, 'OC_RECHAZADA', 'Evento OC_RECHAZADA (rechazo)')

  const notifRech = await prisma.notificacionUsuario.findFirst({
    where: {
      ordenCompraId: ocRech.id,
      tipo: 'OC_RECHAZADA',
      usuarioId: solicitante.id,
    },
  })
  record('Notificacion solicitante OC_RECHAZADA', !!notifRech)

  try {
    await cleanupOcIds(ocIds)
    record('Cleanup datos TEST-*', true, `${ocIds.length} OC(s)`)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    record('Cleanup datos TEST-*', false, msg)
  }

  printSummary()
  const failed = results.filter((r) => !r.ok).length
  process.exit(failed ? 1 : 0)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

