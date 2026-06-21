'use client'

import { useEffect, useState } from 'react'
import { Select } from '@/components/ui/select'
import {
  formatMontoMoneda,
  etiquetaMoneda,
  type MonedaDocumento,
} from '@/lib/moneda'

interface Props {
  moneda: MonedaDocumento
  onMonedaChange: (moneda: MonedaDocumento) => void
  cotizacionUsd: number | null
  onCotizacionUsdChange: (valor: number | null) => void
  totalDocumento?: number
  className?: string
}

export function MonedaDocumentoPanel({
  moneda,
  onMonedaChange,
  cotizacionUsd,
  onCotizacionUsdChange,
  totalDocumento,
  className = '',
}: Props) {
  const [loadingCot, setLoadingCot] = useState(false)

  useEffect(() => {
    if (moneda !== 'USD') return
    if (cotizacionUsd != null && cotizacionUsd > 0) return

    setLoadingCot(true)
    fetch('/api/contabilidad/cotizacion-usd', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.cotizacionUsd && d.cotizacionUsd > 0) {
          onCotizacionUsdChange(Number(d.cotizacionUsd))
        }
      })
      .catch(() => {})
      .finally(() => setLoadingCot(false))
  }, [moneda, cotizacionUsd, onCotizacionUsdChange])

  const equivalenteArs =
    moneda === 'USD' && cotizacionUsd && totalDocumento != null
      ? totalDocumento * cotizacionUsd
      : null

  return (
    <div className={`flex flex-col gap-3 col-span-2 ${className}`}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Select
          label="Moneda del documento"
          value={moneda}
          onChange={(e) => {
            const next = e.target.value as MonedaDocumento
            onMonedaChange(next)
            if (next === 'ARS') onCotizacionUsdChange(null)
          }}
          options={[
            { value: 'ARS', label: 'ARS — Peso argentino' },
            { value: 'USD', label: 'USD — Dólar estadounidense' },
          ]}
        />
        {moneda === 'USD' && (
          <div className="flex flex-col gap-1.5">
            <label className="text-[11.5px] font-semibold text-[#5b626d] tracking-wide uppercase">
              Cotización USD (AFIP)
            </label>
            <input
              type="number"
              min={0}
              step={0.01}
              value={cotizacionUsd ?? ''}
              onChange={(e) => {
                const v = e.target.value.trim()
                onCotizacionUsdChange(v ? Number(v) : null)
              }}
              placeholder={loadingCot ? 'Cargando…' : 'Ej. 1050'}
              className="bg-white border border-[#e4e7eb] rounded-[9px] px-3 py-2.5 text-[13.5px] text-[#1f242c] focus:outline-none focus:ring-2 focus:ring-[#E8650A]/40 focus:border-[#E8650A]"
            />
            <p className="text-[11px] text-[#9aa1ab]">
              Tipo de cambio para AFIP. Se precarga desde Contabilidad si está configurado.
            </p>
          </div>
        )}
      </div>
      {equivalenteArs != null && (
        <p className="text-[12px] text-[#6b7280] bg-[#f4f6f9] rounded-[8px] px-3 py-2">
          Equivalente aprox. en ARS:{' '}
          <span className="font-semibold text-[#1f242c]">
            {formatMontoMoneda(equivalenteArs, 'ARS')}
          </span>
          {' '}(tipo {cotizacionUsd?.toLocaleString('es-AR')} · documento en {etiquetaMoneda(moneda)})
        </p>
      )}
    </div>
  )
}
