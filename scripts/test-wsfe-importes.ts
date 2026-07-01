/**
 * Tests puros — armado importes WSFE por tipo A/B/C.
 * Uso: npx tsx scripts/test-wsfe-importes.ts
 */
import { buildImportesWsfe } from '../lib/afip/wsfe-importes'

const errors: string[] = []

function pass(msg: string) {
  console.log('✅', msg)
}

function fail(msg: string) {
  errors.push(msg)
  console.error('❌', msg)
}

function main() {
  console.log('\n=== Test WSFE importes ===\n')

  const a = buildImportesWsfe({ tipo: 'A', subtotal: 100, iva: 21, total: 121 })
  if (a.ImpIVA !== 21 || a.Iva[0]?.Id !== 5) fail('Factura A debe discriminar IVA 21% (Id 5)')
  else pass('Factura A: ImpIVA=21, Id 5')

  const b = buildImportesWsfe({ tipo: 'B', subtotal: 100, iva: 21, total: 121 })
  if (b.ImpIVA !== 0 || b.ImpNeto !== 121 || b.Iva[0]?.Id !== 3) {
    fail(`Factura B: ImpIVA=0, ImpNeto=total, Id 3 — obtuvo IVA=${b.ImpIVA} neto=${b.ImpNeto} id=${b.Iva[0]?.Id}`)
  } else pass('Factura B: ImpIVA=0, ImpNeto=121, Id 3')

  const c = buildImportesWsfe({ tipo: 'C', subtotal: 100, iva: 21, total: 121 })
  if (c.ImpIVA !== 0 || c.Iva[0]?.Id !== 3) fail('Factura C debe igual que B ante AFIP')
  else pass('Factura C: ImpIVA=0, Id 3')

  console.log('')
  if (errors.length) {
    console.error(`${errors.length} fallo(s)\n`)
    process.exit(1)
  }
  console.log('Todos los tests pasaron\n')
}

main()
