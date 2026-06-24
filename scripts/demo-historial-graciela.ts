/**
 * Datos demo de historial (OTs + facturas) para Clínica San Juan / Lic. Graciela Torres (CRM).
 * Uso: npx tsx --env-file=.env scripts/demo-historial-graciela.ts
 */

import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { addHours, subDays } from 'date-fns'
import { provisionarEquiposDesdeFactura } from '../lib/equipos/provisionar-venta'
import { geocodificarSucursal } from '../lib/geocoding'

const MARKER_OT = 'OT-DEMO-SJ-2026-001'
const FACTURA_REPUESTOS = 'B-DEMO-SJ-2026-001'
const FACTURA_EQUIPO = 'B-DEMO-SJ-2026-002'
const SERIE_MONITOR = 'MND-SJ-DEMO-2026-001'

const SKUS = ['SEN-NTC-001', 'FIL-HEP-001', 'CAB-SPO2-001', 'PAN-TFT-001', 'MON-PAT-001'] as const

const SUCURSALES_DEMO = [
  {
    nombre: 'Sede Central — UCI Neonatal',
    direccion: 'Av. 25 de Mayo',
    numero: '450',
    ciudad: 'Formosa Capital',
    notas: 'Incubadoras Dräger Caleo — unidad 1 · monitor multiparamétrico UCI',
  },
  {
    nombre: 'Piso Materno — Neonatología',
    direccion: 'Av. Gutierrez',
    numero: '1200',
    ciudad: 'Formosa Capital',
    notas: 'Incubadora unidad 2 · sala materna',
  },
  {
    nombre: 'Emergencias Obstétricas',
    direccion: 'Av. San Martín',
    numero: '875',
    ciudad: 'Formosa Capital',
    notas: 'Incubadora unidad 3 · derivaciones neonatales',
  },
] as const

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

function precioUnit(item: { precioUnit: number | null }, sku: string): number {
  if (item.precioUnit == null) {
    throw new Error(`Precio unitario no definido para ${sku}. Ejecute npm run db:seed.`)
  }
  return item.precioUnit
}

async function findClienteSanJuan() {
  return prisma.cliente.findFirst({
    where: {
      activo: true,
      OR: [
        { nombre: 'Clínica San Juan' },
        { email: 'administracion@clinicasanjuan.com' },
      ],
    },
  })
}

async function ensureMonitorInventario() {
  const monitor = await prisma.inventario.upsert({
    where: { sku: 'MON-PAT-001' },
    create: {
      nombre: 'Monitor multiparamétrico Mindray ePM 12',
      sku: 'MON-PAT-001',
      descripcion: 'Monitor de signos vitales 12" — venta con kit',
      categoria: 'Equipos',
      tipoArticulo: 'EQUIPO',
      marca: 'Mindray',
      modelo: 'ePM 12',
      esSerializado: true,
      requierePreventivo: true,
      intervaloPreventivoDias: 180,
      stock: 3,
      stockMinimo: 1,
      precioUnit: 850000,
    },
    update: {
      tipoArticulo: 'EQUIPO',
      esSerializado: true,
      requierePreventivo: true,
      intervaloPreventivoDias: 180,
    },
  })

  const kitCount = await prisma.inventarioKitItem.count({ where: { inventarioPadreId: monitor.id } })
  if (kitCount === 0) {
    const cabSpo2 = await prisma.inventario.findUnique({ where: { sku: 'CAB-SPO2-001' } })
    const bat12v = await prisma.inventario.findUnique({ where: { sku: 'BAT-12V-001' } })
    await prisma.inventarioKitItem.createMany({
      data: [
        {
          inventarioPadreId: monitor.id,
          inventarioHijoId: cabSpo2?.id ?? null,
          nombre: 'Cable SpO2 adulto incluido',
          tipoItem: 'ACCESORIO_ESPECIFICO',
          cantidad: 1,
          obligatorio: true,
          orden: 0,
        },
        {
          inventarioPadreId: monitor.id,
          inventarioHijoId: bat12v?.id ?? null,
          nombre: 'Batería respaldo 12V',
          tipoItem: 'BATERIA',
          tipoComponente: 'BATERIA',
          cantidad: 1,
          mesesVencimiento: 24,
          obligatorio: false,
          orden: 1,
        },
        {
          inventarioPadreId: monitor.id,
          nombre: 'Filtro de aire interno',
          tipoItem: 'COMPONENTE',
          tipoComponente: 'FILTRO',
          cantidad: 1,
          mesesVencimiento: 12,
          obligatorio: false,
          orden: 2,
        },
      ],
    })
    console.log('ℹ️  MON-PAT-001 y kit de venta creados/actualizados')
  }
}

async function findInventarioPorSku() {
  await ensureMonitorInventario()
  const items = await prisma.inventario.findMany({
    where: { sku: { in: [...SKUS] } },
  })
  const map = new Map(items.map((i) => [i.sku!, i]))
  const faltantes = SKUS.filter((s) => !map.has(s))
  if (faltantes.length) {
    throw new Error(`Faltan ítems de inventario en BD: ${faltantes.join(', ')}. Ejecute npm run db:seed.`)
  }
  return map as Map<(typeof SKUS)[number], (typeof items)[number]>
}

async function ensureSucursalesSanJuan(clienteId: string) {
  const sucursales: Array<{ id: string; nombre: string }> = []
  const creadas: string[] = []

  for (const def of SUCURSALES_DEMO) {
    let suc = await prisma.clienteSucursal.findFirst({
      where: { clienteId, nombre: def.nombre, activo: true },
    })

    if (!suc) {
      suc = await prisma.clienteSucursal.create({
        data: {
          clienteId,
          nombre: def.nombre,
          direccion: def.direccion,
          numero: def.numero,
          ciudad: def.ciudad,
          notas: def.notas,
        },
      })
      creadas.push(def.nombre)
    }

    if (suc.lat == null || suc.lng == null) {
      const geo = await geocodificarSucursal(def.direccion, def.numero, def.ciudad).catch(() => null)
      if (geo) {
        suc = await prisma.clienteSucursal.update({
          where: { id: suc.id },
          data: { lat: geo.lat, lng: geo.lng },
        })
      }
    }

    sucursales.push({ id: suc.id, nombre: suc.nombre })
  }

  return { sucursales, creadas }
}

async function linkFacturaMonitorSucursal(clienteId: string, sucursalUciId: string) {
  const factura = await prisma.factura.findFirst({
    where: { numero: FACTURA_EQUIPO, clienteId },
    include: { items: { include: { inventario: { select: { sku: true } } } } },
  })
  if (!factura) return false

  const itemMonitor = factura.items.find((i) => i.inventario?.sku === 'MON-PAT-001')
  if (!itemMonitor) return false
  if (itemMonitor.sucursalInstalacionId === sucursalUciId) return true

  await prisma.itemFactura.update({
    where: { id: itemMonitor.id },
    data: { sucursalInstalacionId: sucursalUciId },
  })

  if (itemMonitor.equipoGeneradoId) {
    const etiqueta = SUCURSALES_DEMO[0]
    await prisma.equipo.update({
      where: { id: itemMonitor.equipoGeneradoId },
      data: {
        sucursalId: sucursalUciId,
        direccionUbicacion: [etiqueta.nombre, etiqueta.direccion, etiqueta.ciudad].filter(Boolean).join(' · '),
      },
    })
  }

  return true
}

async function ensureIncubadoras(
  clienteId: string,
  sucursales: Array<{ id: string; nombre: string }>,
) {
  const existentes = await prisma.equipo.findMany({
    where: {
      clienteId,
      estado: 'ACTIVO',
      OR: [
        { nombre: { contains: 'Incubadora', mode: 'insensitive' } },
        { modelo: { contains: 'Caleo', mode: 'insensitive' } },
      ],
    },
    orderBy: { creadoEn: 'asc' },
    take: 3,
  })

  if (existentes.length >= 3) {
    for (let i = 0; i < 3; i++) {
      const eq = existentes[i]
      const suc = sucursales[i]
      if (eq && suc && !eq.sucursalId) {
        await prisma.equipo.update({
          where: { id: eq.id },
          data: { sucursalId: suc.id, direccionUbicacion: suc.nombre },
        })
        existentes[i] = { ...eq, sucursalId: suc.id }
      }
    }
    return existentes.slice(0, 3)
  }

  const creadas = [...existentes]
  for (let i = 0; i < existentes.length; i++) {
    const eq = existentes[i]
    const suc = sucursales[i]
    if (eq && suc && !eq.sucursalId) {
      await prisma.equipo.update({
        where: { id: eq.id },
        data: { sucursalId: suc.id, direccionUbicacion: suc.nombre },
      })
      creadas[i] = { ...eq, sucursalId: suc.id }
    }
  }

  const base = existentes.length
  for (let i = base; i < 3; i++) {
    const num = String(200 + i).padStart(3, '0')
    const suc = sucursales[i]
    const eq = await prisma.equipo.create({
      data: {
        nombre: 'Incubadora Neonatal',
        marca: 'Dräger',
        modelo: 'Caleo 8000',
        numeroSerie: `DRC-SJ-${num}`,
        clienteId,
        sucursalId: suc?.id ?? null,
        estado: 'ACTIVO',
        fechaInstalacion: subDays(new Date(), 400 + i * 30),
        direccionUbicacion: suc?.nombre ?? `Neonatología — unidad ${i + 1}`,
      },
    })
    creadas.push(eq)
  }
  return creadas.slice(0, 3)
}

async function main() {
  const cliente = await findClienteSanJuan()
  if (!cliente) {
    console.error('❌ No se encontró Clínica San Juan. Ejecute npm run db:seed.')
    process.exit(1)
  }

  const conv = await prisma.conversacionCRM.findFirst({
    where: {
      OR: [
        { contactoHandle: 'administracion@clinicasanjuan.com' },
        { contactoNombre: 'Lic. Graciela Torres' },
      ],
    },
    orderBy: { ultimoMensajeEn: 'desc' },
  })

  if (conv && conv.clienteId !== cliente.id) {
    await prisma.conversacionCRM.update({
      where: { id: conv.id },
      data: { clienteId: cliente.id },
    })
    console.log(`🔗 Conversación «${conv.contactoNombre}» vinculada a ${cliente.nombre}`)
  } else if (conv) {
    console.log(`ℹ️  Conversación «${conv.contactoNombre}» ya vinculada a ${cliente.nombre}`)
  } else {
    console.warn('⚠️  No se encontró conversación de Lic. Graciela Torres (se crean OTs/facturas igual).')
  }

  // Instagram @clinicasanjuan también debe apuntar a Clínica San Juan
  const convIg = await prisma.conversacionCRM.findFirst({
    where: { contactoHandle: '@clinicasanjuan' },
  })
  if (convIg && convIg.clienteId !== cliente.id) {
    await prisma.conversacionCRM.update({
      where: { id: convIg.id },
      data: { clienteId: cliente.id },
    })
    console.log(`🔗 Conversación Instagram «${convIg.contactoNombre}» vinculada a ${cliente.nombre}`)
  }

  const { sucursales, creadas: sucursalesCreadas } = await ensureSucursalesSanJuan(cliente.id)
  if (sucursalesCreadas.length) {
    console.log(`✅ ${sucursalesCreadas.length} sucursal(es) demo creadas: ${sucursalesCreadas.join(', ')}`)
  } else {
    console.log(`ℹ️  ${sucursales.length} sucursal(es) demo ya existentes`)
  }

  const sucursalUci = sucursales[0]!
  const monitorVinculado = await linkFacturaMonitorSucursal(cliente.id, sucursalUci.id)
  if (monitorVinculado) {
    console.log(`🔗 Ítem MON-PAT-001 vinculado a «${sucursalUci.nombre}»`)
  }

  const marker = await prisma.ordenTrabajo.findUnique({ where: { numero: MARKER_OT } })
  if (marker) {
    const sucCount = await prisma.clienteSucursal.count({
      where: { clienteId: cliente.id, activo: true },
    })
    console.log(`ℹ️  Demo ya aplicada (existe ${MARKER_OT}). Sucursales activas: ${sucCount}.`)
    return
  }

  const inv = await findInventarioPorSku()
  const tecnico =
    (await prisma.usuario.findUnique({ where: { email: 'guillermo@ib.com' } })) ??
    (await prisma.usuario.findUnique({ where: { email: 'admin@ib.com' } }))

  if (!tecnico) {
    console.error('❌ No se encontró técnico guillermo@ib.com ni admin@ib.com')
    process.exit(1)
  }

  const incubadoras = await ensureIncubadoras(cliente.id, sucursales)
  const ahora = new Date()

  const otsDef = [
    {
      numero: 'OT-DEMO-SJ-2026-001',
      tipo: 'PREVENTIVO' as const,
      estado: 'CERRADA' as const,
      descripcion: 'Mantenimiento preventivo anual — Incubadora Neonatal UCI (Dräger Caleo 8000)',
      diagnostico:
        'Inspección completa: filtros HEPA reemplazados, sensores NTC calibrados, prueba de ciclos de temperatura/humedad dentro de tolerancia ±0.5°C. Equipo apto para uso clínico.',
      diasAtras: 18,
      equipoIdx: 0,
      repuestos: [
        { sku: 'FIL-HEP-001' as const, cantidad: 2 },
        { sku: 'SEN-NTC-001' as const, cantidad: 1 },
      ],
      historial: [
        { estado: 'ABIERTA' as const, nota: 'OT generada por solicitud de mantenimiento preventivo (3 incubadoras).', horas: 0 },
        { estado: 'EN_PROCESO' as const, nota: 'Técnico en sitio — unidad 1 de 3.', horas: 4 },
        { estado: 'CERRADA' as const, nota: 'Preventivo completado. Informe entregado a administración.', horas: 6 },
      ],
    },
    {
      numero: 'OT-DEMO-SJ-2026-002',
      tipo: 'PREVENTIVO' as const,
      estado: 'EN_PROCESO' as const,
      descripcion: 'Mantenimiento preventivo — Incubadora Neonatal UCI unidad 2',
      diagnostico: null,
      diasAtras: 5,
      equipoIdx: 1,
      repuestos: [{ sku: 'FIL-HEP-001' as const, cantidad: 1 }],
      historial: [
        { estado: 'ABIERTA' as const, nota: 'Programada en visita conjunta con unidad 1.', horas: 0 },
        { estado: 'EN_PROCESO' as const, nota: 'Reemplazo de filtro HEPA en curso.', horas: 3 },
      ],
    },
    {
      numero: 'OT-DEMO-SJ-2026-003',
      tipo: 'CORRECTIVO' as const,
      estado: 'CERRADA' as const,
      descripcion: 'Correctivo — alarma intermitente de temperatura en incubadora unidad 3',
      diagnostico:
        'Sensor NTC de cámara con deriva térmica. Se reemplazó el sensor y se verificó el lazo de control. Alarmas silenciadas tras 24 h de monitoreo estable.',
      diasAtras: 42,
      equipoIdx: 2,
      repuestos: [{ sku: 'SEN-NTC-001' as const, cantidad: 2 }],
      historial: [
        { estado: 'ABIERTA' as const, nota: 'Reporte de alarma intermitente vía email (Lic. Graciela Torres).', horas: 0 },
        { estado: 'EN_PROCESO' as const, nota: 'Diagnóstico en sitio — sensor NTC defectuoso.', horas: 8 },
        { estado: 'CERRADA' as const, nota: 'Repuesto instalado y calibrado. Cliente conforme.', horas: 12 },
      ],
    },
  ]

  const otsCreadas: string[] = []
  for (const def of otsDef) {
    const fechaApertura = subDays(ahora, def.diasAtras)
    const slaVence =
      def.estado === 'EN_PROCESO' ? addHours(ahora, 48) : addHours(fechaApertura, 72)
    const fechaCierre =
      def.estado === 'CERRADA' ? addHours(fechaApertura, def.historial.at(-1)!.horas + 2) : null

    const ot = await prisma.ordenTrabajo.create({
      data: {
        numero: def.numero,
        tipo: def.tipo,
        estado: def.estado,
        descripcion: def.descripcion,
        diagnostico: def.diagnostico,
        prioridad: def.tipo === 'CORRECTIVO' ? 'ALTA' : 'NORMAL',
        slaHoras: 72,
        fechaApertura,
        slaVence,
        fechaCierre,
        clienteId: cliente.id,
        equipoId: incubadoras[def.equipoIdx]?.id,
        tecnicoId: tecnico.id,
        historial: {
          create: def.historial.map((h) => ({
            estado: h.estado,
            nota: h.nota,
            creadoEn: addHours(fechaApertura, h.horas),
          })),
        },
        repuestos: {
          create: def.repuestos.map((r) => {
            const item = inv.get(r.sku)!
            return {
              descripcion: item.nombre,
              cantidad: r.cantidad,
              precioUnit: precioUnit(item, r.sku),
              inventarioId: item.id,
            }
          }),
        },
      },
    })
    otsCreadas.push(ot.numero)
  }
  console.log(`✅ ${otsCreadas.length} OTs demo: ${otsCreadas.join(', ')}`)

  // --- Factura 1: repuestos (ARS) ---
  const f1Items = [
    { sku: 'CAB-SPO2-001' as const, cantidad: 2 },
    { sku: 'FIL-HEP-001' as const, cantidad: 3 },
    { sku: 'SEN-NTC-001' as const, cantidad: 2 },
  ]
  const f1Lineas = f1Items.map(({ sku, cantidad }) => {
    const item = inv.get(sku)!
    const unit = precioUnit(item, sku)
    const subtotal = unit * cantidad
    return {
      descripcion: item.nombre,
      codigo: sku,
      cantidad,
      precioUnit: unit,
      subtotal,
      inventarioId: item.id,
    }
  })
  const f1Subtotal = f1Lineas.reduce((s, l) => s + l.subtotal, 0)
  const f1Iva = f1Subtotal * 0.21

  await prisma.factura.create({
    data: {
      numero: FACTURA_REPUESTOS,
      tipo: 'B',
      estado: 'PAGADA',
      subtotal: f1Subtotal,
      iva: f1Iva,
      total: f1Subtotal + f1Iva,
      moneda: 'ARS',
      clienteId: cliente.id,
      fechaEmision: subDays(ahora, 12),
      fechaPago: subDays(ahora, 8),
      fechaVencimiento: subDays(ahora, -18),
      observaciones: 'Repuestos incubadoras y accesorios — pedido Lic. Graciela Torres',
      items: { create: f1Lineas },
    },
  })
  console.log(`✅ Factura repuestos ${FACTURA_REPUESTOS} (PAGADA)`)

  // --- Factura 2: pantalla USD + monitor equipo ---
  const pan = inv.get('PAN-TFT-001')!
  const mon = inv.get('MON-PAT-001')!
  const cotizacionUsd = 1050
  const panUnit = precioUnit(pan, 'PAN-TFT-001')
  const monUnit = precioUnit(mon, 'MON-PAT-001')
  const panSub = panUnit * 1
  const monSub = monUnit
  const f2Subtotal = panSub * cotizacionUsd + monSub
  const f2Iva = f2Subtotal * 0.21

  const facturaEquipo = await prisma.factura.create({
    data: {
      numero: FACTURA_EQUIPO,
      tipo: 'B',
      estado: 'PAGADA',
      subtotal: f2Subtotal,
      iva: f2Iva,
      total: f2Subtotal + f2Iva,
      moneda: 'ARS',
      cotizacionUsd,
      clienteId: cliente.id,
      fechaEmision: subDays(ahora, 28),
      fechaPago: subDays(ahora, 22),
      fechaVencimiento: subDays(ahora, 2),
      observaciones: 'Renovación equipamiento 2026 — monitor UCI + repuesto pantalla',
      items: {
        create: [
          {
            descripcion: pan.nombre,
            codigo: pan.sku!,
            cantidad: 1,
            precioUnit: panUnit,
            subtotal: panSub,
            inventarioId: pan.id,
          },
          {
            descripcion: mon.nombre,
            codigo: mon.sku!,
            cantidad: 1,
            precioUnit: monUnit,
            subtotal: monSub,
            inventarioId: mon.id,
            numeroSerie: SERIE_MONITOR,
            proximoPreventivo: addHours(subDays(ahora, 22), 180 * 24),
            sucursalInstalacionId: sucursalUci.id,
          },
        ],
      },
    },
    include: { items: true },
  })
  console.log(`✅ Factura equipo ${FACTURA_EQUIPO} (PAGADA)`)

  const itemMonitor = facturaEquipo.items.find((i) => i.inventarioId === mon.id)
  if (itemMonitor) {
    const prov = await provisionarEquiposDesdeFactura(facturaEquipo.id, tecnico.id)
    console.log(
      `✅ Provisionado desde factura: ${prov.equiposCreados} equipo(s), ${prov.planesCreados} plan(es), ${prov.otsCreadas} OT(s)`,
    )
    if (prov.errores.length) console.warn('  Avisos:', prov.errores.join('; '))
  }

  // Verificación rápida (misma lógica que GET /api/clientes/[id]/historial)
  const [otsCount, facturasCount, productosCount, sucursalesActivas] = await Promise.all([
    prisma.ordenTrabajo.count({ where: { clienteId: cliente.id } }),
    prisma.factura.count({
      where: { clienteId: cliente.id, estado: { notIn: ['BORRADOR', 'ANULADA'] } },
    }),
    prisma.itemFactura.count({
      where: {
        inventarioId: { not: null },
        factura: { clienteId: cliente.id, estado: { notIn: ['BORRADOR', 'ANULADA'] } },
      },
    }),
    prisma.clienteSucursal.findMany({
      where: { clienteId: cliente.id, activo: true },
      select: { nombre: true, ciudad: true, lat: true, lng: true },
      orderBy: { creadoEn: 'asc' },
    }),
  ])

  console.log('\n📋 Resumen historial CRM')
  console.log(`   Cliente: ${cliente.nombre} (${cliente.id})`)
  console.log(`   OTs totales: ${otsCount} | Facturas visibles: ${facturasCount} | Ítems con inventario: ${productosCount}`)
  console.log(`   Sucursales activas: ${sucursalesActivas.length}`)
  for (const s of sucursalesActivas) {
    const coords = s.lat != null && s.lng != null ? ` (${s.lat.toFixed(4)}, ${s.lng.toFixed(4)})` : ' (sin geocodificar)'
    console.log(`     · ${s.nombre} — ${s.ciudad ?? '—'}${coords}`)
  }
  console.log('\nRe-ejecutar: npx tsx --env-file=.env scripts/demo-historial-graciela.ts')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
