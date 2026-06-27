import { formatFecha } from '@/lib/utils'

type EmisorRow = {
  razonSocial: string
  cuit: string
  condicionIva: string
  ingresosBrutos?: string | null
  inicioActividades?: Date | null
  domicilio?: string | null
  telefono?: string | null
  email?: string | null
}

type ClienteRow = {
  nombre: string
  direccion?: string | null
  cuit?: string | null
  condicionIva?: string | null
}

function mapEmisor(e: EmisorRow) {
  return {
    razonSocial: e.razonSocial,
    cuit: e.cuit,
    condicionIva: e.condicionIva,
    ingresosBrutos: e.ingresosBrutos,
    inicioActividades: e.inicioActividades ? formatFecha(e.inicioActividades) : null,
    domicilio: e.domicilio,
    telefono: e.telefono,
    email: e.email,
  }
}

function mapCliente(c: ClienteRow) {
  return {
    nombre: c.nombre,
    direccion: c.direccion,
    cuit: c.cuit,
    condicionIva: c.condicionIva,
  }
}

export function buildDatosRemito(
  numero: string,
  emisor: EmisorRow,
  cliente: ClienteRow,
  items: Array<{ descripcion: string; cantidad: number; codigo?: string | null }>,
  observaciones?: string | null,
): DatosDocumentoRender {
  const mapped = items.map((i) => ({
    codigo: i.codigo ?? null,
    descripcion: i.descripcion,
    descripcionLarga: null,
    fotoUrl: null,
    cantidad: i.cantidad,
    precioUnit: 0,
    bonificacionPct: 0,
    subtotal: 0,
  }))

  return {
    tipo: 'REMITO',
    numero,
    fechaEmision: new Date().toISOString(),
    emisor: mapEmisor(emisor),
    cliente: mapCliente(cliente),
    items: mapped,
    subtotal: 0,
    iva: 0,
    total: 0,
    bonificacionPct: 0,
    observaciones: observaciones ?? undefined,
  }
}

export function buildDatosRemitoDesdeOT(
  numero: string,
  ot: {
    numero: string
    descripcion: string
    repuestos: Array<{ descripcion: string; cantidad: number; inventario?: { sku: string | null } | null }>
  },
  emisor: EmisorRow,
  cliente: ClienteRow,
): DatosDocumentoRender {
  const items =
    ot.repuestos.length > 0
      ? ot.repuestos.map((r) => ({
          codigo: r.inventario?.sku ?? null,
          descripcion: r.descripcion,
          cantidad: r.cantidad,
        }))
      : [{ descripcion: ot.descripcion, cantidad: 1, codigo: null }]

  return buildDatosRemito(
    numero,
    emisor,
    cliente,
    items,
    `Remito de servicio — OT ${ot.numero}`,
  )
}

export function buildDatosRemitoDesdeFactura(
  numero: string,
  factura: {
    numero: string
    observaciones?: string | null
    items: Array<{ descripcion: string; cantidad: number; codigo?: string | null }>
  },
  emisor: EmisorRow,
  cliente: ClienteRow,
): DatosDocumentoRender {
  return buildDatosRemito(
    numero,
    emisor,
    cliente,
    factura.items.map((i) => ({
      codigo: i.codigo ?? null,
      descripcion: i.descripcion,
      cantidad: i.cantidad,
    })),
    factura.observaciones ?? `Remito vinculado a factura ${factura.numero}`,
  )
}
