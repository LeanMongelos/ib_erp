/**
 * Render PDF desde layout de bloques posicionados (@react-pdf/renderer).
 */

import React from 'react'
import { Page, Text, View, Image, StyleSheet } from '@react-pdf/renderer'
import type { LayoutElement, PlantillaConfig, DatosDocumentoRender } from './types'
import { layoutRectPt } from './layout-utils'
import { formatImporteDoc, formatCantidadAr } from './format-importe'
import { formatFieldValue, resolveBinding } from './binding-resolver'
import { resolveImageSrc } from './resolve-image-src.server'
import { limitarTexto, textoColumnaItem } from './text-campo'

const COLS_NUMERICAS = new Set(['cantidad', 'precioUnit', 'subtotal'])

function alinearColumna(key: string): 'left' | 'center' | 'right' {
  return COLS_NUMERICAS.has(key) ? 'center' : 'left'
}

function estiloElemento(el: LayoutElement, cfg: PlantillaConfig) {
  const s = el.style ?? {}
  return {
    fontSize: s.fontSize ?? 8,
    fontWeight: s.fontWeight === 'bold' ? ('bold' as const) : ('normal' as const),
    color: s.color ?? '#000',
    backgroundColor: s.backgroundColor,
    textAlign: s.textAlign ?? ('left' as const),
    borderColor: s.borderColor ?? cfg.estilo.colorMarca,
    borderWidth: s.borderWidth ?? 0,
  }
}

const comp = StyleSheet.create({
  label: { fontWeight: 'bold' },
  fiscalRow: { flexDirection: 'row', borderWidth: 1, borderColor: '#000' },
  fiscalCell: { flex: 1, padding: 3, borderRightWidth: 1, borderRightColor: '#000' },
  fiscalLast: { flex: 1, padding: 3 },
  clienteBox: { flexDirection: 'row', borderWidth: 1, borderColor: '#000', flex: 1 },
  clienteCol: { flex: 1, padding: 5, borderRightWidth: 1, borderRightColor: '#000' },
  clienteColLast: { flex: 1, padding: 5 },
  tableHead: { flexDirection: 'row', paddingVertical: 3, paddingHorizontal: 2 },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
    paddingVertical: 3,
    paddingHorizontal: 2,
  },
  totalLine: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
})

function FiscalRowBlock({ el, datos, cfg }: { el: LayoutElement; datos: DatosDocumentoRender; cfg: PlantillaConfig }) {
  const e = datos.emisor
  const st = estiloElemento(el, cfg)
  return (
    <View style={[layoutRectPt(el), comp.fiscalRow, { fontSize: st.fontSize }]}>
      <View style={comp.fiscalCell}><Text>CUIT {e.cuit}</Text></View>
      <View style={comp.fiscalCell}><Text>Ingresos Brutos {e.ingresosBrutos ?? e.cuit}</Text></View>
      <View style={comp.fiscalCell}><Text>Inicio de Actividades {e.inicioActividades ?? '—'}</Text></View>
      <View style={comp.fiscalLast}><Text>{e.condicionIva}</Text></View>
    </View>
  )
}

function ClienteBoxBlock({ el, datos, cfg }: { el: LayoutElement; datos: DatosDocumentoRender; cfg: PlantillaConfig }) {
  const c = datos.cliente
  const st = estiloElemento(el, cfg)
  return (
    <View style={[layoutRectPt(el), comp.clienteBox, { fontSize: st.fontSize, borderColor: st.borderColor }]}>
      <View style={comp.clienteCol}>
        <Text><Text style={comp.label}>Cliente: </Text>{c.nombre}</Text>
        {c.direccion ? <Text><Text style={comp.label}>Dirección: </Text>{c.direccion}</Text> : null}
        {c.direccionEntrega ? (
          <Text><Text style={comp.label}>Dirección de entrega: </Text>{c.direccionEntrega}</Text>
        ) : null}
      </View>
      <View style={comp.clienteColLast}>
        {c.cuit ? <Text><Text style={comp.label}>CUIT: </Text>{c.cuit}</Text> : null}
        {c.condicionIva ? <Text><Text style={comp.label}>Situac. IVA: </Text>{c.condicionIva}</Text> : null}
        {c.vendedor ? <Text><Text style={comp.label}>Vendedor: </Text>{c.vendedor}</Text> : null}
        {c.ordenCompra ? <Text><Text style={comp.label}>Orden de compra: </Text>{c.ordenCompra}</Text> : null}
        {datos.condicionPago ? (
          <Text><Text style={comp.label}>Plazos de cobranza: </Text>{datos.condicionPago}</Text>
        ) : c.condicionPago ? (
          <Text><Text style={comp.label}>Cond. de pago: </Text>{c.condicionPago}</Text>
        ) : null}
      </View>
    </View>
  )
}

function ItemsTableBlock({ el, datos, cfg }: { el: LayoutElement; datos: DatosDocumentoRender; cfg: PlantillaConfig }) {
  const st = estiloElemento(el, cfg)
  const cols = (el.columns ?? cfg.items.columnas).filter((c) => c.visible)
  const headBg = st.backgroundColor ?? cfg.estilo.colorMarca
  const headColor = st.color ?? '#fff'

  return (
    <View style={[layoutRectPt(el, { autoHeight: true })]}>
      <View style={[comp.tableHead, { backgroundColor: headBg, borderWidth: 1, borderColor: '#000' }]}>
        {cols.map((col) => (
          <Text
            key={col.key}
            style={{
              width: `${col.anchoPct}%`,
              color: headColor,
              fontWeight: 'bold',
              fontSize: col.fontSize ?? st.fontSize,
              textAlign: alinearColumna(col.key),
            }}
          >
            {col.label}
          </Text>
        ))}
      </View>
      {datos.items.map((item, idx) => (
        <View key={idx} style={comp.tableRow}>
          {cols.map((col) => {
            const w = { width: `${col.anchoPct}%` as const }
            const opts = { maxChars: col.maxChars, overflow: col.overflow ?? 'wrap' }
            if (col.key === 'codigo') {
              return (
                <Text key={col.key} style={{ ...w, fontSize: col.fontSize ?? st.fontSize }}>
                  {limitarTexto(item.codigo ?? '—', { ...opts, overflow: col.overflow ?? 'truncate' })}
                </Text>
              )
            }
            if (col.key === 'descripcion') {
              const texto = textoColumnaItem('descripcion', item, opts)
              const fs = col.fontSize ?? st.fontSize ?? 8
              const partes = texto.split('\n')
              return (
                <View key={col.key} style={w}>
                  {partes.map((parte, pi) => (
                    <Text
                      key={pi}
                      style={{
                        fontSize: pi > 0 ? Math.max(6, fs - 1) : fs,
                        marginTop: pi > 0 ? 1 : 0,
                        color: pi > 0 ? '#333' : '#000',
                      }}
                    >
                      {parte}
                    </Text>
                  ))}
                </View>
              )
            }
            if (col.key === 'cantidad') {
              return (
                <Text key={col.key} style={{ ...w, textAlign: 'center', fontSize: col.fontSize ?? st.fontSize }}>
                  {formatCantidadAr(item.cantidad)}
                </Text>
              )
            }
            if (col.key === 'precioUnit') {
              return (
                <Text key={col.key} style={{ ...w, textAlign: 'center', fontSize: col.fontSize ?? st.fontSize }}>
                  {formatImporteDoc(item.precioUnit, datos)}
                </Text>
              )
            }
            if (col.key === 'subtotal') {
              return (
                <Text key={col.key} style={{ ...w, textAlign: 'center', fontSize: col.fontSize ?? st.fontSize }}>
                  {formatImporteDoc(item.subtotal, datos)}
                </Text>
              )
            }
            if (col.key === 'foto' && item.fotoUrl) {
              return (
                <View key={col.key} style={w}>
                  <Image src={item.fotoUrl} style={{ width: 32, height: 32, objectFit: 'contain' }} />
                </View>
              )
            }
            return <Text key={col.key} style={w}> </Text>
          })}
        </View>
      ))}
    </View>
  )
}

function TotalsBoxBlock({ el, datos, cfg }: { el: LayoutElement; datos: DatosDocumentoRender; cfg: PlantillaConfig }) {
  const st = estiloElemento(el, cfg)
  const bonif = datos.bonificacionPct ?? 0
  return (
    <View style={[layoutRectPt(el), { fontSize: st.fontSize, padding: 4 }]}>
      <View style={comp.totalLine}><Text>SubTotal</Text><Text>{formatImporteDoc(datos.subtotal, datos)}</Text></View>
      {cfg.totales.mostrarBonificacion && (
        <View style={comp.totalLine}><Text>Bonificación</Text><Text>{formatImporteDoc(bonif, datos)}</Text></View>
      )}
      {cfg.totales.mostrarNeto && (
        <View style={comp.totalLine}><Text>SubTotal Neto</Text><Text>{formatImporteDoc(datos.subtotal, datos)}</Text></View>
      )}
      {cfg.totales.discriminarIva && datos.iva > 0 && (
        <View style={comp.totalLine}><Text>IVA</Text><Text>{formatImporteDoc(datos.iva, datos)}</Text></View>
      )}
      {(datos.interesFinanciacion ?? 0) > 0 && (
        <View style={comp.totalLine}>
          <Text>Interés financiación</Text>
          <Text>{formatImporteDoc(datos.interesFinanciacion!, datos)}</Text>
        </View>
      )}
      <View style={[comp.totalLine, { fontWeight: 'bold', fontSize: (st.fontSize ?? 8) + 2 }]}>
        <Text>Total a cobrar</Text><Text>{formatImporteDoc(datos.total, datos)}</Text>
      </View>
      {cfg.importeEnLetras && (
        <View style={comp.totalLine}><Text>SON Pesos</Text><Text>{formatImporteDoc(bonif, datos)}</Text></View>
      )}
    </View>
  )
}

function ObservacionesBlock({ el, datos, cfg }: { el: LayoutElement; datos: DatosDocumentoRender; cfg: PlantillaConfig }) {
  const st = estiloElemento(el, cfg)
  return (
    <View style={[layoutRectPt(el), { fontSize: st.fontSize, paddingTop: 4, borderTopWidth: st.borderWidth || 1, borderTopColor: st.borderColor }]}>
      {el.label ? <Text style={comp.label}>{el.label}</Text> : null}
      {resolveBinding('observaciones.vigencia', datos, cfg) ? (
        <Text>{resolveBinding('observaciones.vigencia', datos, cfg)}</Text>
      ) : null}
      {resolveBinding('observaciones.formaPago', datos, cfg) ? (
        <Text>{resolveBinding('observaciones.formaPago', datos, cfg)}</Text>
      ) : null}
      {resolveBinding('observaciones.plazosCobranza', datos, cfg) ? (
        <Text>{resolveBinding('observaciones.plazosCobranza', datos, cfg)}</Text>
      ) : null}
      {resolveBinding('observaciones.tasaFinanciacion', datos, cfg) ? (
        <Text>{resolveBinding('observaciones.tasaFinanciacion', datos, cfg)}</Text>
      ) : null}
      {resolveBinding('observaciones.plazoEntrega', datos, cfg) ? (
        <Text>{resolveBinding('observaciones.plazoEntrega', datos, cfg)}</Text>
      ) : null}
      {resolveBinding('observaciones.garantia', datos, cfg) ? (
        <Text>{resolveBinding('observaciones.garantia', datos, cfg)}</Text>
      ) : null}
      {datos.observaciones ? <Text>{datos.observaciones}</Text> : null}
    </View>
  )
}

function ElementoSimple({ el, datos, cfg }: { el: LayoutElement; datos: DatosDocumentoRender; cfg: PlantillaConfig }) {
  const st = estiloElemento(el, cfg)
  const base = layoutRectPt(el)

  if (el.type === 'line') {
    return (
      <View
        style={[
          base,
          {
            borderBottomWidth: st.borderWidth || 1,
            borderBottomColor: st.borderColor,
            height: 1,
          },
        ]}
      />
    )
  }

  if (el.type === 'rect') {
    return (
      <View
        style={[
          base,
          {
            borderWidth: st.borderWidth || 1,
            borderColor: st.borderColor,
            backgroundColor: st.backgroundColor,
          },
        ]}
      />
    )
  }

  if (el.type === 'image') {
    const src = resolveImageSrc(el.binding, el.content)
    if (!cfg.encabezado.mostrarLogo && el.binding?.includes('logo')) return null
    return (
      <View style={base}>
        <Image src={src} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
      </View>
    )
  }

  const textoRaw =
    el.type === 'text'
      ? el.content ?? ''
      : formatFieldValue(el.binding, el.label, datos, cfg)

  const texto = limitarTexto(textoRaw, {
    maxChars: el.style?.maxChars,
    overflow: el.style?.overflow ?? 'wrap',
  })

  if (!texto && el.type === 'field') return null

  return (
    <View style={base}>
      <Text
        style={{
          fontSize: st.fontSize,
          fontWeight: st.fontWeight,
          color: st.color,
          textAlign: st.textAlign,
        }}
      >
        {texto}
      </Text>
    </View>
  )
}

function RenderElemento({ el, datos, cfg }: { el: LayoutElement; datos: DatosDocumentoRender; cfg: PlantillaConfig }) {
  if (el.visible === false) return null
  switch (el.type) {
    case 'fiscalRow':
      return <FiscalRowBlock el={el} datos={datos} cfg={cfg} />
    case 'clienteBox':
      return <ClienteBoxBlock el={el} datos={datos} cfg={cfg} />
    case 'itemsTable':
      return <ItemsTableBlock el={el} datos={datos} cfg={cfg} />
    case 'totalsBox':
      return <TotalsBoxBlock el={el} datos={datos} cfg={cfg} />
    case 'observacionesBlock':
      return <ObservacionesBlock el={el} datos={datos} cfg={cfg} />
    default:
      return <ElementoSimple el={el} datos={datos} cfg={cfg} />
  }
}

export function LayoutDocumentPage({ cfg, datos }: { cfg: PlantillaConfig; datos: DatosDocumentoRender }) {
  const layout = cfg.layout!
  const elementos = [...layout.elementos].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0))

  return (
    <Page size={cfg.papel} style={{ fontFamily: cfg.estilo.fuente || 'Helvetica', position: 'relative' }}>
      {elementos.map((el) => (
        <RenderElemento key={el.id} el={el} datos={datos} cfg={cfg} />
      ))}
    </Page>
  )
}

export function tieneLayoutBloques(cfg: PlantillaConfig): boolean {
  return Boolean(cfg.layout?.elementos?.length)
}
