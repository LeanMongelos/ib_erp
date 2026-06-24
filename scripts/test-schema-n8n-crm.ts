/**
 * Schemas n8n CRM alineados con lib/validation.ts.
 */
import {
  crmMensajeContenidoSchema,
  mensajeN8nResponderSchema,
  conversacionEtiquetasN8nSchema,
  leadN8nCreateSchema,
} from '../lib/validation'

const errors: string[] = []

function pass(msg: string) {
  console.log('✅', msg)
}

function fail(msg: string) {
  errors.push(msg)
  console.error('❌', msg)
}

function main() {
  console.log('\n=== Test schemas n8n CRM ===\n')

  const mensaje = crmMensajeContenidoSchema.parse({ contenido: 'Hola, ¿en qué puedo ayudarte?' })
  const n8n = mensajeN8nResponderSchema.parse({
    conversacionId: 'conv-1',
    contenido: 'Hola, ¿en qué puedo ayudarte?',
  })

  if (mensaje.contenido !== n8n.contenido) {
    fail('responder n8n y crmMensajeContenido difieren en contenido')
  } else {
    pass('mensajeN8nResponderSchema comparte reglas de contenido con CRM')
  }

  const etiquetas = conversacionEtiquetasN8nSchema.parse({
    conversacionId: 'conv-1',
    etiquetas: ['urgente', 'venta'],
  })
  if (etiquetas.modo !== 'agregar') {
    fail('modo default debería ser agregar')
  } else {
    pass('conversacionEtiquetasN8nSchema modo default agregar')
  }

  const lead = leadN8nCreateSchema.parse({
    nombre: 'Hospital San Juan',
    email: '',
    conversacionId: 'conv-2',
  })
  if (lead.nombre !== 'Hospital San Juan') {
    fail('leadN8nCreateSchema no parseó nombre')
  } else {
    pass('leadN8nCreateSchema acepta email vacío (emailOpcional)')
  }

  try {
    leadN8nCreateSchema.parse({ nombre: 'A' })
    fail('lead con nombre corto debería fallar')
  } catch {
    pass('leadN8nCreateSchema rechaza nombre < 2 caracteres')
  }

  console.log('')
  if (errors.length > 0) {
    console.error(`${errors.length} fallo(s).\n`)
    process.exit(1)
  }
  console.log('OK — schemas n8n CRM\n')
}

main()
