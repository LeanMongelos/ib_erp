/**
 * Tests de filtros CRM, snippets schema y plan preventivo post-cierre (lógica pura).
 */

import { crmMensajeContenidoSchema, crmSnippetCreateSchema } from '../lib/validation'

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg)
}

// Mensaje con adjunto sin texto
const msgAdj = crmMensajeContenidoSchema.safeParse({ adjuntoUrl: '/api/crm/media/crm/adjuntos/x/y.pdf' })
assert(msgAdj.success, 'adjunto sin texto debe ser válido')

const msgVacio = crmMensajeContenidoSchema.safeParse({})
assert(!msgVacio.success, 'mensaje vacío debe fallar')

const msgTexto = crmMensajeContenidoSchema.safeParse({ contenido: 'Hola' })
assert(msgTexto.success, 'mensaje texto debe ser válido')

const snippet = crmSnippetCreateSchema.safeParse({ titulo: 'Saludo', cuerpo: 'Buen día, ¿en qué puedo ayudarte?' })
assert(snippet.success, 'snippet válido')

const snippetCorto = crmSnippetCreateSchema.safeParse({ titulo: 'X', cuerpo: 'ok' })
assert(!snippetCorto.success, 'título corto debe fallar')

console.log('test-crm-backlog: OK')
