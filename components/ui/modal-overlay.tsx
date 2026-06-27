'use client'

import { cn } from '@/lib/utils'

interface ModalOverlayProps {
  children: React.ReactNode
  className?: string
  /** z-index tailwind class, ej. z-50 o z-[120] */
  zClass?: string
}

/**
 * Fondo de modal. No cierra al hacer click fuera (evita perder datos del formulario).
 * Cerrar solo con Cancelar / Cerrar / Escape (KeyboardNavProvider).
 */
export function ModalOverlay({ children, className, zClass = 'z-50' }: ModalOverlayProps) {
  return (
    <div
      className={cn(
        'fixed inset-0 flex items-center justify-center bg-black/40 p-4',
        zClass,
        className,
      )}
      data-modal-overlay
      role="presentation"
    >
      {children}
    </div>
  )
}
