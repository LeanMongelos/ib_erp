/**
 * Sustitución de placeholders {{campo}} en plantillas HTML.
 */
import type { DatosDocumentoRender, ItemDocumentoRender } from './types'
import { formatImporteDoc, formatCantidadAr } from './format-importe'
import { numeroALetrasMoneda, etiquetaMoneda } from '@/lib/moneda'
import { formatFecha } from '@/lib/utils'
import { parsePlazosCobranza } from '@/lib/cobranzas/plazos'
import { previewVencimientosConFinanciacion } from '@/lib/cobranzas/financiacion'

function esc(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function fmtFechaCorta(fecha: string | null | undefined): string {
  if (!fecha) return ''
  const d = new Date(fecha)
  if (Number.isNaN(d.getTime())) return fecha
  return formatFecha(d)
}

function itemPlaceholders(item: ItemDocumentoRender | undefined, n: number, datos: DatosDocumentoRender): Record<string, string> {
  if (!item) {
    return {
      [`item${n}_codigo`]: '',
      [`item${n}_descripcion_corta`]: '',
      [`item${n}_descripcion_larga`]: '',
      [`item${n}_cantidad`]: '',
      [`item${n}_precio`]: '',
      [`item${n}_subtotal`]: '',
    }
  }
  return {
    [`item${n}_codigo`]: esc(item.codigo ?? ''),
    [`item${n}_descripcion_corta`]: esc(item.descripcion),
    [`item${n}_descripcion_larga`]: esc(item.descripcionLarga ?? ''),
    [`item${n}_cantidad`]: formatCantidadAr(item.cantidad),
    [`item${n}_precio`]: formatImporteDoc(item.precioUnit, datos),
    [`item${n}_subtotal`]: formatImporteDoc(item.subtotal, datos),
  }
}

function filaItemHtml(item: ItemDocumentoRender, datos: DatosDocumentoRender): string {
  const precios =
    datos.tipo === 'REMITO'
      ? ''
      : `
        <td class="right">${formatImporteDoc(item.precioUnit, datos)}</td>
        <td class="right">${formatImporteDoc(item.subtotal, datos)}</td>`
  return `<tr>
        <td class="cod-item">${esc(item.codigo ?? '')}</td>
        <td>
          <div class="desc-main">${esc(item.descripcion)}</div>
          <div class="desc-detalle">${esc(item.descripcionLarga ?? '')}</div>
        </td>
        <td class="center">${formatCantidadAr(item.cantidad)}</td>${precios}
      </tr>`
}

function buildFilasTotalesExtra(datos: DatosDocumentoRender): string {
  const rows: string[] = []
  if (datos.iva > 0) {
    rows.push(
      `<div class="t-row"><span class="t-label">IVA</span><span class="t-value">${formatImporteDoc(datos.iva, datos)}</span></div>`,
    )
  }
  const interes = datos.interesFinanciacion ?? 0
  if (interes > 0) {
    const tasa = datos.tasaFinanciacionPct ?? 0
    const label =
      tasa > 0 ? `Interés financiación (${tasa}% mens.)` : 'Interés financiación'
    rows.push(
      `<div class="t-row"><span class="t-label">${esc(label)}</span><span class="t-value">${formatImporteDoc(interes, datos)}</span></div>`,
    )
  }
  return rows.join('\n      ')
}

function buildSeccionCronograma(datos: DatosDocumentoRender): string {
  const plazos = parsePlazosCobranza(datos.condicionPago)
  if (plazos.length === 0) return ''

  const bonifPct = datos.bonificacionPct ?? 0
  const bonifImporte = datos.subtotal * bonifPct / 100
  const totalNeto = datos.subtotal - bonifImporte + datos.iva
  const tasa = datos.tasaFinanciacionPct ?? 0
  const fecha = new Date(datos.fechaEmision)
  const cuotas = previewVencimientosConFinanciacion(fecha, plazos, totalNeto, tasa)
  if (cuotas.length === 0) return ''

  const filas = cuotas
    .map(
      (c) =>
        `<div class="cron-row"><span>Cuota ${c.numeroCuota} — día ${c.dias} (${formatFecha(c.fecha)})</span><span class="cron-monto">${formatImporteDoc(c.monto, datos)}</span></div>`,
    )
    .join('\n        ')

  return `<div class="cronograma">
      <div class="obs-title">Cronograma de cobranza</div>
      <div class="cron-body">
        ${filas}
      </div>
    </div>`
}

export function buildHtmlPlaceholderMap(datos: DatosDocumentoRender): Record<string, string> {
  const e = datos.emisor
  const c = datos.cliente
  const bonifPct = datos.bonificacionPct ?? 0
  const bonifImporte = datos.subtotal * bonifPct / 100
  const plazosTexto = datos.condicionPago?.trim() || 'Contado'
  const tasa = datos.tasaFinanciacionPct ?? 0
  const interes = datos.interesFinanciacion ?? 0

  const moneda = datos.moneda ?? 'ARS'
  const cotizacion = datos.cotizacionUsd ?? null
  const equivalenteArs =
    moneda === 'USD' && cotizacion ? datos.total * cotizacion : null

  // ── AFIP: letra, código de comprobante, punto de venta, número, CAE, QR ──
  const letra = datos.tipoFactura ?? 'B'
  const codComprobante = ({ A: '01', B: '06', C: '11' } as Record<string, string>)[letra] ?? '06'
  const puntoVentaStr = String(datos.puntoVenta ?? 1).padStart(4, '0')
  const compNro = (datos.numero.replace(/\D/g, '') || '0').slice(-8).padStart(8, '0')
  const qrHtml = datos.qrDataUrl
    ? `<img class="qr-img" src="${datos.qrDataUrl}" alt="QR AFIP" />`
    : '<div class="qr-placeholder">Código QR AFIP<br/>(se genera al emitir)</div>'

  // Leyenda informativa "IVA incluido" — solo Facturas B/C (en A el IVA se discrimina).
  // IVA contenido calculado por la alícuota REAL de cada ítem (soporta 21%, 10,5%,
  // exento y facturas con alícuotas mixtas). En B/C el precio ya incluye el IVA.
  const bonifFactor = 1 - bonifPct / 100
  const ratesGravadas = new Set<number>()
  let ivaContenido = 0
  for (const it of datos.items) {
    const rate = it.alicuotaIvaPct ?? 0
    if (rate > 0) {
      ratesGravadas.add(rate)
      const brutoItem = it.subtotal * bonifFactor
      ivaContenido += brutoItem * (rate / (100 + rate))
    }
  }
  ivaContenido = Math.round(ivaContenido * 100) / 100
  const rateLabel =
    ratesGravadas.size === 1 ? ` (${[...ratesGravadas][0].toLocaleString('es-AR')}%)` : ''
  const ivaIncluidoLeyenda =
    datos.tipo === 'FACTURA' && letra !== 'A' && ivaContenido > 0
      ? `Los precios incluyen IVA${rateLabel}. IVA contenido: ${formatImporteDoc(ivaContenido, datos)}`
      : ''

  const map: Record<string, string> = {
    empresa_nombre: esc(e.razonSocial),
    empresa_direccion: esc(e.domicilio ?? ''),
    empresa_telefono: esc(e.telefono ?? ''),
    empresa_email: esc(e.email ?? ''),
    empresa_cuit: esc(e.cuit),
    empresa_ingresos_brutos: esc(e.ingresosBrutos ?? e.cuit),
    empresa_inicio_actividades: esc(fmtFechaCorta(e.inicioActividades ?? null)),
    empresa_condicion_iva: esc(e.condicionIva),
    presupuesto_numero: esc(datos.numero),
    presupuesto_fecha: formatFecha(datos.fechaEmision),
    factura_numero: esc(datos.tipoFactura ? `${datos.tipoFactura} ${datos.numero}` : datos.numero),
    factura_fecha: formatFecha(datos.fechaEmision),
    factura_letra: esc(letra),
    factura_cod_comprobante: codComprobante,
    factura_punto_venta: puntoVentaStr,
    factura_comp_nro: compNro,
    factura_original: 'ORIGINAL',
    factura_cae: esc(datos.cae ?? ''),
    factura_cae_vencimiento: esc(fmtFechaCorta(datos.caeVencimiento)),
    factura_qr: qrHtml,
    factura_iva_incluido: esc(ivaIncluidoLeyenda),
    cliente_condicion_venta: esc(plazosTexto),
    documento_numero: esc(datos.numero),
    documento_fecha: formatFecha(datos.fechaEmision),
    cliente_nombre: esc(c.nombre),
    vendedor_nombre: esc(c.vendedor ?? ''),
    cliente_direccion: esc(c.direccion ?? ''),
    orden_compra: esc(c.ordenCompra ?? ''),
    cliente_cuit: esc(c.cuit ?? ''),
    condicion_pago: esc(plazosTexto),
    plazos_cobranza: esc(plazosTexto),
    cliente_condicion_pago: esc(c.condicionPago ?? ''),
    cliente_condicion_iva: esc(c.condicionIva ?? ''),
    fecha_entrega: esc(datos.plazoEntrega ?? ''),
    direccion_entrega: esc(c.direccionEntrega ?? c.direccion ?? ''),
    total_en_letras: esc(numeroALetrasMoneda(datos.total, moneda)),
    documento_moneda: esc(etiquetaMoneda(moneda)),
    documento_cotizacion_usd:
      moneda === 'USD' && cotizacion
        ? cotizacion.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })
        : '',
    total_equivalente_ars:
      equivalenteArs != null
        ? formatImporteDoc(equivalenteArs, { moneda: 'ARS' })
        : '',
    total_subtotal: formatImporteDoc(datos.subtotal, datos),
    total_bonificacion: formatImporteDoc(bonifImporte, datos),
    total_subtotal_neto: formatImporteDoc(datos.subtotal - bonifImporte, datos),
    total_iva: formatImporteDoc(datos.iva, datos),
    total_interes_financiacion: interes > 0 ? formatImporteDoc(interes, datos) : '',
    tasa_financiacion: tasa > 0 ? `${tasa}% mensual` : '',
    total_final: formatImporteDoc(datos.total, datos),
    filas_totales_extra: buildFilasTotalesExtra(datos),
    seccion_cronograma: buildSeccionCronograma(datos),
    presupuesto_ref: esc(datos.presupuestoNumero ?? ''),
    observaciones_texto: esc(datos.observaciones ?? ''),
    vigencia: datos.vigenciaDias != null ? `${datos.vigenciaDias} días` : '',
    forma_pago: esc(datos.formaPago ?? ''),
    plazo_entrega: esc(datos.plazoEntrega ?? ''),
    garantia: esc(datos.garantia ?? ''),
  }

  for (let i = 1; i <= 20; i++) {
    Object.assign(map, itemPlaceholders(datos.items[i - 1], i, datos))
  }

  return map
}

export function renderHtmlDocumento(html: string, datos: DatosDocumentoRender): string {
  const map = buildHtmlPlaceholderMap(datos)
  let result = html

  if (datos.items.length > 3) {
    const extra = datos.items.slice(3).map((item) => filaItemHtml(item, datos)).join('\n\n      ')
    result = result.replace(
      '<!-- Agregar más ítems repitiendo el bloque <tr> de arriba -->',
      `${extra}\n\n      <!-- Agregar más ítems repitiendo el bloque <tr> de arriba -->`,
    )
  }

  return result.replace(/\{\{(\w+)\}\}/g, (_, key: string) => map[key] ?? '')
}
