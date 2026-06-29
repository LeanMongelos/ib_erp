/**
 * Generación PDF del ACTA de entrega de alquiler. Server-only.
 */
import fs from 'fs'
import path from 'path'
import { prisma } from '@/lib/prisma'
import { htmlToPdf } from '@/lib/plantillas/html-to-pdf.server'
import { actaEquipoConSerie } from '@/lib/alquiler/acta-entrega-client'
import { formatFechaActaLugar } from '@/lib/alquiler/periodo'
import { formatFecha } from '@/lib/utils'

const HTML_PATH = path.join(process.cwd(), 'lib', 'plantillas', 'acta-alquiler-html.html')

function esc(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function formatMontoActa(n: number): string {
  return n.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

function renderActaHtml(
  html: string,
  acta: {
    numero: string
    clienteNombre: string
    clienteDni: string | null
    clienteDireccion: string | null
    clienteTelefono: string | null
    equipoNombre: string
    numeroSerie: string | null
    fechaActa: Date
    lugar: string
    montoAlquiler: number
    periodoAlquiler: string
    montoDepositoGarantia: number
    observaciones: string | null
  },
  emisor: {
    razonSocial: string
    cuit: string
    condicionIva: string
    ingresosBrutos: string | null
    inicioActividades: Date | null
    domicilio: string | null
    telefono: string | null
    email: string | null
  },
): string {
  const equipoCompleto = actaEquipoConSerie(acta.equipoNombre, acta.numeroSerie ?? '')
  const seccionObs = acta.observaciones?.trim()
    ? `<section class="observaciones"><strong>Observaciones:</strong> ${esc(acta.observaciones.trim())}</section>`
    : ''

  const map: Record<string, string> = {
    empresa_nombre: esc(emisor.razonSocial),
    empresa_direccion: esc(emisor.domicilio ?? ''),
    empresa_telefono: esc(emisor.telefono ?? ''),
    empresa_email: esc(emisor.email ?? ''),
    empresa_cuit: esc(emisor.cuit),
    empresa_ingresos_brutos: esc(emisor.ingresosBrutos ?? emisor.cuit),
    empresa_inicio_actividades: esc(
      emisor.inicioActividades ? formatFecha(emisor.inicioActividades) : '—',
    ),
    empresa_condicion_iva: esc(emisor.condicionIva),
    acta_numero: esc(acta.numero),
    acta_fecha_corta: formatFecha(acta.fechaActa),
    acta_fecha_lugar: esc(formatFechaActaLugar(acta.fechaActa, acta.lugar)),
    acta_equipo_completo: esc(equipoCompleto),
    cliente_nombre: esc(acta.clienteNombre),
    cliente_dni: esc(acta.clienteDni?.trim() || '………………………'),
    cliente_direccion: esc(acta.clienteDireccion?.trim() || '—'),
    cliente_telefono: esc(acta.clienteTelefono?.trim() || '………………………'),
    monto_alquiler: formatMontoActa(acta.montoAlquiler),
    periodo_alquiler: esc(acta.periodoAlquiler),
    monto_deposito: formatMontoActa(acta.montoDepositoGarantia),
    seccion_observaciones: seccionObs,
  }

  return html.replace(/\{\{(\w+)\}\}/g, (_, key: string) => map[key] ?? '')
}

export async function generarPdfActaEntregaAlquiler(actaId: string): Promise<Buffer | null> {
  const acta = await prisma.actaEntregaAlquiler.findUnique({ where: { id: actaId } })
  if (!acta) return null

  const emisor = await prisma.emisor.findFirst({
    where: { predeterminado: true, activo: true },
  })
  if (!emisor) return null

  const html = fs.readFileSync(HTML_PATH, 'utf8')
  const rendered = renderActaHtml(html, acta, emisor)
  return htmlToPdf(rendered, 'A4')
}
