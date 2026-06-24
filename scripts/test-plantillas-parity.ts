/**
 * Contrato: preview y producción generan PDF equivalente para plantillas de fábrica.
 * react-pdf puede variar metadatos internos (CreationDate) → comparamos longitud + validez.
 *
 * Uso: npx tsx scripts/test-plantillas-parity.ts
 */
import { PLANTILLA_FACTURA_DEFAULT, PLANTILLA_PRESUPUESTO_DEFAULT } from '../lib/plantillas/defaults'
import { renderPreviewPlantilla } from '../lib/plantillas/preview'
import { renderDocumentoPDF } from '../lib/plantillas/render-documento'
import { datosEjemploPlantilla } from '../lib/plantillas/sample-datos'
import { prepararConfigRender } from '../lib/plantillas/resolver-plantilla'
import { isValidPdfBuffer } from '../lib/plantillas/pdf-valid'
import { tieneLayoutBloques } from '../lib/plantillas/render-layout'

const errors: string[] = []

function pass(msg: string) {
  console.log('✅', msg)
}

function fail(msg: string) {
  errors.push(msg)
  console.error('❌', msg)
}

async function assertParity(tipo: 'FACTURA' | 'PRESUPUESTO') {
  const cfgRaw = tipo === 'FACTURA' ? PLANTILLA_FACTURA_DEFAULT : PLANTILLA_PRESUPUESTO_DEFAULT
  const cfg = prepararConfigRender(cfgRaw, tipo)

  if (!tieneLayoutBloques(cfg)) {
    fail(`${tipo}: plantilla de fábrica debe tener layout de bloques`)
    return
  }

  const datos = datosEjemploPlantilla(tipo)
  const previewBuf = await renderPreviewPlantilla(cfg)
  const prodBuf = await renderDocumentoPDF(cfg, datos)

  if (!isValidPdfBuffer(previewBuf)) fail(`${tipo}: PDF preview inválido`)
  if (!isValidPdfBuffer(prodBuf)) fail(`${tipo}: PDF producción inválido`)

  const diffBytes = Math.abs(previewBuf.length - prodBuf.length)
  if (diffBytes > 0) {
    fail(
      `${tipo}: preview ≠ producción (preview ${previewBuf.length} bytes, prod ${prodBuf.length} bytes, Δ=${diffBytes})`,
    )
    return
  }

  pass(`${tipo}: preview === producción (${previewBuf.length} bytes, pipeline unificado)`)
}

async function assertResolverPreparacion() {
  const fact = prepararConfigRender(PLANTILLA_FACTURA_DEFAULT, 'FACTURA')
  if (fact.tipo !== 'FACTURA') fail('prepararConfigRender: tipo FACTURA incoherente')
  else pass('prepararConfigRender mantiene tipo FACTURA')
}

async function main() {
  console.log('\n=== Test paridad plantillas PDF ===\n')
  await assertResolverPreparacion()
  await assertParity('FACTURA')
  await assertParity('PRESUPUESTO')

  console.log('')
  if (errors.length > 0) {
    console.error(`\n${errors.length} fallo(s).\n`)
    process.exit(1)
  }
  console.log('OK — paridad plantillas\n')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
