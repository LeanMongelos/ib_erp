'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Plus } from 'lucide-react'
import { inferirTipoArticuloDesdeCodigo } from '@/lib/inventario/tipo-articulo'
import { extraerPrefijoCodigo, incrementarCodigoInterno } from '@/lib/inventario/siguiente-codigo'

interface Props {
  value: string
  onChange: (sku: string, extras?: { tipoArticulo?: string; esSerializado?: boolean; requierePreventivo?: boolean; modoTrazabilidad?: string }) => void
  required?: boolean
  disabled?: boolean
  /** Al abrir alta: sugerir correlativo según tipo (ALQ para alquiler). */
  tipoArticulo?: string
  autoSugerir?: boolean
}

export function CodigoInternoField({
  value,
  onChange,
  required,
  disabled,
  tipoArticulo,
  autoSugerir = false,
}: Props) {
  const [hint, setHint] = useState<string | null>(null)
  const [cargando, setCargando] = useState(false)
  const debounceRef = useRef<number | null>(null)

  const aplicarExtrasCodigo = useCallback(
    (sku: string) => {
      const tipoInferido = inferirTipoArticuloDesdeCodigo(sku)
      if (tipoInferido) {
        onChange(sku, {
          tipoArticulo: tipoInferido,
          esSerializado: true,
          requierePreventivo: true,
          modoTrazabilidad: 'SERIE',
        })
      } else {
        onChange(sku)
      }
    },
    [onChange],
  )

  const fetchSiguiente = useCallback(
    async (prefijo: string, reemplazar = false) => {
      setCargando(true)
      try {
        const res = await fetch(`/api/inventario/siguiente-codigo?prefijo=${encodeURIComponent(prefijo)}`, {
          credentials: 'include',
        })
        if (!res.ok) return
        const data = (await res.json()) as {
          ultimo: string | null
          siguiente: string
        }
        if (reemplazar || !value.trim() || /^[A-Z]{3,4}$/.test(value)) {
          aplicarExtrasCodigo(data.siguiente)
        }
        setHint(
          data.ultimo
            ? `Último en stock: ${data.ultimo} → sugerido ${data.siguiente}`
            : `Sin códigos ${prefijo}* aún → sugerido ${data.siguiente}`,
        )
      } catch {
        setHint(null)
      } finally {
        setCargando(false)
      }
    },
    [aplicarExtrasCodigo, value],
  )

  useEffect(() => {
    if (!autoSugerir) return
    if (tipoArticulo === 'ALQUILER') {
      void fetchSiguiente('ALQ', true)
    }
  }, [autoSugerir, tipoArticulo, fetchSiguiente])

  function handleChange(raw: string) {
    const v = raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8)
    const tipoInferido = inferirTipoArticuloDesdeCodigo(v)
    if (tipoInferido) {
      onChange(v, {
        tipoArticulo: tipoInferido,
        esSerializado: true,
        requierePreventivo: true,
        modoTrazabilidad: 'SERIE',
      })
    } else {
      onChange(v)
    }

    if (debounceRef.current) window.clearTimeout(debounceRef.current)
    const prefijo = extraerPrefijoCodigo(v)
    if (prefijo && /^[A-Z]{3,4}$/.test(v)) {
      debounceRef.current = window.setTimeout(() => {
        void fetchSiguiente(prefijo, false)
      }, 400)
    } else if (!v) {
      setHint(null)
    }
  }

  function handleMasUno() {
    const prefijo = extraerPrefijoCodigo(value)
    if (prefijo && /^[A-Z]{3,4}$/.test(value)) {
      void fetchSiguiente(prefijo, true)
      return
    }
    const inc = incrementarCodigoInterno(value)
    if (!inc.ok) {
      setHint(inc.error)
      return
    }
    aplicarExtrasCodigo(inc.codigo)
    setHint(`Correlativo ${inc.codigo}`)
  }

  return (
    <div className="flex flex-col gap-1.5 sm:col-span-2">
      <label className="text-[11.5px] font-semibold text-[#5b626d] uppercase">
        Código interno{required ? ' *' : ''}
      </label>
      <div className="flex gap-2">
        <input
          type="text"
          required={required}
          disabled={disabled || cargando}
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          onBlur={() => {
            const prefijo = extraerPrefijoCodigo(value)
            if (prefijo && /^[A-Z]{3,4}$/.test(value)) {
              void fetchSiguiente(prefijo, true)
            }
          }}
          maxLength={8}
          autoComplete="off"
          placeholder="HOE098"
          className="flex-1 border border-[#e4e7eb] rounded-[9px] px-3 py-2 text-[13px] font-mono uppercase"
        />
        <button
          type="button"
          disabled={disabled || cargando}
          onClick={handleMasUno}
          title="Siguiente número correlativo (+1)"
          className="shrink-0 px-3 py-2 rounded-[9px] border border-[#E8650A] text-[#E8650A] text-[13px] font-bold hover:bg-[#FFF4EC] disabled:opacity-50 flex items-center gap-1"
        >
          <Plus size={14} />
          +1
        </button>
      </div>
      <p className="text-[10.5px] text-[#9aa1ab] leading-snug">
        3–4 letras + 3–4 números (mín. HOE098 · máx. ABCD1234). Escribí el prefijo (ej. HOE) y usá +1 para el correlativo.
      </p>
      {hint && (
        <p className="text-[10.5px] text-[#6b7280] leading-snug bg-[#f9fafb] border border-[#eef0f2] rounded-[6px] px-2 py-1">
          {hint}
        </p>
      )}
    </div>
  )
}
