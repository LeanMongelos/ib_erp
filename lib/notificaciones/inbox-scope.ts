import type { CategoriaAlerta } from '@/lib/notificaciones/generar-inbox-types'

export type InboxScope = 'general' | 'crm'

export function filtrarAlertasPorScope<T extends { categoria: CategoriaAlerta }>(
  items: T[],
  scope: InboxScope,
): T[] {
  if (scope === 'crm') return items.filter((i) => i.categoria === 'crm')
  return items.filter((i) => i.categoria !== 'crm')
}

export function parseInboxScope(value: string | null): InboxScope {
  return value === 'crm' ? 'crm' : 'general'
}
