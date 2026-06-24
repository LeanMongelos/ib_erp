/**
 * Test exportación logs — filtros compartidos con API.
 */
import { buildLogsWhere, LOGS_EXPORT_MAX, nombreArchivoLogsExport } from '../lib/logs-export'

const where = buildLogsWhere({ nivel: 'WARN', origen: 'integridad', q: 'cotización' })
if (!where.nivel || where.nivel !== 'WARN') throw new Error('filtro nivel')
if (!where.origen || where.origen !== 'integridad') throw new Error('filtro origen')
if (!Array.isArray(where.OR)) throw new Error('filtro q debe generar OR')

const fname = nombreArchivoLogsExport({ dia: '2026-06-24', nivel: 'WARN', origen: 'integridad' })
if (!fname.endsWith('.xlsx') || !fname.includes('2026-06-24')) {
  throw new Error(`nombre archivo inválido: ${fname}`)
}

if (LOGS_EXPORT_MAX !== 5000) throw new Error('LOGS_EXPORT_MAX debe ser 5000')

console.log('✅ buildLogsWhere filtros OK')
console.log('✅ nombreArchivoLogsExport OK')
console.log('\nOK — export logs\n')
