/**
 * Contrato: Factura, Presupuesto y Remito de fábrica usan su HTML dedicado
 * (no el layout de bloques) y renderizan sin placeholders sin resolver, con los
 * elementos requeridos de cada documento. Verificación a nivel HTML (sin Puppeteer)
 * para no depender de Chromium en CI/deploy; preview y producción comparten el
 * mismo pipeline HTML → mismo resultado.
 *
 * Uso: npx tsx scripts/test-plantillas-parity.ts
 */
import {
  PLANTILLA_FACTURA_DEFAULT,
  PLANTILLA_PRESUPUESTO_DEFAULT,
  PLANTILLA_REMITO_DEFAULT,
} from '../lib/plantillas/defaults'
import {
  HTML_PLANTILLA_FACTURA,
  HTML_PLANTILLA_PRESUPUESTO,
  HTML_PLANTILLA_REMITO,
} from '../lib/plantillas/html-templates'
import { datosEjemploPlantilla } from '../lib/plantillas/sample-datos'
import { renderHtmlDocumento } from '../lib/plantillas/render-html'
import { prepararConfigRender } from '../lib/plantillas/resolver-plantilla'
import { tieneLayoutBloques } from '../lib/plantillas/render-layout'
import type { PlantillaConfig } from '../lib/plantillas/types'

const errors: string[] = []
const pass = (msg: string) => console.log('✅', msg)
const fail = (msg: string) => {
  errors.push(msg)
  console.error('❌', msg)
}

type Tipo = 'FACTURA' | 'PRESUPUESTO' | 'REMITO'

const CONF: Record<Tipo, { cfg: PlantillaConfig; html: string; req: string[] }> = {
  FACTURA: {
    cfg: PLANTILLA_FACTURA_DEFAULT,
    html: HTML_PLANTILLA_FACTURA,
    req: ['CÓD.', 'CAE N°', 'Comprobante Autorizado', 'FACTURA'],
  },
  PRESUPUESTO: {
    cfg: PLANTILLA_PRESUPUESTO_DEFAULT,
    html: HTML_PLANTILLA_PRESUPUESTO,
    req: ['PRESUPUESTO', 'Documento no válido', 'Total'],
  },
  REMITO: {
    cfg: PLANTILLA_REMITO_DEFAULT,
    html: HTML_PLANTILLA_REMITO,
    req: ['REMITO', 'Recibí conforme'],
  },
}

function assertDocHtml(tipo: Tipo) {
  const { cfg: raw, html: tpl, req } = CONF[tipo]
  const cfg = prepararConfigRender(raw, tipo)

  if (tieneLayoutBloques(cfg)) {
    fail(`${tipo}: no debe usar layout de bloques (usa HTML dedicado)`)
    return
  }
  if (cfg.html !== tpl) {
    fail(`${tipo}: la config de fábrica debe apuntar a su HTML`)
    return
  }

  const datos = datosEjemploPlantilla(tipo)
  const html = renderHtmlDocumento(cfg.html, datos)

  const leftover = html.match(/\{\{\w+\}\}/g)
  if (leftover) {
    fail(`${tipo}: placeholders sin resolver: ${[...new Set(leftover)].join(', ')}`)
    return
  }
  for (const marca of req) {
    if (!html.includes(marca)) {
      fail(`${tipo}: falta elemento requerido «${marca}»`)
      return
    }
  }

  pass(`${tipo}: HTML dedicado OK (placeholders resueltos, elementos requeridos, pipeline unificado)`)
}

function main() {
  console.log('\n=== Test plantillas PDF (HTML dedicado por documento) ===\n')

  const fact = prepararConfigRender(PLANTILLA_FACTURA_DEFAULT, 'FACTURA')
  if (fact.tipo !== 'FACTURA') fail('prepararConfigRender: tipo FACTURA incoherente')
  else pass('prepararConfigRender mantiene tipo FACTURA')

  assertDocHtml('FACTURA')
  assertDocHtml('PRESUPUESTO')
  assertDocHtml('REMITO')

  console.log('')
  if (errors.length > 0) {
    console.error(`\n${errors.length} fallo(s).\n`)
    process.exit(1)
  }
  console.log('OK — plantillas HTML\n')
}

main()
