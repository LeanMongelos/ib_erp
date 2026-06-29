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
export const HTML_PLANTILLA_ACTA_ALQUILER = leerHtml('acta-alquiler-html.html')

export function htmlDefaultPorTipo(tipo: 'FACTURA' | 'PRESUPUESTO'): string {
  return tipo === 'FACTURA' ? HTML_PLANTILLA_FACTURA : HTML_PLANTILLA_PRESUPUESTO
}
