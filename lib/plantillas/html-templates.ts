/**
 * Plantillas HTML por defecto (Factura / Presupuesto). Server-only.
 */
import fs from 'fs'
import path from 'path'

const DIR = path.join(process.cwd(), 'lib', 'plantillas')

function leerHtml(nombre: string): string {
  return fs.readFileSync(path.join(DIR, nombre), 'utf8')
}

export const HTML_PLANTILLA_PRESUPUESTO = leerHtml('html-presupuesto.html')
export const HTML_PLANTILLA_FACTURA = leerHtml('html-factura.html')
export const HTML_PLANTILLA_REMITO = leerHtml('html-remito.html')
export const HTML_PLANTILLA_ACTA_ALQUILER = leerHtml('acta-alquiler-html.html')

export function htmlDefaultPorTipo(tipo: 'FACTURA' | 'PRESUPUESTO' | 'REMITO'): string {
  if (tipo === 'FACTURA') return HTML_PLANTILLA_FACTURA
  if (tipo === 'REMITO') return HTML_PLANTILLA_REMITO
  return HTML_PLANTILLA_PRESUPUESTO
}
