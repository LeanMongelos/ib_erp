/**
 * Checklist post-servicio embebido en OrdenTrabajo.diagnostico (sin migración de schema).
 */

export type ChecklistItemSolucion = {
  tarea: string
  completado: boolean
}

export const CHECKLIST_SOLUCION_DEFAULT: ChecklistItemSolucion[] = [
  { tarea: 'Verificación inicial del equipo', completado: false },
  { tarea: 'Diagnóstico documentado', completado: false },
  { tarea: 'Repuestos / intervención aplicada', completado: false },
  { tarea: 'Prueba funcional OK', completado: false },
  { tarea: 'Limpieza y entrega al cliente', completado: false },
]

const MARKER_START = '[CHECKLIST]'
const MARKER_END = '[/CHECKLIST]'

export function parseChecklistFromDiagnostico(diagnostico: string | null | undefined): {
  checklist: ChecklistItemSolucion[]
  texto: string
} {
  const raw = diagnostico ?? ''
  const start = raw.indexOf(MARKER_START)
  const end = raw.indexOf(MARKER_END)
  if (start === -1 || end === -1 || end <= start) {
    return { checklist: [...CHECKLIST_SOLUCION_DEFAULT], texto: raw.trim() }
  }

  const jsonBlock = raw.slice(start + MARKER_START.length, end).trim()
  let checklist = [...CHECKLIST_SOLUCION_DEFAULT]
  try {
    const parsed = JSON.parse(jsonBlock) as ChecklistItemSolucion[]
    if (Array.isArray(parsed) && parsed.every((i) => typeof i.tarea === 'string')) {
      checklist = parsed.map((i) => ({
        tarea: i.tarea,
        completado: Boolean(i.completado),
      }))
    }
  } catch {
    /* conservar default */
  }

  const before = raw.slice(0, start).trim()
  const after = raw.slice(end + MARKER_END.length).trim()
  const texto = [before, after].filter(Boolean).join('\n\n').trim()

  return { checklist, texto }
}

export function mergeChecklistIntoDiagnostico(
  texto: string,
  checklist: ChecklistItemSolucion[],
): string {
  const body = texto.trim()
  const block = `${MARKER_START}${JSON.stringify(checklist)}${MARKER_END}`
  return body ? `${block}\n\n${body}` : block
}

export function formatChecklistParaPdf(checklist: ChecklistItemSolucion[]): string {
  return checklist
    .map((i) => `${i.completado ? '☑' : '☐'} ${i.tarea}`)
    .join('\n')
}
