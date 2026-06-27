import { cn } from '@/lib/utils'
import { normalizarEntradaTelefono } from '@/lib/telefono'
import { InputHTMLAttributes, forwardRef } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  icon?: React.ReactNode
  /** Filtra letras y símbolos inválidos; solo números y formato telefónico (+ - ( ) espacios). */
  telefono?: boolean
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, icon, id, telefono, onChange, inputMode, autoComplete, ...props }, ref) => {
    function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
      if (telefono) {
        e.target.value = normalizarEntradaTelefono(e.target.value)
      }
      onChange?.(e)
    }

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={id} className="text-[11.5px] font-semibold text-[#5b626d] tracking-wide uppercase">
            {label}
          </label>
        )}
        <div className="relative">
          {icon && (
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
              {icon}
            </span>
          )}
          <input
            ref={ref}
            id={id}
            inputMode={telefono ? 'tel' : inputMode}
            autoComplete={telefono ? 'tel' : autoComplete}
            onChange={handleChange}
            className={cn(
              'w-full bg-white border border-[#e4e7eb] rounded-[9px] px-3 py-2.5 text-[13.5px] text-[#1f242c]',
              'placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#E8650A]/40 focus:border-[#E8650A]',
              'transition-colors duration-150',
              icon && 'pl-9',
              error && 'border-red-400 focus:ring-red-200 focus:border-red-400',
              className,
            )}
            {...props}
          />
        </div>
        {error && (
          <p className="text-[11px] text-red-600 font-medium">{error}</p>
        )}
      </div>
    )
  },
)

Input.displayName = 'Input'
