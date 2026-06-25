/**
 * Tests etiquetas y reglas de seguimiento embudo.
 */
import { etiquetaEventoEmbudo } from '../lib/crm/embudo-historial'

function pass(msg: string) { console.log(`  ✅ ${msg}`) }
function fail(msg: string): never { throw new Error(msg) }

console.log('\n=== Test embudo seguimiento ===\n')

if (etiquetaEventoEmbudo({ tipo: 'CREACION', etapaDesde: null, etapaHasta: 'ENTRADA', retroceso: false }) !== 'Negocio creado') {
  fail('CREACION')
}
pass('etiqueta CREACION')

if (etiquetaEventoEmbudo({ tipo: 'ELIMINACION', etapaDesde: 'SEGUIMIENTO', etapaHasta: null, retroceso: false }) !== 'Negocio eliminado del pipeline') {
  fail('ELIMINACION')
}
pass('etiqueta ELIMINACION')

if (etiquetaEventoEmbudo({ tipo: 'MOVIMIENTO', etapaDesde: 'ANALISIS', etapaHasta: 'PERDIDO', retroceso: false }) !== 'Marcado como perdido') {
  fail('PERDIDO')
}
pass('etiqueta perdido')

if (etiquetaEventoEmbudo({ tipo: 'MOVIMIENTO', etapaDesde: 'ENTREGA', etapaHasta: 'CIERRE', retroceso: false }) !== 'Negocio ganado (cierre)') {
  fail('CIERRE')
}
pass('etiqueta ganado')

if (etiquetaEventoEmbudo({ tipo: 'REACTIVACION', etapaDesde: 'PERDIDO', etapaHasta: 'SEGUIMIENTO', retroceso: false }) !== 'Negocio reactivado (Perdido → Seguimiento)') {
  fail('REACTIVACION con cambio etapa')
}
pass('etiqueta reactivacion')

console.log('\n=== OK ===\n')
