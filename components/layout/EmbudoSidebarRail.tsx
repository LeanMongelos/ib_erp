'use client'

import { PanelLeftOpen } from 'lucide-react'
import { useEmbudoSidebar } from '@/components/layout/SidebarContext'

/** Pestaña fija en el borde izquierdo para recuperar el menú en el embudo. */
export function EmbudoSidebarRail() {
  const { isEmbudo, sidebarHidden, toggleSidebar } = useEmbudoSidebar()

  if (!isEmbudo || !sidebarHidden) return null

  return (
    <button
      type="button"
      onClick={toggleSidebar}
      className="fixed left-0 top-1/2 -translate-y-1/2 z-[60] flex flex-col items-center gap-1 rounded-r-[10px] bg-[#0A0A0A] px-2 py-3 text-white shadow-[2px_0_14px_rgba(0,0,0,0.25)] transition-transform hover:translate-x-0.5 hover:bg-[#141414]"
      title="Mostrar menú lateral"
      aria-label="Mostrar menú lateral"
    >
      <PanelLeftOpen size={18} strokeWidth={2} />
      <span className="text-[9px] font-bold uppercase tracking-wide [writing-mode:vertical-rl] rotate-180">
        Menú
      </span>
    </button>
  )
}
