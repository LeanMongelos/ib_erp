/**
 * Enriquece datos demo para handoff ML (5 clientes seed + casuísticas VENTA/EXTERNO/ALQUILER).
 */
import { addMonths, subMonths } from 'date-fns'
import { prisma } from '@/lib/prisma'
import { aplicarKitYPreventivoEquipo } from '@/lib/equipos/aplicar-kit-preventivo-equipo'
import { seedHistoriaClinicaDemo } from '@/lib/equipos/seed-historia-demo'

export const HANDOFF_CLIENTES = [
  'Hospital Central Dr. Salvador Mazza',
  'Clínica San Juan',
  'Consultorio Dr. Ramón Espínola',
  'Hospital Distrital de Clorinda',
  'Centro de Diagnóstico Médico Formosa',
] as const

const SERIE_MONITOR_SJ = 'MND-SJ-EPM12-ML'
const MARKER_COMPONENTE_CLORINDA = 'ML-HANDOFF — calibración anual'
const FOTO_DEMO_MON_PAT = 'storage/inventario-fotos/demo/mon-pat-001.jpg'

export type SeedMlHandoffResult = {
  hospitalCentral: 'ok' | 'skip'
  clinicaSanJuan: 'created' | 'updated' | 'skip'
  consultorioExterno: number
  hospitalClorinda: number
  centroDiagnosticoAlquiler: 'ok' | 'skip'
}

async function findCliente(nombre: (typeof HANDOFF_CLIENTES)[number]) {
  return prisma.cliente.findFirst({
    where: { nombre, activo: true },
    select: { id: true, nombre: true },
  })
}

async function ensureMonitorCatalog() {
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
      fotoUrl: FOTO_DEMO_MON_PAT,
    },
    update: {
      tipoArticulo: 'EQUIPO',
      marca: 'Mindray',
      modelo: 'ePM 12',
      esSerializado: true,
      requierePreventivo: true,
      intervaloPreventivoDias: 180,
      fotoUrl: FOTO_DEMO_MON_PAT,
    },
    include: {
      kitComoEquipo: { orderBy: { orden: 'asc' }, include: { hijo: true } },
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
  }

  return prisma.inventario.findUniqueOrThrow({
    where: { id: monitor.id },
    include: {
      kitComoEquipo: { orderBy: { orden: 'asc' }, include: { hijo: true } },
    },
  })
}

async function enrichHospitalCentral(clienteId: string): Promise<'ok' | 'skip'> {
  const equipos = await prisma.equipo.findMany({
    where: { clienteId },
    orderBy: { creadoEn: 'asc' },
    take: 3,
    select: { id: true, nombre: true, numeroSerie: true, codigoInterno: true },
  })
  if (equipos.length < 2) return 'skip'

  const yaEnriquecido = equipos.some((e) => e.codigoInterno === 'IB-EQ-001')
  if (yaEnriquecido) return 'skip'

  await seedHistoriaClinicaDemo(equipos)
  return 'ok'
}

async function enrichClinicaSanJuan(clienteId: string): Promise<'created' | 'updated' | 'skip'> {
  const inventario = await ensureMonitorCatalog()

  const existente = await prisma.equipo.findFirst({
    where: {
      OR: [
        { numeroSerie: SERIE_MONITOR_SJ },
        { clienteId, inventarioId: inventario.id },
      ],
    },
  })

  if (existente) {
    if (existente.clienteId !== clienteId) return 'skip'

    const accCount = await prisma.equipoAccesorio.count({ where: { equipoId: existente.id } })
    if (accCount === 0) {
      await aplicarKitYPreventivoEquipo({
        equipoId: existente.id,
        clienteId,
        inventario,
        referencia: 'seed ML handoff',
        fechaBase: existente.fechaInstalacion ?? subMonths(new Date(), 3),
      })
    }

    const needsUpdate =
      existente.origen !== 'VENTA' ||
      existente.inventarioId !== inventario.id ||
      existente.marca !== 'Mindray' ||
      existente.modelo !== 'ePM 12'

    if (needsUpdate) {
      await prisma.equipo.update({
        where: { id: existente.id },
        data: {
          nombre: inventario.nombre,
          marca: inventario.marca,
          modelo: inventario.modelo,
          inventarioId: inventario.id,
          origen: 'VENTA',
          estado: 'ACTIVO',
          codigoInterno: 'ML-HANDOFF-SJ',
          fechaInstalacion: existente.fechaInstalacion ?? subMonths(new Date(), 3),
          referenciaCompra: existente.referenciaCompra ?? 'DEMO-ML-HANDOFF',
        },
      })
      return 'updated'
    }
    return accCount === 0 ? 'updated' : 'skip'
  }

  const equipo = await prisma.equipo.create({
    data: {
      nombre: inventario.nombre,
      marca: inventario.marca,
      modelo: inventario.modelo,
      numeroSerie: SERIE_MONITOR_SJ,
      clienteId,
      inventarioId: inventario.id,
      origen: 'VENTA',
      estado: 'ACTIVO',
      codigoInterno: 'ML-HANDOFF-SJ',
      fechaInstalacion: subMonths(new Date(), 3),
      referenciaCompra: 'DEMO-ML-HANDOFF',
    },
  })

  const accCount = await prisma.equipoAccesorio.count({ where: { equipoId: equipo.id } })
  if (accCount === 0) {
    await aplicarKitYPreventivoEquipo({
      equipoId: equipo.id,
      clienteId,
      inventario,
      referencia: 'seed ML handoff',
      fechaBase: subMonths(new Date(), 3),
    })
  }

  await prisma.historiaClinicaEntrada.create({
    data: {
      equipoId: equipo.id,
      tipo: 'INSTALACION',
      titulo: 'Equipo vendido — demo handoff ML',
      contenido: `Monitor ePM 12 vinculado a catálogo ${inventario.sku} · Serie ${SERIE_MONITOR_SJ}`,
    },
  })

  return 'created'
}

async function markConsultorioExterno(clienteId: string): Promise<number> {
  const result = await prisma.equipo.updateMany({
    where: { clienteId, origen: { not: 'EXTERNO' } },
    data: { origen: 'EXTERNO' },
  })
  return result.count
}

async function enrichHospitalClorinda(clienteId: string): Promise<number> {
  const equipos = await prisma.equipo.findMany({
    where: { clienteId },
    orderBy: { creadoEn: 'asc' },
    select: { id: true, nombre: true },
  })

  let creados = 0
  const ahora = new Date()

  for (const eq of equipos) {
    const marker = await prisma.equipoComponente.findFirst({
      where: { equipoId: eq.id, descripcion: { contains: 'ML-HANDOFF' } },
    })
    if (marker) continue

    await prisma.equipoComponente.createMany({
      data: [
        {
          equipoId: eq.id,
          tipo: 'BATERIA',
          descripcion: `${MARKER_COMPONENTE_CLORINDA} — batería respaldo`,
          instaladoEn: subMonths(ahora, 6),
          venceEn: addMonths(ahora, 4),
          alertaDiasAntes: 30,
        },
        {
          equipoId: eq.id,
          tipo: 'FILTRO',
          descripcion: `${MARKER_COMPONENTE_CLORINDA} — filtro`,
          venceEn: addMonths(ahora, 8),
          alertaDiasAntes: 45,
        },
      ],
    })
    creados++
  }

  return creados
}

async function enrichCentroDiagnosticoAlquiler(clienteId: string): Promise<'ok' | 'skip'> {
  const alquiler = await prisma.equipo.findFirst({
    where: { clienteId, origen: 'ALQUILER' },
    select: { id: true },
  })
  if (alquiler) return 'skip'

  const candidato = await prisma.equipo.findFirst({
    where: {
      clienteId,
      OR: [
        { nombre: { contains: 'Monitor', mode: 'insensitive' } },
        { marca: 'Mindray' },
      ],
    },
    orderBy: { creadoEn: 'asc' },
  })
  if (!candidato) return 'skip'

  await prisma.equipo.update({
    where: { id: candidato.id },
    data: {
      origen: 'ALQUILER',
      notasTecnicas: 'Equipo en régimen de alquiler IB — demo handoff ML',
      codigoInterno: candidato.codigoInterno ?? 'ML-HANDOFF-ALQ',
    },
  })
  return 'ok'
}

export async function seedMlHandoff(): Promise<SeedMlHandoffResult> {
  const result: SeedMlHandoffResult = {
    hospitalCentral: 'skip',
    clinicaSanJuan: 'skip',
    consultorioExterno: 0,
    hospitalClorinda: 0,
    centroDiagnosticoAlquiler: 'skip',
  }

  const hcsm = await findCliente('Hospital Central Dr. Salvador Mazza')
  if (hcsm) result.hospitalCentral = await enrichHospitalCentral(hcsm.id)

  const sanJuan = await findCliente('Clínica San Juan')
  if (sanJuan) result.clinicaSanJuan = await enrichClinicaSanJuan(sanJuan.id)

  const espinola = await findCliente('Consultorio Dr. Ramón Espínola')
  if (espinola) result.consultorioExterno = await markConsultorioExterno(espinola.id)

  const clorinda = await findCliente('Hospital Distrital de Clorinda')
  if (clorinda) result.hospitalClorinda = await enrichHospitalClorinda(clorinda.id)

  const cdm = await findCliente('Centro de Diagnóstico Médico Formosa')
  if (cdm) result.centroDiagnosticoAlquiler = await enrichCentroDiagnosticoAlquiler(cdm.id)

  return result
}
