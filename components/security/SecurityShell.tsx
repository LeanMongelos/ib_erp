'use client'

/**
 * Capa de protección en el browser (producción).
 * - Bloquea atajos comunes de DevTools (F12, Ctrl+Shift+I/J, etc.)
 * - Detecta DevTools abiertos y oculta el contenido
 * - Deshabilita menú contextual en el panel
 * - Silencia console.* para no filtrar datos por logs accidentales
 *
 * Nota: esto NO reemplaza la seguridad server-side; complementa la redacción en APIs.
 */

import { useEffect, useState } from 'react'

const PROD = process.env.NODE_ENV === 'production'

export function SecurityShell({ children }: { children: React.ReactNode }) {
  const [devtoolsOpen, setDevtoolsOpen] = useState(false)

  useEffect(() => {
    if (!PROD) return

    const noop = () => {}
    const methods = ['log', 'debug', 'info', 'warn', 'error', 'table', 'trace', 'dir', 'clear'] as const
    const saved: Partial<Record<string, (...args: unknown[]) => void>> = {}
    for (const m of methods) {
      saved[m] = (console[m] as (...args: unknown[]) => void).bind(console)
      try {
        Object.defineProperty(console, m, { value: noop, configurable: true })
      } catch {
        /* ignore */
      }
    }

    try {
      const hook = (window as unknown as { __REACT_DEVTOOLS_GLOBAL_HOOK__?: { inject?: unknown } })
        .__REACT_DEVTOOLS_GLOBAL_HOOK__
      if (hook) {
        hook.inject = () => {}
      }
    } catch {
      /* ignore */
    }

    const blockKeys = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase()
      if (key === 'f12') {
        e.preventDefault()
        e.stopPropagation()
        return
      }
      if (e.ctrlKey && e.shiftKey && ['i', 'j', 'c', 'k'].includes(key)) {
        e.preventDefault()
        e.stopPropagation()
        return
      }
      if (e.ctrlKey && key === 'u') {
        e.preventDefault()
        e.stopPropagation()
        return
      }
      if (e.metaKey && e.altKey && ['i', 'j', 'c'].includes(key)) {
        e.preventDefault()
        e.stopPropagation()
      }
    }

    const blockContext = (e: Event) => {
      const t = e.target as HTMLElement | null
      if (t?.closest('input, textarea, [contenteditable="true"], [data-allow-context]')) return
      e.preventDefault()
    }

    const detectDevtools = () => {
      const w = window.outerWidth - window.innerWidth > 160
      const h = window.outerHeight - window.innerHeight > 160
      setDevtoolsOpen(w || h)
    }

    window.addEventListener('keydown', blockKeys, true)
    document.addEventListener('contextmenu', blockContext, true)
    const interval = window.setInterval(detectDevtools, 800)
    detectDevtools()

    return () => {
      window.removeEventListener('keydown', blockKeys, true)
      document.removeEventListener('contextmenu', blockContext, true)
      window.clearInterval(interval)
      for (const m of methods) {
        if (saved[m]) {
          Object.defineProperty(console, m, { value: saved[m], configurable: true })
        }
      }
    }
  }, [])

  if (!PROD) return <>{children}</>

  return (
    <>
      <div
        className="security-protected-contents flex-1 flex flex-col min-w-0 overflow-hidden"
        style={{ userSelect: devtoolsOpen ? 'none' : undefined }}
      >
        {children}
      </div>
      {devtoolsOpen && (
        <div
          className="fixed inset-0 z-[99999] flex items-center justify-center bg-[#0A0A0A] text-white p-8"
          role="alert"
          aria-live="assertive"
        >
          <div className="max-w-md text-center">
            <p className="text-[18px] font-bold mb-3">Acceso restringido</p>
            <p className="text-[14px] text-[#9aa3af] leading-relaxed">
              Las herramientas de desarrollador están deshabilitadas en este entorno.
              Cerrá DevTools para continuar usando el sistema.
            </p>
          </div>
        </div>
      )}
    </>
  )
}
