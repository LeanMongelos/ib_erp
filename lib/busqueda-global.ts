import { prisma } from '@/lib/prisma'
import { tienePermiso } from '@/lib/rbac'
import type { ResultadoBusqueda } from '@/lib/busqueda-global-types'

export type { TipoResultadoBusqueda, ResultadoBusqueda } from '@/lib/busqueda-global-types'
export { ETIQUETAS_TIPO } from '@/lib/busqueda-global-types'

const LIMITE = 5

function contiene(q: string) {
  return { contains: q, mode: 'insensitive' as const }
}

/** Si el término es numérico, también busca sufijo en número (ej. 10001 → B-10001). */
function condicionesNumero(campo: 'numero', term: string): Record<string, unknown>[] {
  const conds: Record<string, unknown>[] = [{ [campo]: contiene(term) }]
  if (/^\d+$/.test(term)) {
    conds.push({ [campo]: { endsWith: term, mode: 'insensitive' } })
  }
  return conds
}

export async function buscarEnErp(q: string, permisos: string[] = []): Promise<ResultadoBusqueda[]> {
  const term = q.trim()
  if (term.length < 2) return []

  const can = (p: string) => tienePermiso(permisos, p)

  const [
    clientes,
    facturas,
    presupuestos,
    productos,
    equipos,
    ots,
    proveedores,
  ] = await Promise.all([
    can('clientes.read')
      ? prisma.cliente.findMany({
      where: {
        activo: true,
        OR: [
          { nombre: contiene(term) },
          { cuit: contiene(term) },
          { ciudad: contiene(term) },
          { contacto: contiene(term) },
          { email: contiene(term) },
          { telefono: contiene(term) },
        ],
      },
      select: { id: true, nombre: true, ciudad: true, cuit: true },
      take: LIMITE,
      orderBy: { nombre: 'asc' },
    })
      : Promise.resolve([]),
    can('facturas.read')
      ? prisma.factura.findMany({
      where: {
        OR: [
          ...condicionesNumero('numero', term),
          { cae: contiene(term) },
          { cliente: { nombre: contiene(term) } },
        ],
      },
      select: {
        id: true,
        numero: true,
        estado: true,
        cliente: { select: { nombre: true } },
      },
      take: LIMITE,
      orderBy: { fechaEmision: 'desc' },
    })
      : Promise.resolve([]),
    can('presupuestos.read')
      ? prisma.presupuesto.findMany({
      where: {
        OR: [
          ...condicionesNumero('numero', term),
          { cliente: { nombre: contiene(term) } },
        ],
      },
      select: {
        id: true,
        numero: true,
        estado: true,
        cliente: { select: { nombre: true } },
      },
      take: LIMITE,
      orderBy: { creadoEn: 'desc' },
    })
      : Promise.resolve([]),
    can('inventario.read')
      ? prisma.inventario.findMany({
      where: {
        OR: [
          { nombre: contiene(term) },
          { sku: contiene(term) },
          { descripcion: contiene(term) },
          { marca: contiene(term) },
          { modelo: contiene(term) },
        ],
      },
      select: { id: true, nombre: true, sku: true, tipoArticulo: true },
      take: LIMITE,
      orderBy: { nombre: 'asc' },
    })
      : Promise.resolve([]),
    can('servicio.read')
      ? prisma.equipo.findMany({
      where: {
        OR: [
          { nombre: contiene(term) },
          { numeroSerie: contiene(term) },
          { codigoInterno: contiene(term) },
          { marca: contiene(term) },
          { modelo: contiene(term) },
          { cliente: { nombre: contiene(term) } },
        ],
      },
      select: {
        id: true,
        nombre: true,
        numeroSerie: true,
        cliente: { select: { nombre: true } },
      },
      take: LIMITE,
      orderBy: { nombre: 'asc' },
    })
      : Promise.resolve([]),
    can('servicio.read')
      ? prisma.ordenTrabajo.findMany({
      where: {
        OR: [
          ...condicionesNumero('numero', term),
          { descripcion: contiene(term) },
          { cliente: { nombre: contiene(term) } },
          { equipo: { nombre: contiene(term) } },
        ],
      },
      select: {
        id: true,
        numero: true,
        estado: true,
        descripcion: true,
        cliente: { select: { nombre: true } },
      },
      take: LIMITE,
      orderBy: { fechaApertura: 'desc' },
    })
      : Promise.resolve([]),
    can('proveedores.read')
      ? prisma.proveedor.findMany({
      where: {
        activo: true,
        OR: [
          { razonSocial: contiene(term) },
          { cuit: contiene(term) },
          { rubro: contiene(term) },
          { email: contiene(term) },
        ],
      },
      select: { id: true, razonSocial: true, ciudad: true, cuit: true },
      take: LIMITE,
      orderBy: { razonSocial: 'asc' },
    })
      : Promise.resolve([]),
  ])

  const resultados: ResultadoBusqueda[] = []

  for (const c of clientes) {
    resultados.push({
      id: c.id,
      tipo: 'cliente',
      titulo: c.nombre,
      subtitulo: [c.cuit, c.ciudad].filter(Boolean).join(' · ') || 'Cliente',
      href: `/clientes/${c.id}`,
    })
  }
  for (const f of facturas) {
    resultados.push({
      id: f.id,
      tipo: 'factura',
      titulo: f.numero,
      subtitulo: `${f.cliente.nombre} · ${f.estado}`,
      href: `/facturacion?highlight=${f.id}`,
    })
  }
  for (const p of presupuestos) {
    resultados.push({
      id: p.id,
      tipo: 'presupuesto',
      titulo: p.numero,
      subtitulo: `${p.cliente.nombre} · ${p.estado}`,
      href: `/presupuestos/${p.id}`,
    })
  }
  for (const i of productos) {
    resultados.push({
      id: i.id,
      tipo: 'producto',
      titulo: i.nombre,
      subtitulo: [i.sku, i.tipoArticulo].filter(Boolean).join(' · ') || 'Inventario',
      href: `/inventario?q=${encodeURIComponent(i.sku ?? i.nombre)}`,
    })
  }
  for (const e of equipos) {
    resultados.push({
      id: e.id,
      tipo: 'equipo',
      titulo: e.nombre,
      subtitulo: [e.numeroSerie, e.cliente.nombre].filter(Boolean).join(' · ') || 'Equipo',
      href: `/servicio-tecnico/equipos/${e.id}`,
    })
  }
  for (const o of ots) {
    resultados.push({
      id: o.id,
      tipo: 'ot',
      titulo: `OT ${o.numero}`,
      subtitulo: `${o.cliente.nombre} · ${o.estado}`,
      href: `/servicio-tecnico/${o.id}`,
    })
  }
  for (const pr of proveedores) {
    resultados.push({
      id: pr.id,
      tipo: 'proveedor',
      titulo: pr.razonSocial,
      subtitulo: [pr.cuit, pr.ciudad].filter(Boolean).join(' · ') || 'Proveedor',
      href: `/proveedores/${pr.id}`,
    })
  }

  return resultados
}
