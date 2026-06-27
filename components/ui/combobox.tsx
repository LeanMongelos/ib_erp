'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { ChevronDown, Search } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ComboboxOption {
  value: string
  label: string
  hint?: string
}

interface ComboboxProps {
  value: string
  onChange: (value: string, option?: ComboboxOption) => void
  options?: ComboboxOption[]
  /** URL base para búsqueda remota; se agrega ?q= */
  fetchUrl?: string
  /** Mapea la respuesta JSON a opciones */
  mapResponse?: (data: unknown) => ComboboxOption[]
  label?: string
  placeholder?: string
  error?: string
  disabled?: boolean
  allowCustom?: boolean
  className?: string
  minSearchLength?: number
}

const defaultMapClientes = (data: unknown): ComboboxOption[] => {
  if (!Array.isArray(data)) return []
  return data.map((c: { id: string; nombre: string; ciudad?: string | null }) => ({
    value: c.id,
    label: c.nombre,
    hint: c.ciudad ?? undefined,
  }))
}

const defaultMapProveedores = (data: unknown): ComboboxOption[] => {
  if (!Array.isArray(data)) return []
  return data.map((p: { id: string; razonSocial: string; rubro?: string | null }) => ({
    value: p.id,
    label: p.razonSocial,
    hint: p.rubro ?? undefined,
  }))
}

export function Combobox({
  value,
  onChange,
  options: staticOptions = [],
  fetchUrl,
  mapResponse,
  label,
  placeholder = 'Buscar…',
  error,
  disabled,
  allowCustom = false,
  className,
  minSearchLength = 2,
}: ComboboxProps) {
  const listId = useId()
  const wrapRef = useRef<HTMLDivElement>(null)
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([])
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [remote, setRemote] = useState<ComboboxOption[]>([])
  const [loading, setLoading] = useState(false)
  const [highlightIndex, setHighlightIndex] = useState(-1)

  const selectedStatic = staticOptions.find((o) => o.value === value)
  const selectedRemote = remote.find((o) => o.value === value)
  const displayLabel = selectedStatic?.label ?? selectedRemote?.label ?? (allowCustom ? value : '')

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false)
        setHighlightIndex(-1)
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  useEffect(() => {
    if (!fetchUrl || q.trim().length < minSearchLength) {
      setRemote([])
      return
    }
    const t = window.setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch(`${fetchUrl}?q=${encodeURIComponent(q.trim())}`, { credentials: 'include' })
        const data = await res.json()
        const mapper = mapResponse ?? (fetchUrl.includes('proveedores') ? defaultMapProveedores : defaultMapClientes)
        setRemote(mapper(data))
      } catch {
        setRemote([])
      } finally {
        setLoading(false)
      }
    }, 280)
    return () => window.clearTimeout(t)
  }, [q, fetchUrl, mapResponse, minSearchLength])

  const filteredStatic = staticOptions.filter((o) => {
    if (!q.trim()) return true
    const needle = q.trim().toLowerCase()
    return o.label.toLowerCase().includes(needle) || o.value.toLowerCase().includes(needle)
  })

  const dedupeOptions = (opts: ComboboxOption[]) => {
    const seen = new Set<string>()
    return opts.filter((o) => {
      if (seen.has(o.value)) return false
      seen.add(o.value)
      return true
    })
  }

  const showDropdown = open && !disabled
  const remoteMode = Boolean(fetchUrl)
  const listOptions = remoteMode
    ? q.trim().length < minSearchLength
      ? filteredStatic
      : dedupeOptions([...filteredStatic, ...remote])
    : q.trim()
      ? filteredStatic
      : staticOptions

  useEffect(() => {
    setHighlightIndex(-1)
  }, [q, listOptions.length, loading])

  useEffect(() => {
    if (highlightIndex >= 0) {
      optionRefs.current[highlightIndex]?.scrollIntoView({ block: 'nearest' })
    }
  }, [highlightIndex])

  function elegir(opt: ComboboxOption) {
    onChange(opt.value, opt)
    setQ('')
    setOpen(false)
    setHighlightIndex(-1)
  }

  function handleInputChange(text: string) {
    setQ(text)
    setOpen(true)
    if (allowCustom && !remoteMode) onChange(text)
  }

  function handleFocus() {
    setOpen(true)
    if (displayLabel && !q) setQ(displayLabel)
  }

  function handleBlur() {
    window.setTimeout(() => {
      if (allowCustom && q.trim()) onChange(q.trim())
      setQ('')
      setHighlightIndex(-1)
    }, 150)
  }

  function moveHighlight(delta: number) {
    if (listOptions.length === 0) return
    setHighlightIndex((prev) => {
      if (prev < 0) return delta > 0 ? 0 : listOptions.length - 1
      const next = prev + delta
      if (next < 0) return listOptions.length - 1
      if (next >= listOptions.length) return 0
      return next
    })
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (disabled) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (!open) setOpen(true)
      moveHighlight(1)
      return
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (!open) setOpen(true)
      moveHighlight(-1)
      return
    }

    if (e.key === 'Enter') {
      if (open && highlightIndex >= 0 && listOptions[highlightIndex]) {
        e.preventDefault()
        elegir(listOptions[highlightIndex])
      }
      return
    }

    if (e.key === 'Escape') {
      if (open) {
        e.preventDefault()
        e.stopPropagation()
        setOpen(false)
        setHighlightIndex(-1)
        setQ('')
      }
      return
    }

    if (e.key === 'Home') {
      if (listOptions.length > 0) {
        e.preventDefault()
        if (!open) setOpen(true)
        setHighlightIndex(0)
      }
      return
    }

    if (e.key === 'End') {
      if (listOptions.length > 0) {
        e.preventDefault()
        if (!open) setOpen(true)
        setHighlightIndex(listOptions.length - 1)
      }
      return
    }

    if (e.key === 'Tab') {
      if (open && highlightIndex >= 0 && listOptions[highlightIndex]) {
        elegir(listOptions[highlightIndex])
      } else {
        setOpen(false)
        setHighlightIndex(-1)
      }
    }
  }

  return (
    <div ref={wrapRef} className={cn('flex flex-col gap-1.5', className)}>
      {label && (
        <label htmlFor={listId} className="text-[11.5px] font-semibold text-[#5b626d] tracking-wide uppercase">
          {label}
        </label>
      )}
      <div className="relative">
        <div className={cn(
          'flex items-center gap-2 border border-[#e4e7eb] rounded-[9px] px-3 py-2.5 bg-white',
          'focus-within:ring-2 focus-within:ring-[#E8650A]/40 focus-within:border-[#E8650A]',
          error && 'border-red-400 focus-within:ring-red-200 focus-within:border-red-400',
          disabled && 'opacity-60 cursor-not-allowed',
        )}>
          <Search size={14} className="text-[#9aa1ab] shrink-0" />
          <input
            id={listId}
            type="text"
            role="combobox"
            aria-expanded={showDropdown}
            aria-autocomplete="list"
            aria-controls={`${listId}-listbox`}
            aria-activedescendant={
              highlightIndex >= 0 ? `${listId}-opt-${highlightIndex}` : undefined
            }
            autoComplete="off"
            disabled={disabled}
            value={open ? q : displayLabel}
            onChange={(e) => handleInputChange(e.target.value)}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="flex-1 text-[13.5px] text-[#1f242c] bg-transparent outline-none placeholder:text-gray-400 min-w-0"
          />
          <ChevronDown size={14} className="text-[#9aa1ab] shrink-0" />
        </div>
        {showDropdown && (
          <div
            id={`${listId}-listbox`}
            role="listbox"
            className="absolute z-30 top-full left-0 right-0 mt-1 bg-white border border-[#e4e7eb] rounded-[9px] shadow-lg max-h-52 overflow-y-auto"
          >
            {loading && (
              <p className="px-3 py-2 text-[11px] text-[#9aa1ab]">Buscando…</p>
            )}
            {!loading && remoteMode && q.trim().length < minSearchLength && listOptions.length === 0 && (
              <p className="px-3 py-2 text-[11px] text-[#9aa1ab]">Escribí al menos {minSearchLength} caracteres</p>
            )}
            {!loading && listOptions.length === 0 && (remoteMode ? q.trim().length >= minSearchLength : true) && (
              <p className="px-3 py-2 text-[11px] text-[#9aa1ab]">Sin resultados</p>
            )}
            {listOptions.map((opt, idx) => {
              const highlighted = idx === highlightIndex
              const selected = opt.value === value
              return (
                <button
                  key={opt.value}
                  id={`${listId}-opt-${idx}`}
                  ref={(el) => { optionRefs.current[idx] = el }}
                  type="button"
                  role="option"
                  aria-selected={highlighted || selected}
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setHighlightIndex(idx)}
                  onClick={() => elegir(opt)}
                  className={cn(
                    'w-full text-left px-3 py-2 border-b border-[#f4f5f7] last:border-0',
                    (highlighted || selected) ? 'bg-[#FFF7ED]' : 'hover:bg-[#FFF7ED]',
                  )}
                >
                  <p className="text-[12.5px] font-semibold text-[#1f242c] truncate">{opt.label}</p>
                  {opt.hint && <p className="text-[10.5px] text-[#6b7280] truncate">{opt.hint}</p>}
                </button>
              )
            })}
          </div>
        )}
      </div>
      {error && <p className="text-[11px] text-red-600 font-medium">{error}</p>}
    </div>
  )
}
