/**
 * Informe PDF post-servicio de OT (minimal, sin plantilla configurable).
 */

import React from 'react'
import { Document, Page, Text, View, StyleSheet, renderToBuffer } from '@react-pdf/renderer'
import { formatFecha, formatFechaHora, formatMonto } from '@/lib/utils'
import {
  parseChecklistFromDiagnostico,
  formatChecklistParaPdf,
} from '@/lib/ots/checklist-solucion'

const s = StyleSheet.create({
  page: { padding: 36, fontSize: 10, fontFamily: 'Helvetica', color: '#1f242c' },
  header: { marginBottom: 16 },
  title: { fontSize: 16, fontWeight: 'bold', color: '#E8650A' },
  subtitle: { fontSize: 11, marginTop: 4, color: '#6b7280' },
  section: { marginTop: 12, marginBottom: 8 },
  sectionTitle: {
    fontSize: 9,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    color: '#8a909a',
    marginBottom: 4,
  },
  box: { borderWidth: 1, borderColor: '#e4e7eb', borderRadius: 4, padding: 8 },
  row: { flexDirection: 'row', marginBottom: 3 },
  label: { width: 120, fontWeight: 'bold', color: '#3a4150' },
  value: { flex: 1 },
  mono: { fontFamily: 'Helvetica', fontSize: 9 },
  footer: { marginTop: 24, fontSize: 8, color: '#9aa1ab', textAlign: 'center' },
})

export type DatosInformeOT = {
  numero: string
  tipo: string
  estado: string
  prioridad: string
  descripcion: string
  diagnostico: string | null
  fechaApertura: Date
  fechaCierre: Date | null
  slaVence: Date
  cliente: { nombre: string; ciudad?: string | null }
  equipo?: {
    nombre: string
    modelo?: string | null
    numeroSerie?: string | null
  } | null
  tecnico?: { nombre: string } | null
  repuestos: Array<{ descripcion: string; cantidad: number; precioUnit: number }>
  historial: Array<{ estado: string; nota: string | null; creadoEn: Date }>
}

function InformeOTDoc({ datos }: { datos: DatosInformeOT }) {
  const { checklist, texto: diagnosticoTexto } = parseChecklistFromDiagnostico(datos.diagnostico)
  const totalRepuestos = datos.repuestos.reduce((a, r) => a + r.cantidad * r.precioUnit, 0)

  return (
    <Document>
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <Text style={s.title}>Informe de servicio — {datos.numero}</Text>
          <Text style={s.subtitle}>iBiomédica ERP · {formatFechaHora(new Date())}</Text>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>Datos generales</Text>
          <View style={s.box}>
            <View style={s.row}>
              <Text style={s.label}>Cliente</Text>
              <Text style={s.value}>{datos.cliente.nombre}</Text>
            </View>
            {datos.cliente.ciudad && (
              <View style={s.row}>
                <Text style={s.label}>Ciudad</Text>
                <Text style={s.value}>{datos.cliente.ciudad}</Text>
              </View>
            )}
            <View style={s.row}>
              <Text style={s.label}>Tipo / Estado</Text>
              <Text style={s.value}>
                {datos.tipo} · {datos.estado} · {datos.prioridad}
              </Text>
            </View>
            <View style={s.row}>
              <Text style={s.label}>Apertura</Text>
              <Text style={s.value}>{formatFechaHora(datos.fechaApertura)}</Text>
            </View>
            {datos.fechaCierre && (
              <View style={s.row}>
                <Text style={s.label}>Cierre</Text>
                <Text style={s.value}>{formatFechaHora(datos.fechaCierre)}</Text>
              </View>
            )}
            {datos.tecnico && (
              <View style={s.row}>
                <Text style={s.label}>Técnico</Text>
                <Text style={s.value}>{datos.tecnico.nombre}</Text>
              </View>
            )}
          </View>
        </View>

        {datos.equipo && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Equipo</Text>
            <View style={s.box}>
              <Text>{datos.equipo.nombre}</Text>
              {datos.equipo.modelo && <Text>Modelo: {datos.equipo.modelo}</Text>}
              {datos.equipo.numeroSerie && <Text>N° serie: {datos.equipo.numeroSerie}</Text>}
            </View>
          </View>
        )}

        <View style={s.section}>
          <Text style={s.sectionTitle}>Descripción del problema</Text>
          <View style={s.box}>
            <Text>{datos.descripcion}</Text>
          </View>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>Checklist de cierre</Text>
          <View style={s.box}>
            <Text style={s.mono}>{formatChecklistParaPdf(checklist)}</Text>
          </View>
        </View>

        {diagnosticoTexto && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Diagnóstico / solución</Text>
            <View style={s.box}>
              <Text>{diagnosticoTexto}</Text>
            </View>
          </View>
        )}

        {datos.repuestos.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Repuestos ({formatMonto(totalRepuestos)})</Text>
            <View style={s.box}>
              {datos.repuestos.map((r, i) => (
                <Text key={i} style={s.mono}>
                  · {r.descripcion} × {r.cantidad} @ {formatMonto(r.precioUnit)}
                </Text>
              ))}
            </View>
          </View>
        )}

        {datos.historial.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Historial de estados</Text>
            <View style={s.box}>
              {datos.historial.map((h, i) => (
                <Text key={i} style={s.mono}>
                  {formatFecha(h.creadoEn)} — {h.estado}
                  {h.nota ? `: ${h.nota}` : ''}
                </Text>
              ))}
            </View>
          </View>
        )}

        <Text style={s.footer}>
          Documento generado automáticamente · OT {datos.numero} · SLA vence {formatFecha(datos.slaVence)}
        </Text>
      </Page>
    </Document>
  )
}

export async function renderInformeOtPDF(datos: DatosInformeOT): Promise<Buffer> {
  return renderToBuffer(<InformeOTDoc datos={datos} />)
}
