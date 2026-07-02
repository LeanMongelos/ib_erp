/**
 * Render PDF de presupuestos/facturas con @react-pdf/renderer.
 * Layout presupuesto alineado al formato IB (ejemplo Haemonetics).
 */

import React from 'react'
import {
  Document, Page, Text, View, StyleSheet, Image, renderToBuffer,
} from '@react-pdf/renderer'
import type { PlantillaConfig, DatosDocumentoRender } from './types'
import { LayoutDocumentPage, tieneLayoutBloques } from './render-layout'
import { prepararConfigRender } from './resolver-plantilla'
import { numeroALetras } from './numero-a-letras'
import { formatFecha } from '@/lib/utils'
import { formatImporteDoc, formatCantidadAr } from './format-importe'

const ib = StyleSheet.create({
  page: { padding: 28, fontSize: 8, fontFamily: 'Helvetica', color: '#000' },
  fiscalRow: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#000',
    marginBottom: 6,
  },
  fiscalCell: {
    flex: 1,
    padding: 4,
    borderRightWidth: 1,
    borderRightColor: '#000',
    fontSize: 7,
  },
  fiscalLast: { flex: 1, padding: 4, fontSize: 7 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  noFiscal: { textAlign: 'center', fontSize: 9, marginVertical: 4, textTransform: 'lowercase' },
  marca: { textAlign: 'center', fontSize: 14, fontWeight: 'bold', marginTop: 2 },
  contacto: { textAlign: 'center', fontSize: 8, marginBottom: 8 },
  clienteBox: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#000',
    marginBottom: 8,
    minHeight: 72,
  },
  clienteCol: { flex: 1, padding: 6, borderRightWidth: 1, borderRightColor: '#000' },
  clienteColLast: { flex: 1, padding: 6 },
  label: { fontWeight: 'bold' },
  tableHead: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#000',
    backgroundColor: '#E8650A',
    paddingVertical: 4,
    paddingHorizontal: 3,
    fontWeight: 'bold',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
    paddingVertical: 4,
    paddingHorizontal: 3,
    minHeight: 36,
  },
  colProd: { width: '12%' },
  colDesc: { width: '43%' },
  colCant: { width: '10%', textAlign: 'center' },
  colPrecio: { width: '17%', textAlign: 'center' },
  colSub: { width: '18%', textAlign: 'center' },
  totalsBox: { marginTop: 8, alignSelf: 'flex-end', width: 240 },
  totalLine: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
  letras: { marginTop: 8, fontSize: 7, fontStyle: 'italic' },
  obs: { marginTop: 10, fontSize: 8, borderTopWidth: 1, borderTopColor: '#ccc', paddingTop: 6 },
  simpleHeader: { marginBottom: 12, borderBottomWidth: 2, borderBottomColor: '#E8650A', paddingBottom: 8 },
  simpleTitle: { fontSize: 14, fontWeight: 'bold', color: '#E8650A' },
  foto: { width: 36, height: 36, objectFit: 'contain' },
})

function PresupuestoIB({ cfg, datos }: { cfg: PlantillaConfig; datos: DatosDocumentoRender }) {
  const c = datos.cliente
  const e = datos.emisor
  const bonif = datos.bonificacionPct ?? 0

  return (
    <Page size={cfg.papel} style={ib.page}>
      <View style={ib.fiscalRow}>
        <View style={ib.fiscalCell}><Text>CUIT {e.cuit}</Text></View>
        <View style={ib.fiscalCell}><Text>Ingresos Brutos {e.ingresosBrutos ?? e.cuit}</Text></View>
        <View style={ib.fiscalCell}><Text>Inicio de Actividades {e.inicioActividades ?? '—'}</Text></View>
        <View style={ib.fiscalLast}><Text>{e.condicionIva}</Text></View>
      </View>

      <View style={ib.metaRow}>
        <Text>Fecha: {formatFecha(datos.fechaEmision)}</Text>
        <Text style={{ fontSize: 11, fontWeight: 'bold' }}>Presupuesto {datos.numero}</Text>
      </View>

      {cfg.observaciones.leyendaNoFiscal && (
        <Text style={ib.noFiscal}>{cfg.observaciones.leyendaNoFiscal}</Text>
      )}

      <Text style={ib.marca}>{cfg.encabezado.leyenda ?? e.razonSocial}</Text>
      {e.domicilio && <Text style={ib.contacto}>{e.domicilio}</Text>}
      {e.telefono && <Text style={ib.contacto}>Cel: {e.telefono}</Text>}
      {e.email && <Text style={ib.contacto}>Mail: {e.email}</Text>}

      <View style={ib.clienteBox}>
        <View style={ib.clienteCol}>
          <Text><Text style={ib.label}>Cliente: </Text>{c.nombre}</Text>
          {c.direccion && <Text><Text style={ib.label}>Dirección: </Text>{c.direccion}</Text>}
          {c.direccionEntrega && (
            <Text><Text style={ib.label}>Dirección de entrega: </Text>{c.direccionEntrega}</Text>
          )}
        </View>
        <View style={ib.clienteColLast}>
          {c.cuit && <Text><Text style={ib.label}>CUIT: </Text>{c.cuit}</Text>}
          {c.condicionIva && <Text><Text style={ib.label}>Situac. IVA: </Text>{c.condicionIva}</Text>}
          {c.vendedor && <Text><Text style={ib.label}>Vendedor: </Text>{c.vendedor}</Text>}
          {c.ordenCompra && <Text><Text style={ib.label}>Orden de compra: </Text>{c.ordenCompra}</Text>}
          {c.condicionPago && <Text><Text style={ib.label}>Cond. de pago: </Text>{c.condicionPago}</Text>}
        </View>
      </View>

      <View style={ib.tableHead}>
        <Text style={[ib.colProd, { color: '#fff' }]}>Producto</Text>
        <Text style={[ib.colDesc, { color: '#fff' }]}>Descripción</Text>
        <Text style={[ib.colCant, { color: '#fff' }]}>Cantidad</Text>
        <Text style={[ib.colPrecio, { color: '#fff' }]}>Precio</Text>
        <Text style={[ib.colSub, { color: '#fff' }]}>Sub total</Text>
      </View>

      {datos.items.map((item, idx) => (
        <View key={idx} style={ib.tableRow}>
          <View style={ib.colProd}>
            <Text>{item.codigo ?? '—'}</Text>
          </View>
          <View style={ib.colDesc}>
            <Text>{item.descripcion}</Text>
            {item.descripcionLarga ? (
              <Text style={{ fontSize: 7, marginTop: 2, color: '#333' }}>{item.descripcionLarga}</Text>
            ) : null}
          </View>
          <Text style={ib.colCant}>{formatCantidadAr(item.cantidad)}</Text>
          <Text style={ib.colPrecio}>{formatImporteDoc(item.precioUnit, datos)}</Text>
          <Text style={ib.colSub}>{formatImporteDoc(item.subtotal, datos)}</Text>
        </View>
      ))}

      <View style={ib.totalsBox}>
        <View style={ib.totalLine}>
          <Text>SubTotal</Text>
          <Text>{formatImporteDoc(datos.subtotal, datos)}</Text>
        </View>
        <View style={ib.totalLine}>
          <Text>SubTotal Neto</Text>
          <Text>{formatImporteDoc(datos.subtotal, datos)}</Text>
        </View>
        <View style={[ib.totalLine, { fontWeight: 'bold', fontSize: 10 }]}>
          <Text>Total</Text>
          <Text>{formatImporteDoc(datos.total, datos)}</Text>
        </View>
        <View style={ib.totalLine}>
          <Text>SON Pesos</Text>
          <Text>{formatImporteDoc(bonif, datos)} Bonificación</Text>
        </View>
      </View>

      {cfg.importeEnLetras && datos.total > 0 && (
        <Text style={ib.letras}>{numeroALetras(datos.total)}</Text>
      )}

      <View style={ib.obs}>
        <Text style={ib.label}>Observaciones:</Text>
        {datos.vigenciaDias != null && <Text>Vigencia: {datos.vigenciaDias} días</Text>}
        {datos.formaPago && <Text>Forma de pago: {datos.formaPago}</Text>}
        {datos.condicionPago && <Text>Plazos de cobranza: {datos.condicionPago}</Text>}
        {(datos.tasaFinanciacionPct ?? 0) > 0 && (
          <Text>Tasa de financiación: {datos.tasaFinanciacionPct}% mensual</Text>
        )}
        {datos.plazoEntrega && <Text>Plazo de entrega: {datos.plazoEntrega}</Text>}
        {datos.garantia && <Text>Garantia: {datos.garantia}</Text>}
        {datos.observaciones ? <Text>{datos.observaciones}</Text> : null}
      </View>
    </Page>
  )
}

function DocumentoSimple({ cfg, datos }: { cfg: PlantillaConfig; datos: DatosDocumentoRender }) {
  const esRemito = datos.tipo === 'REMITO'
  const titulo = esRemito
    ? `REMITO Nº ${datos.numero}`
    : `FACTURA ${datos.tipoFactura ?? 'B'} Nº ${datos.numero}`

  const cols = cfg.items.columnas.filter((c) => c.visible)

  return (
    <Page size={cfg.papel} style={ib.page}>
      <View style={ib.simpleHeader}>
        <Text style={ib.simpleTitle}>{cfg.encabezado.leyenda ?? datos.emisor.razonSocial}</Text>
        <Text>{datos.emisor.razonSocial}</Text>
        <Text>CUIT: {datos.emisor.cuit} · {datos.emisor.condicionIva}</Text>
      </View>

      <Text style={{ fontSize: 12, fontWeight: 'bold', marginBottom: 8 }}>{titulo}</Text>
      <Text>Fecha: {formatFecha(datos.fechaEmision)}</Text>

      <View style={{ marginTop: 10 }}>
        <Text style={ib.label}>Cliente: {datos.cliente.nombre}</Text>
        {datos.cliente.cuit && <Text>CUIT: {datos.cliente.cuit}</Text>}
      </View>

      <View style={[ib.tableHead, { marginTop: 10 }]}>
        {cols.map((col) => {
          const align = ['cantidad', 'precioUnit', 'subtotal'].includes(col.key) ? 'center' : 'left'
          return (
            <Text key={col.key} style={{ width: `${col.anchoPct}%`, textAlign: align as 'left' | 'center' }}>{col.label}</Text>
          )
        })}
      </View>

      {datos.items.map((item, idx) => (
        <View key={idx} style={ib.tableRow}>
          {cols.map((col) => {
            if (col.key === 'codigo') return <Text key={col.key} style={{ width: `${col.anchoPct}%` }}>{item.codigo ?? '—'}</Text>
            if (col.key === 'descripcion') return <Text key={col.key} style={{ width: `${col.anchoPct}%` }}>{item.descripcion}</Text>
            if (col.key === 'cantidad') return <Text key={col.key} style={{ width: `${col.anchoPct}%`, textAlign: 'center' }}>{formatCantidadAr(item.cantidad)}</Text>
            if (col.key === 'precioUnit') return <Text key={col.key} style={{ width: `${col.anchoPct}%`, textAlign: 'center' }}>{formatImporteDoc(item.precioUnit, datos)}</Text>
            if (col.key === 'subtotal') return <Text key={col.key} style={{ width: `${col.anchoPct}%`, textAlign: 'center' }}>{formatImporteDoc(item.subtotal, datos)}</Text>
            if (col.key === 'foto' && item.fotoUrl) {
              return (
                <View key={col.key} style={{ width: `${col.anchoPct}%` }}>
                  <Image src={item.fotoUrl} style={ib.foto} />
                </View>
              )
            }
            return <Text key={col.key} style={{ width: `${col.anchoPct}%` }}> </Text>
          })}
        </View>
      ))}

      {!esRemito && (
        <View style={ib.totalsBox}>
          <View style={[ib.totalLine, { fontWeight: 'bold' }]}>
            <Text>TOTAL</Text>
            <Text>{formatImporteDoc(datos.total, datos)}</Text>
          </View>
        </View>
      )}

      {cfg.pieFiscal.cae && datos.cae && (
        <View style={{ marginTop: 16, fontSize: 8 }}>
          <Text>CAE: {datos.cae}</Text>
          {datos.qrDataUrl && <Image src={datos.qrDataUrl} style={{ width: 80, height: 80, marginTop: 4 }} />}
        </View>
      )}
    </Page>
  )
}

function DocPDF({ cfg, datos }: { cfg: PlantillaConfig; datos: DatosDocumentoRender }) {
  if (tieneLayoutBloques(cfg)) {
    return (
      <Document>
        <LayoutDocumentPage cfg={cfg} datos={datos} />
      </Document>
    )
  }
  const esPresupuesto = datos.tipo === 'PRESUPUESTO'
  return (
    <Document>
      {esPresupuesto ? (
        <PresupuestoIB cfg={cfg} datos={datos} />
      ) : (
        <DocumentoSimple cfg={cfg} datos={datos} />
      )}
    </Document>
  )
}

export async function renderDocumentoPDF(
  cfg: PlantillaConfig,
  datos: DatosDocumentoRender,
): Promise<Buffer> {
  const cfgNorm = prepararConfigRender(cfg, datos.tipo as 'FACTURA' | 'PRESUPUESTO' | 'REMITO')

  // Layout visual (editor de plantillas) = mismo motor en preview y en facturación
  if (tieneLayoutBloques(cfgNorm)) {
    return renderToBuffer(<DocPDF cfg={cfgNorm} datos={datos} />)
  }

  let html = cfgNorm.html?.trim()
  if (!html && (cfgNorm.tipo === 'FACTURA' || cfgNorm.tipo === 'PRESUPUESTO' || cfgNorm.tipo === 'REMITO')) {
    const { htmlDefaultPorTipo } = await import('./html-templates')
    html = htmlDefaultPorTipo(cfgNorm.tipo)
  }
  if (html) {
    try {
      const { renderHtmlDocumento } = await import('./render-html')
      const { htmlToPdf } = await import('./html-to-pdf.server')
      const { isValidPdfBuffer } = await import('./pdf-valid')
      const rendered = renderHtmlDocumento(html, datos)
      const pdf = await htmlToPdf(rendered, cfgNorm.papel)
      if (isValidPdfBuffer(pdf)) return pdf
      console.error('[plantillas] Puppeteer devolvió PDF inválido, usando react-pdf')
    } catch (error) {
      console.error('[plantillas] HTML/Puppeteer falló, usando react-pdf:', error)
    }
  }
  return renderToBuffer(<DocPDF cfg={cfgNorm} datos={datos} />)
}
