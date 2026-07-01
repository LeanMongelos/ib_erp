'use client'

import { useEffect } from 'react'

/** Aviso al cerrar pestaña o recargar si hay cambios pendientes. */
export function useUnsavedChangesWarning(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return

    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }

    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [enabled])
}

export function confirmarSalidaSiHayCambios(enabled: boolean): boolean {
  if (!enabled) return true
  return window.confirm(
    'Hay cambios que todavía no se guardaron. ¿Salir igual?',
  )
}
