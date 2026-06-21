'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Search,
  Users,
  FileText,
  ClipboardList,
  Package,
  Wrench,
  Truck,
  Receipt,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ResultadoBusqueda, TipoResultadoBusqueda } from '@/lib/busqueda-global-types'
import { ETIQUETAS_TIPO } from '@/lib/busqueda-global-types'

const ICONOS: Record<TipoResultadoBusqueda, typeof Search> = {
  cliente: Users,
  factura: Receipt,
  presupuesto: ClipboardList,
  producto: Package,
  equipo: Wrench,
  ot: FileText,
  proveedor: Truck,
}

interface Props {
  open: boolean
  onClose: () => void
}

export function GlobalSearchModal({ open, onClose }: Props) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [q, setQ] = useState('')
  const [resultados, setResultados] = useState<ResultadoBusqueda[]>([])
  const [loading, setLoading] = useState(false)
  const [activeIdx, setActiveIdx] = useState(0)

  useEffect(() => {
    if (open) {
      setQ('')
      setResultados([])
      setActiveIdx(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const term = q.trim()
    if (term.length < 2) {
      setResultados([])
      setLoading(false)
      return
    }
    setLoading(true)
    const t = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/busqueda?q=${encodeURIComponent(term)}`, { credentials: 'include' })
        const data = await res.json()
        setResultados(Array.isArray(data.resultados) ? data.resultados : [])
        setActiveIdx(0)
      } catch {
        setResultados([])
      } finally {
        setLoading(false)
      }
    }, 220)
    return () => window.clearTimeout(t)
  }, [q, open])

  const irA = useCallback(
    (r: ResultadoBusqueda) => {
      onClose()
      router.push(r.href)
    },
    [onClose, router],
  )

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        return
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveIdx((i) => Math.min(i + 1, Math.max(0, resultados.length - 1)))
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveIdx((i) => Math.max(i - 1, 0))
      }
      if (e.key === 'Enter' && resultados[activeIdx]) {
        e.preventDefault()
        irA(resultados[activeIdx])
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, resultados, activeIdx, onClose, irA])

  if (!open) return null

  const agrupados = resultados.reduce<Record<string, ResultadoBusqueda[]>>((acc, r) => {
    ;(acc[r.tipo] ??= []).push(r)
    return acc
  }, {})

  let flatIdx = 0

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[12vh] px-4 bg-black/40"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-white rounded-[14px] shadow-2xl overflow-hidden border border-[#e9ebef]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Búsqueda global"
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[#eef0f2]">
          <Search size={18} className="text-[#9aa1ab] shrink-0" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Factura, presupuesto, cliente, producto, equipo, OT…"
            className="flex-1 text-[14px] text-[#1f242c] placeholder:text-[#9aa1ab] outline-none bg-transparent"
            autoComplete="off"
            spellCheck={false}
          />
          {q && (
            <button type="button" onClick={() => setQ('')} className="text-[#9aa1ab] hover:text-[#5b626d] p-1">
              <X size={16} />
            </button>
          )}
          <kbd className="hidden sm:inline text-[10px] text-[#9aa1ab] bg-[#f4f6f9] border border-[#e9ebef] rounded px-1.5 py-0.5">Esc</kbd>
        </div>

        <div className="max-h-[min(420px,55vh)] overflow-y-auto">
          {q.trim().length < 2 && (
            <p className="px-4 py-8 text-center text-[12.5px] text-[#9aa1ab]">
              Escribí al menos 2 caracteres para buscar en todo el ERP
            </p>
          )}
          {q.trim().length >= 2 && loading && (
            <p className="px-4 py-6 text-[12.5px] text-[#9aa1ab]">Buscando…</p>
          )}
          {q.trim().length >= 2 && !loading && resultados.length === 0 && (
            <p className="px-4 py-8 text-center text-[12.5px] text-[#9aa1ab]">
              Sin resultados para «{q.trim()}»
            </p>
          )}
          {!loading &&
            Object.entries(agrupados).map(([tipo, items]) => {
              const label = ETIQUETAS_TIPO[tipo as TipoResultadoBusqueda] ?? tipo
              return (
                <div key={tipo}>
                  <p className="px-4 pt-3 pb-1 text-[10px] font-bold uppercase tracking-wide text-[#8a909a]">
                    {label}
                  </p>
                  {items.map((r) => {
                    const idx = flatIdx++
                    const active = idx === activeIdx
                    const ItemIcon = ICONOS[r.tipo]
                    return (
                      <button
                        key={`${r.tipo}-${r.id}`}
                        type="button"
                        onClick={() => irA(r)}
                        onMouseEnter={() => setActiveIdx(idx)}
                        className={cn(
                          'w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors',
                          active ? 'bg-[#FFF7ED]' : 'hover:bg-[#fafbfc]',
                        )}
                      >
                        <span className={cn('p-1.5 rounded-lg shrink-0', active ? 'bg-[#E8650A]/15 text-[#E8650A]' : 'bg-[#f4f6f9] text-[#6b7280]')}>
                          <ItemIcon size={15} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[13px] font-semibold text-[#1f242c] truncate">{r.titulo}</span>
                          {r.subtitulo && (
                            <span className="block text-[11.5px] text-[#9aa1ab] truncate">{r.subtitulo}</span>
                          )}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )
            })}
        </div>

        <div className="px-4 py-2.5 border-t border-[#eef0f2] bg-[#fafbfc] flex items-center justify-between text-[10.5px] text-[#9aa1ab]">
          <span>↑↓ navegar · Enter abrir</span>
          <span className="hidden sm:inline">Ctrl+K para abrir</span>
        </div>
      </div>
    </div>
  )
}

export function GlobalSearchTrigger() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 bg-[#f4f6f9] border border-[#e9ebef] rounded-[8px] px-3 py-2 w-[230px] text-[#9aa1ab] hover:border-[#d1d5db] hover:text-[#6b7280] transition-colors text-left"
      >
        <Search size={15} className="shrink-0" />
        <span className="text-[12.5px] flex-1 truncate">Buscar…</span>
        <kbd className="hidden sm:inline text-[10px] bg-white border border-[#e9ebef] rounded px-1 py-0.5 shrink-0">⌘K</kbd>
      </button>
      <GlobalSearchModal open={open} onClose={() => setOpen(false)} />
    </>
  )
}
