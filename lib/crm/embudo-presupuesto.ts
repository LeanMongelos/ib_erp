/**
 * Creación automática de presupuesto al avanzar un negocio a etapa PROPUESTA.
 */

import type { NegocioEmbudo } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { calcularTotalesPresupuesto } from '@/lib/presupuestos/calcular-total-presupuesto'
import { aplicarPreciosResueltosItems } from '@/lib/precios/aplicar-precios-documento'
import { siguienteNumeroPresupuesto, crearConNumeroUnico } from '@/lib/sequences'
import { ApiError } from '@/lib/api-auth'
import { resolverPlantillaIdEmision } from '@/lib/plantillas/resolver-plantilla'

const CONDICION_PAGO: Record<string, string> = {
  CONTADO: 'Contado',
  '30': '30 días',
  '60': '60 días',
  CUOTAS: 'Cuotas',
  A_DEFINIR: 'A definir',
}

const PLAZO_ENTREGA: Record<string, string> = {
  INMEDIATO: 'Inmediato',
  '15': '15 días',
  '30': '30 días',
  '60': '60 días',
  '90': '90 días',
  A_CONFIRMAR: 'A confirmar',
}

function diasEntre(desde: Date, hasta: Date): number {
  const ms = hasta.getTime() - desde.getTime()
  return Math.max(1, Math.ceil(ms / (1000 * 60 * 60 * 24)))
}

function inventarioIdNegocio(negocio: NegocioEmbudo, datos: Record<string, unknown>): string | null {
  const fromDatos = datos.inventarioId
  if (typeof fromDatos === 'string' && fromDatos.trim()) return fromDatos.trim()
  const stored = negocio.datos as { inventarioId?: string } | null
  return stored?.inventarioId?.trim() || null
}

async function resolverClienteId(negocio: NegocioEmbudo, datos: Record<string, unknown>): Promise<string> {
  if (negocio.clienteId) return negocio.clienteId

  const existente = await prisma.cliente.findFirst({
    where: { nombre: { equals: negocio.cliente, mode: 'insensitive' }, activo: true },
    select: { id: true },
  })
  if (existente) return existente.id

  const creado = await prisma.cliente.create({
    data: {
      nombre: negocio.cliente,
      tipo: 'OTRO',
      contacto: typeof datos.contactoNombre === 'string' ? datos.contactoNombre : undefined,
      telefono: typeof datos.telefono === 'string' ? datos.telefono : undefined,
      email: typeof datos.email === 'string' ? datos.email : undefined,
    },
    select: { id: true },
  })
  return creado.id
}

function armarObservaciones(datos: Record<string, unknown>, negocioNumero: number): string | null {
  const partes: string[] = []
  if (typeof datos.tipoVenta === 'string') partes.push(`Tipo venta: ${datos.tipoVenta}`)
  if (typeof datos.numeroLicitacion === 'string' && datos.numeroLicitacion.trim()) {
    partes.push(`Licitación: ${datos.numeroLicitacion.trim()}`)
  }
  if (typeof datos.observacionesPropuesta === 'string' && datos.observacionesPropuesta.trim()) {
    partes.push(datos.observacionesPropuesta.trim())
  }
  partes.push(`Origen: embudo CRM negocio #${negocioNumero}`)
  return partes.filter(Boolean).join('\n') || null
}

async function armarItemsLinea(
  negocio: NegocioEmbudo,
  datos: Record<string, unknown>,
  clienteId: string,
  montoTotal: number,
) {
  const inventarioId = inventarioIdNegocio(negocio, datos)
  const descripcionFallback = negocio.productoServicio?.trim() || negocio.nombre
  const alicuotaIvaPct = 21

  if (inventarioId) {
    const inv = await prisma.inventario.findUnique({
      where: { id: inventarioId },
      select: { id: true, nombre: true, sku: true, precioUnit: true },
    })
    if (!inv) throw new ApiError(400, 'Producto del inventario no encontrado')

    let precioUnit = inv.precioUnit ?? 0
    if (precioUnit <= 0 && montoTotal > 0) {
      precioUnit = Math.round((montoTotal / (1 + alicuotaIvaPct / 100)) * 100) / 100
    }

    const itemsBase = [{
      descripcion: inv.nombre,
      codigo: inv.sku ?? undefined,
      cantidad: 1,
      precioUnit,
      inventarioId: inv.id,
    }]

    const itemsConPrecio = await aplicarPreciosResueltosItems(itemsBase, { clienteId, moneda: 'ARS' })
    return { items: itemsConPrecio, alicuotaIvaPct }
  }

  const precioNeto = Math.round((montoTotal / (1 + alicuotaIvaPct / 100)) * 100) / 100
  return {
    items: [{ descripcion: descripcionFallback, cantidad: 1, precioUnit: precioNeto }],
    alicuotaIvaPct,
  }
}

/** Crea presupuesto ENVIADO en el ERP y devuelve { id, numero }. */
export async function crearPresupuestoDesdePropuesta(
  negocio: NegocioEmbudo,
  datos: Record<string, unknown>,
  usuarioId?: string,
): Promise<{ id: string; numero: string; clienteId: string }> {
  const montoTotal = Number(datos.montoPropuesta)
  if (!Number.isFinite(montoTotal) || montoTotal <= 0) {
    throw new ApiError(400, 'El monto de la propuesta es obligatorio para generar el presupuesto')
  }

  const clienteId = await resolverClienteId(negocio, {
    ...(negocio.datos as object),
    ...datos,
  })

  const fechaEnvio = datos.fechaEnvio ? new Date(String(datos.fechaEnvio)) : new Date()
  const fechaVenc = datos.fechaVencimiento ? new Date(String(datos.fechaVencimiento)) : new Date()
  if (datos.fechaVencimiento && fechaVenc.getTime() < fechaEnvio.getTime()) {
    throw new ApiError(400, 'La fecha de vencimiento debe ser posterior al envío')
  }
  const vigenciaDias = datos.fechaVencimiento ? diasEntre(fechaEnvio, fechaVenc) : 15

  const condicionPago =
    typeof datos.condicionPago === 'string' ? CONDICION_PAGO[datos.condicionPago] ?? datos.condicionPago : undefined
  const plazoEntrega =
    typeof datos.plazoEntrega === 'string' ? PLAZO_ENTREGA[datos.plazoEntrega] ?? datos.plazoEntrega : undefined

  let garantia: string | null = null
  if (datos.incluyeGarantia === 'SI') {
    const meses = datos.mesesGarantia != null ? String(datos.mesesGarantia) : ''
    garantia = meses ? `${meses} meses` : 'Con garantía'
  }

  const emisor = await prisma.emisor.findFirst({ where: { predeterminado: true, activo: true } })
  const plantillaId = await resolverPlantillaIdEmision('PRESUPUESTO', null)

  const { items, alicuotaIvaPct } = await armarItemsLinea(negocio, datos, clienteId, montoTotal)

  const { itemsCalculados, subtotal, iva, total, alicuotaIvaPct: alic } = calcularTotalesPresupuesto({
    items,
    alicuotaIvaPct,
    condicionPago,
  })

  const vence = new Date(fechaEnvio)
  vence.setDate(vence.getDate() + vigenciaDias)

  const presupuesto = await crearConNumeroUnico(
    siguienteNumeroPresupuesto,
    (numero) =>
      prisma.presupuesto.create({
        data: {
          numero,
          estado: 'ENVIADO',
          clienteId,
          emisorId: emisor?.id ?? null,
          plantillaId,
          vendedorId: usuarioId ?? null,
          condicionPago,
          vigenciaDias,
          observaciones: armarObservaciones(datos, negocio.numero),
          plazoEntrega,
          garantia,
          bonificacionPct: 0,
          alicuotaIvaPct: alic,
          subtotal,
          iva,
          total,
          fechaEmision: fechaEnvio,
          fechaVencimiento: vence,
          items: {
            create: itemsCalculados.map((i) => ({
              descripcion: i.descripcion,
              codigo: i.codigo ?? null,
              cantidad: i.cantidad,
              precioUnit: i.precioUnit,
              bonificacionPct: 0,
              alicuotaIvaPct: i.alicuotaIvaPct,
              subtotal: i.subtotal,
              inventarioId: i.inventarioId ?? null,
            })),
          },
        },
      }),
  )

  void import('@/lib/presupuestos/notify-cliente-enviado').then(({ notifyClientePresupuestoEnviado }) =>
    notifyClientePresupuestoEnviado(presupuesto.id).catch(() => null),
  )

  return { id: presupuesto.id, numero: presupuesto.numero, clienteId }
}
