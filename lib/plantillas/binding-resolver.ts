import { formatFecha } from '@/lib/utils'
import { formatImporteDoc } from './format-importe'
import { numeroALetrasMoneda, etiquetaMoneda } from '@/lib/moneda'
import type { DatosDocumentoRender, PlantillaConfig } from './types'

const TITULO_DOC: Record<string, string> = {
  PRESUPUESTO: 'Presupuesto',
  FACTURA: 'Factura',
  REMITO: 'Remito',
}

export function resolveBinding(
  binding: string | undefined,
  datos: DatosDocumentoRender,
  cfg: PlantillaConfig,
): string {
  if (!binding) return ''
  const e = datos.emisor
  const c = datos.cliente
  const moneda = datos.moneda ?? 'ARS'
  const fmt = (m: number) => formatImporteDoc(m, datos)

  const map: Record<string, string> = {
    'emisor.razonSocial': e.razonSocial,
    'emisor.cuit': e.cuit,
    'emisor.condicionIva': e.condicionIva,
    'emisor.ingresosBrutos': e.ingresosBrutos ?? e.cuit,
    'emisor.inicioActividades': e.inicioActividades ?? '—',
    'emisor.domicilio': e.domicilio ?? '',
    'emisor.telefono': e.telefono ?? '',
    'emisor.email': e.email ?? '',
    'emisor.contacto': [
      e.telefono ? `Cel: ${e.telefono}` : '',
      e.email ? `Mail: ${e.email}` : '',
    ]
      .filter(Boolean)
      .join(' · '),
    'cliente.nombre': c.nombre,
    'cliente.direccion': c.direccion ?? '',
    'cliente.cuit': c.cuit ?? '',
    'cliente.condicionIva': c.condicionIva ?? '',
    'cliente.condicionPago': c.condicionPago ?? '',
    'documento.condicionPago': datos.condicionPago ?? '',
    'documento.plazosCobranza': datos.condicionPago ?? '',
    'documento.tasaFinanciacion': (datos.tasaFinanciacionPct ?? 0) > 0
      ? `${datos.tasaFinanciacionPct}% mensual`
      : '',
    'documento.interesFinanciacion': fmt(datos.interesFinanciacion ?? 0),
    'documento.presupuestoRef': datos.presupuestoNumero ?? '',
    'documento.moneda': etiquetaMoneda(moneda),
    'documento.cotizacionUsd':
      moneda === 'USD' && datos.cotizacionUsd
        ? `$ ${datos.cotizacionUsd.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`
        : '',
    'cliente.vendedor': c.vendedor ?? '',
    'cliente.direccionEntrega': c.direccionEntrega ?? '',
    'cliente.ordenCompra': c.ordenCompra ?? '',
    'documento.numero': datos.numero,
    'documento.fecha': formatFecha(datos.fechaEmision),
    'documento.titulo': `${TITULO_DOC[datos.tipo] ?? datos.tipo} ${datos.numero}`,
    'documento.tipo': datos.tipo,
    'documento.leyendaNoFiscal': cfg.observaciones.leyendaNoFiscal ?? '',
    'documento.marca': cfg.encabezado.leyenda ?? e.razonSocial,
    'totales.iva': fmt(datos.iva),
    'totales.interesFinanciacion': fmt(datos.interesFinanciacion ?? 0),
    'totales.bonificacion': fmt(datos.bonificacionPct ?? 0),
    'totales.neto': fmt(datos.subtotal),
    'totales.total': fmt(datos.total),
    'totales.enLetras': datos.total > 0 ? numeroALetrasMoneda(datos.total, moneda) : '',
    'totales.equivalenteArs':
      moneda === 'USD' && datos.cotizacionUsd
        ? fmt(datos.total * datos.cotizacionUsd)
        : '',
    'observaciones.vigencia':
      datos.vigenciaDias != null ? `Vigencia: ${datos.vigenciaDias} días` : '',
    'observaciones.formaPago': datos.formaPago ? `Forma de pago: ${datos.formaPago}` : '',
    'observaciones.plazosCobranza': datos.condicionPago ? `Plazos de cobranza: ${datos.condicionPago}` : '',
    'observaciones.tasaFinanciacion':
      (datos.tasaFinanciacionPct ?? 0) > 0
        ? `Tasa de financiación: ${datos.tasaFinanciacionPct}% mensual`
        : '',
    'observaciones.plazoEntrega': datos.plazoEntrega ? `Plazo de entrega: ${datos.plazoEntrega}` : '',
    'observaciones.garantia': datos.garantia ? `Garantia: ${datos.garantia}` : '',
    'observaciones.texto': datos.observaciones ?? '',
  }

  if (binding.startsWith('static:')) return binding.slice(7)
  return map[binding] ?? binding
}

export function formatFieldValue(
  binding: string | undefined,
  label: string | undefined,
  datos: DatosDocumentoRender,
  cfg: PlantillaConfig,
): string {
  const val = resolveBinding(binding, datos, cfg)
  if (!val) return label ?? ''
  if (label) return `${label}${val}`
  return val
}
