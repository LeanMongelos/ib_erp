'use client'

import { cn } from '@/lib/utils'
import { SelectHTMLAttributes, forwardRef } from 'react'

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  options: { value: string; label: string }[]
  placeholder?: string
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, id, options, placeholder, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={id} className="text-[11.5px] font-semibold text-[#5b626d] tracking-wide uppercase">
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={id}
          className={cn(
            'w-full bg-white border border-[#e4e7eb] rounded-[9px] px-3 py-2.5 text-[13.5px] text-[#1f242c]',
            'focus:outline-none focus:ring-2 focus:ring-[#E8650A]/40 focus:border-[#E8650A]',
            'transition-colors duration-150 disabled:opacity-60 disabled:cursor-not-allowed',
            error && 'border-red-400 focus:ring-red-200 focus:border-red-400',
            className,
          )}
          {...props}
        >
          {placeholder !== undefined && (
            <option value="">{placeholder}</option>
          )}
          {options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        {error && (
          <p className="text-[11px] text-red-600 font-medium">{error}</p>
        )}
      </div>
    )
  },
)

Select.displayName = 'Select'
