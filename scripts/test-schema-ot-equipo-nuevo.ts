/**
 * Schema OT con equipoNuevo alineado con POST /api/ots.
 */
import { otCreateSchema, otN8nCreateSchema } from '../lib/validation'

const errors: string[] = []

function pass(msg: string) {
  console.log('✅', msg)
}

function fail(msg: string) {
  errors.push(msg)
  console.error('❌', msg)
}

function main() {
  console.log('\n=== Test schema OT equipo nuevo ===\n')

  const conEquipoNuevo = otCreateSchema.parse({
    clienteId: 'cli-1',
    descripcion: 'Calibración equipo externo',
    equipoNuevo: {
      nombre: 'Desfibrilador Zoll',
      marca: 'Zoll',
      numeroSerie: 'Z-9988',
    },
  })

  if (conEquipoNuevo.equipoId) fail('equipoId debería ser undefined con equipoNuevo')
  else pass('equipoNuevo sin equipoId')

  try {
    otCreateSchema.parse({
      clienteId: 'cli-1',
      descripcion: 'Conflicto equipo',
      equipoId: 'eq-1',
      equipoNuevo: { nombre: 'X' },
    })
    fail('debería rechazar equipoId + equipoNuevo')
  } catch {
    pass('rechaza equipoId + equipoNuevo simultáneos')
  }

  otN8nCreateSchema.parse({
    clienteId: 'cli-1',
    descripcion: 'OT n8n equipo manual',
    equipoNuevo: { nombre: 'Bomba infusión' },
    conversacionId: 'conv-1',
  })
  pass('n8n acepta equipoNuevo')

  console.log('')
  if (errors.length > 0) {
    console.error(`${errors.length} fallo(s).\n`)
    process.exit(1)
  }
  console.log('OK — schema OT equipo nuevo\n')
}

main()
