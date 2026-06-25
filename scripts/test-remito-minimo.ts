/**
 * Tests de emisión mínima de remito (build datos).
 */

import { buildDatosRemitoDesdeOT } from '../lib/remitos/build-datos'

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg)
}

const datos = buildDatosRemitoDesdeOT(
  'R-2026-0001',
  {
    numero: 'OT-100',
    descripcion: 'Service equipo',
    repuestos: [{ descripcion: 'Filtro', cantidad: 2, inventario: { sku: 'F-01' } }],
  },
  {
    razonSocial: 'IB SA',
    cuit: '30-00000000-0',
    condicionIva: 'RI',
  },
  { nombre: 'Cliente Test', direccion: 'Formosa' },
)

assert(datos.tipo === 'REMITO', 'tipo REMITO')
assert(datos.numero === 'R-2026-0001', 'numero')
assert(datos.items.length === 1, 'items repuestos')
assert(datos.items[0].codigo === 'F-01', 'sku repuesto')
assert(datos.total === 0, 'remito sin importes')

console.log('test-remito-minimo: OK')
