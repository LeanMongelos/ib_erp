/**
 * Export JSON para equipo ML (sin datos sensibles).
 * Uso: npm run export:ml-handoff
 */
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { prisma } from '../lib/prisma'
import { HANDOFF_CLIENTES } from '../lib/equipos/seed-ml-handoff'

const OUTPUT = path.join(process.cwd(), 'docs', 'exports', 'ml-handoff-clientes-equipos.json')

type InventarioExport = {
  sku: string | null
  nombre: string
  marca: string | null
  modelo: string | null
  descripcion: string | null
  tieneFotoReferencia: boolean
}

type AsignacionExport = {
  id: string
  clienteId: string
  clienteNombre: string
  sucursalNombre: string | null
  tipo: string
  vigenciaDesde: string
  vigenciaHasta: string | null
  activa: boolean
  motivo: string | null
}

type EquipoExport = {
  id: string
  nombre: string
  marca: string | null
  modelo: string | null
  numeroSerie: string | null
  estado: string
  origen: string
  inventario?: InventarioExport
  asignacionActivaId: string | null
  asignaciones: AsignacionExport[]
}

type ClienteExport = {
  id: string
  nombre: string
  tipo: string
  ciudad: string | null
  activo: boolean
  equipos: EquipoExport[]
}

type OtroClienteResumen = {
  id: string
  nombre: string
  tipo: string
  ciudad: string | null
  activo: boolean
  cantidadEquipos: number
}

function mapInventario(inv: {
  sku: string | null
  nombre: string
  marca: string | null
  modelo: string | null
  descripcion: string | null
  fotoUrl: string | null
}): InventarioExport {
  return {
    sku: inv.sku,
    nombre: inv.nombre,
    marca: inv.marca,
    modelo: inv.modelo,
    descripcion: inv.descripcion,
    tieneFotoReferencia: Boolean(inv.fotoUrl?.trim()),
  }
}

function mapAsignaciones(
  rows: Array<{
    id: string
    clienteId: string
    tipo: string
    vigenciaDesde: Date
    vigenciaHasta: Date | null
    activa: boolean
    motivo: string | null
    cliente: { nombre: string }
    sucursal: { nombre: string } | null
  }>,
): AsignacionExport[] {
  return rows.map((a) => ({
    id: a.id,
    clienteId: a.clienteId,
    clienteNombre: a.cliente.nombre,
    sucursalNombre: a.sucursal?.nombre ?? null,
    tipo: a.tipo,
    vigenciaDesde: a.vigenciaDesde.toISOString(),
    vigenciaHasta: a.vigenciaHasta?.toISOString() ?? null,
    activa: a.activa,
    motivo: a.motivo,
  }))
}

function mapEquipo(e: {
  id: string
  nombre: string
  marca: string | null
  modelo: string | null
  numeroSerie: string | null
  estado: string
  origen: string
  inventario: {
    sku: string | null
    nombre: string
    marca: string | null
    modelo: string | null
    descripcion: string | null
    fotoUrl: string | null
  } | null
  asignaciones: Array<{
    id: string
    clienteId: string
    tipo: string
    vigenciaDesde: Date
    vigenciaHasta: Date | null
    activa: boolean
    motivo: string | null
    cliente: { nombre: string }
    sucursal: { nombre: string } | null
  }>
}): EquipoExport {
  const asignaciones = mapAsignaciones(e.asignaciones)
  const activa = asignaciones.find((a) => a.activa)
  return {
    id: e.id,
    nombre: e.nombre,
    marca: e.marca,
    modelo: e.modelo,
    numeroSerie: e.numeroSerie,
    estado: e.estado,
    origen: e.origen,
    ...(e.inventario ? { inventario: mapInventario(e.inventario) } : {}),
    asignacionActivaId: activa?.id ?? null,
    asignaciones,
  }
}

async function main() {
  const clientesHandoff = await prisma.cliente.findMany({
    where: { nombre: { in: [...HANDOFF_CLIENTES] } },
    orderBy: { nombre: 'asc' },
    select: {
      id: true,
      nombre: true,
      tipo: true,
      ciudad: true,
      activo: true,
      equipos: {
        orderBy: { creadoEn: 'asc' },
        select: {
          id: true,
          nombre: true,
          marca: true,
          modelo: true,
          numeroSerie: true,
          estado: true,
          origen: true,
          inventario: {
            select: {
              sku: true,
              nombre: true,
              marca: true,
              modelo: true,
              descripcion: true,
              fotoUrl: true,
            },
          },
          asignaciones: {
            orderBy: [{ vigenciaDesde: 'desc' }, { creadoEn: 'desc' }],
            select: {
              id: true,
              clienteId: true,
              tipo: true,
              vigenciaDesde: true,
              vigenciaHasta: true,
              activa: true,
              motivo: true,
              cliente: { select: { nombre: true } },
              sucursal: { select: { nombre: true } },
            },
          },
        },
      },
    },
  })

  const clientes: ClienteExport[] = clientesHandoff.map((c) => ({
    id: c.id,
    nombre: c.nombre,
    tipo: c.tipo,
    ciudad: c.ciudad,
    activo: c.activo,
    equipos: c.equipos.map(mapEquipo),
  }))

  const otros = await prisma.cliente.findMany({
    where: { nombre: { notIn: [...HANDOFF_CLIENTES] }, activo: true },
    orderBy: { nombre: 'asc' },
    select: {
      id: true,
      nombre: true,
      tipo: true,
      ciudad: true,
      activo: true,
      _count: { select: { equipos: true } },
    },
  })

  const otrosClientes: OtroClienteResumen[] = otros.map((c) => ({
    id: c.id,
    nombre: c.nombre,
    tipo: c.tipo,
    ciudad: c.ciudad,
    activo: c.activo,
    cantidadEquipos: c._count.equipos,
  }))

  const payload = {
    generatedAt: new Date().toISOString(),
    schemaVersion: 2,
    clientes,
    otrosClientes,
  }

  await mkdir(path.dirname(OUTPUT), { recursive: true })
  await writeFile(OUTPUT, JSON.stringify(payload, null, 2) + '\n', 'utf8')

  const encontrados = new Set(clientes.map((c) => c.nombre))
  const faltantes = HANDOFF_CLIENTES.filter((n) => !encontrados.has(n))

  console.log(`✅ Export ML handoff → ${OUTPUT}`)
  console.log(`   Clientes handoff: ${clientes.length}/${HANDOFF_CLIENTES.length}`)
  console.log(`   Equipos totales handoff: ${clientes.reduce((n, c) => n + c.equipos.length, 0)}`)
  console.log(
    `   Asignaciones en export: ${clientes.reduce(
      (n, c) => n + c.equipos.reduce((m, e) => m + e.asignaciones.length, 0),
      0,
    )}`,
  )
  console.log(`   Otros clientes (resumen): ${otrosClientes.length}`)
  if (faltantes.length) {
    console.warn(`   ⚠️  Faltan en BD: ${faltantes.join(', ')} (ejecute npm run db:seed)`)
  }
}

main()
  .catch((e) => {
    console.error('❌ Error export ML handoff:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
