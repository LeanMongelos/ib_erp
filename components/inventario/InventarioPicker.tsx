'use client'

import { useEffect, useRef, useState } from 'react'
import { Package, Search } from 'lucide-react'
import { formatMontoMoneda } from '@/lib/moneda'
import { etiquetaOrigenPrecio, type OrigenPrecio } from '@/lib/precios/types'

export interface InventarioOption {
  id: string
  nombre: string
  sku: string | null
  descripcion: string | null
  fotoUrl?: string | null
  stock: number
  precioUnit: number | null
  moneda?: string
  categoria: string | null
  tipoArticulo: string
  esSerializado: boolean
  requierePreventivo: boolean
  intervaloPreventivoDias: number | null
  modoTrazabilidad?: string
  marca: string | null
  modelo: string | null
  alicuotaIva?: { porcentaje: number } | null
  precioOrigen?: OrigenPrecio
  precioOrigenEtiqueta?: string
}

interface Props {
  onSelect: (item: InventarioOption | null) => void
  placeholder?: string
  className?: string
  disabled?: boolean
  clienteId?: string
  monedaDocumento?: string
}

export function InventarioPicker({
  onSelect,
  placeholder = 'Buscar en inventario (nombre o SKU)…',
  className,
  disabled,
  clienteId,
  monedaDocumento = 'ARS',
}: Props) {
  const [q, setQ] = useState('')
  const [items, setItems] = useState<InventarioOption[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [resolviendo, setResolviendo] = useState(false)
  const [ultimoOrigen, setUltimoOrigen] = useState<string | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  useEffect(() => {
    setUltimoOrigen(null)
  }, [clienteId, monedaDocumento])

  useEffect(() => {
    if (q.trim().length < 2) {
      setItems([])
      return
    }
    const t = window.setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/inventario?q=${encodeURIComponent(q.trim())}&limit=20`, {
          credentials: 'include',
        })
        const data = await res.json()
        if (Array.isArray(data)) setItems(data)
      } catch {
        setItems([])
      } finally {
        setLoading(false)
      }
    }, 280)
    return () => window.clearTimeout(t)
  }, [q])

  async function resolverPrecioItem(item: InventarioOption): Promise<InventarioOption> {
    if (!clienteId) return item
    const params = new URLSearchParams({
      inventarioId: item.id,
      moneda: monedaDocumento,
      clienteId,
    })
    const res = await fetch(`/api/precios/resolver?${params}`, { credentials: 'include' })
    if (!res.ok) return item
    const data = await res.json()
    const etiqueta = etiquetaOrigenPrecio(data)
    return {
      ...item,
      precioUnit: data.precioUnit,
      moneda: data.moneda,
      precioOrigen: data.origen,
      precioOrigenEtiqueta: etiqueta,
    }
  }

  async function elegir(item: InventarioOption) {
    setResolviendo(true)
    try {
      const resuelto = await resolverPrecioItem(item)
      setUltimoOrigen(resuelto.precioOrigenEtiqueta ?? null)
      onSelect(resuelto)
      setQ('')
      setOpen(false)
      setItems([])
    } finally {
      setResolviendo(false)
    }
  }

  return (
    <div ref={wrapRef} className={`relative ${className ?? ''}`}>
      <div className="flex items-center gap-2 border border-[#e4e7eb] rounded-[9px] px-2.5 py-1.5 bg-[#FFFBF5]">
        <Package size={14} className="text-[#E8650A] shrink-0" />
        <input
          type="text"
          value={q}
          disabled={disabled || resolviendo}
          onChange={(e) => {
            setQ(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          placeholder={resolviendo ? 'Resolviendo precio…' : placeholder}
          className="flex-1 text-[12px] bg-transparent outline-none placeholder:text-[#9aa1ab] min-w-0"
        />
        <Search size={13} className="text-[#9aa1ab] shrink-0" />
      </div>
      {ultimoOrigen && (
        <span className="inline-flex mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#FFF1E2] text-[#C4540A]">
          {ultimoOrigen}
        </span>
      )}
      {open && q.trim().length >= 2 && (
        <div className="absolute z-30 top-full left-0 right-0 mt-1 bg-white border border-[#e4e7eb] rounded-[9px] shadow-lg max-h-52 overflow-y-auto">
          {loading && (
            <p className="px-3 py-2 text-[11px] text-[#9aa1ab]">Buscando…</p>
          )}
          {!loading && items.length === 0 && (
            <p className="px-3 py-2 text-[11px] text-[#9aa1ab]">Sin resultados</p>
          )}
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => elegir(item)}
              className="w-full text-left px-3 py-2 hover:bg-[#FFF7ED] border-b border-[#f4f5f7] last:border-0"
            >
              <p className="text-[12px] font-semibold text-[#1f242c] truncate">{item.nombre}</p>
              <p className="text-[10.5px] text-[#6b7280]">
                {item.sku ? `SKU ${item.sku} · ` : ''}
                Stock {item.stock}
                {item.precioUnit != null ? ` · ${formatMontoMoneda(item.precioUnit, item.moneda ?? 'ARS')}` : ''}
                {clienteId ? ' · precio sugerido al elegir' : ''}
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
