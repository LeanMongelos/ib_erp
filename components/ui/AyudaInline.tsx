'use client'

import { CircleHelp } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AyudaInlineProps {
  children: React.ReactNode
  className?: string
  label?: string
}

/** Tooltip compacto en español (2–3 líneas) sin nueva página. */
export function AyudaInline({ children, className, label = 'Ayuda' }: AyudaInlineProps) {
  return (
    <span className={cn('relative inline-flex items-center group', className)}>
      <button
        type="button"
        className="text-[#9aa1ab] hover:text-[#E8650A] transition-colors"
        aria-label={label}
      >
        <CircleHelp size={15} strokeWidth={2} />
      </button>
      <span
        role="tooltip"
        className={cn(
          'pointer-events-none invisible opacity-0 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100',
          'absolute z-20 left-1/2 -translate-x-1/2 top-full mt-2 w-64',
          'rounded-[9px] border border-[#e4e7eb] bg-white px-3 py-2.5 shadow-lg',
          'text-[11.5px] leading-snug text-[#3a4150] font-normal normal-case tracking-normal',
          'transition-opacity duration-150',
        )}
      >
        {children}
      </span>
    </span>
  )
}
