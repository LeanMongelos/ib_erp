/**
 * Verifica scripts post-deploy que históricamente rompieron el VPS deploy:
 * - limpieza-demo: orden FK (ítems antes que facturas)
 * - sync-tracking-demo: sintaxis TypeScript válida
 */
import { readFileSync } from 'node:fs'
import { transformSync } from 'esbuild'

function assertLimpiezaDemoFkOrder() {
  const src = readFileSync('lib/prod/limpieza-demo.ts', 'utf8')
  const itemIdx = src.indexOf('itemFactura.deleteMany')
  const facturaIdx = src.indexOf('factura.deleteMany')
  const itemPresIdx = src.indexOf('itemPresupuesto.deleteMany')
  const presIdx = src.indexOf('presupuesto.deleteMany')

  if (itemIdx === -1 || facturaIdx === -1) {
    throw new Error('limpieza-demo: faltan deleteMany de itemFactura o factura')
  }
  if (itemIdx > facturaIdx) {
    throw new Error('limpieza-demo: itemFactura.deleteMany debe ir ANTES de factura.deleteMany (FK)')
  }
  if (itemPresIdx === -1 || presIdx === -1 || itemPresIdx > presIdx) {
    throw new Error('limpieza-demo: itemPresupuesto.deleteMany debe ir ANTES de presupuesto.deleteMany')
  }
  console.log('✅ limpieza-demo: orden FK ítems → documentos OK')
}

function assertSyncTrackingSyntax() {
  const files = ['scripts/sync-tracking-demo.ts', 'scripts/prod-limpieza-demo.ts']
  for (const file of files) {
    const code = readFileSync(file, 'utf8')
    transformSync(code, { loader: 'ts', sourcefile: file })
    console.log(`✅ ${file}: sintaxis OK`)
  }
}

function assertDeployScriptUsesOptionalSteps() {
  const sh = readFileSync('scripts/vps-deploy-from-git.sh', 'utf8')
  if (!sh.includes('run_optional_step')) {
    throw new Error('vps-deploy-from-git.sh: falta run_optional_step')
  }
  const optionalScripts = [
    'sync-tracking-demo.ts',
    'prod-limpieza-demo.ts',
    'integridad:prod',
    'sync-listas-precios.ts',
  ]
  for (const script of optionalScripts) {
    const idx = sh.indexOf(script)
    if (idx === -1) {
      throw new Error(`vps-deploy-from-git.sh: falta paso ${script}`)
    }
    const window = sh.slice(Math.max(0, idx - 200), idx)
    if (!window.includes('run_optional_step')) {
      throw new Error(`${script} debe invocarse dentro de run_optional_step`)
    }
  }
  console.log('✅ vps-deploy-from-git.sh: pasos opcionales configurados')
}

console.log('\n=== Test scripts post-deploy ===\n')
assertLimpiezaDemoFkOrder()
assertSyncTrackingSyntax()
assertDeployScriptUsesOptionalSteps()
console.log('\nOK — scripts post-deploy\n')
