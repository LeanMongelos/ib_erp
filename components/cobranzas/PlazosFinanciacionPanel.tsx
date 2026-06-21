'use client'

import { useMemo } from 'react'
import { Input } from '@/components/ui/input'
import { formatFecha, formatMonto } from '@/lib/utils'
import {
  PRESETS_PLAZOS,
  type PresetPlazoKey,
  parsePlazosCobranza,
  detectPresetFromPlazos,
} from '@/lib/cobranzas/plazos'
import {
  calcularInteresFinanciacion,
  previewVencimientosConFinanciacion,
} from '@/lib/cobranzas/financiacion'

const PRESET_LABELS: [PresetPlazoKey | 'custom', string][] = [
  ['contado', 'Contado'],
  ['30', '30 días'],
  ['30-60-90', '30 · 60 · 90'],
  ['15-45-58', '15 · 45 · 58'],
  ['custom', 'Personalizado'],
]

export interface PlazosFinanciacionState {
  presetPlazo: PresetPlazoKey | 'custom'
  plazosCustom: string
  plazos: number[]
  tasaFinanciacionPct: number
  interesFinanciacion: number
  totalConFinanciacion: number
}

interface Props {
  totalNeto: number
  presetPlazo: PresetPlazoKey | 'custom'
  onPresetPlazoChange: (preset: PresetPlazoKey | 'custom') => void
  plazosCustom: string
  onPlazosCustomChange: (value: string) => void
  tasaFinanciacionPct: number
  onTasaFinanciacionPctChange: (value: number) => void
  fechaEmision?: Date
  /** Texto bajo el título; por defecto el de facturación */
  descripcion?: string
  className?: string
}

export function plazosDesdeEstado(
  preset: PresetPlazoKey | 'custom',
  custom: string,
): number[] {
  return preset === 'custom'
    ? parsePlazosCobranza(custom)
    : [...PRESETS_PLAZOS[preset]]
}

export function estadoInicialPlazos(
  condicionPago?: string | null,
  tasaFinanciacionPct = 0,
): Pick<PlazosFinanciacionState, 'presetPlazo' | 'plazosCustom' | 'tasaFinanciacionPct'> {
  const plazos = parsePlazosCobranza(condicionPago)
  const preset = detectPresetFromPlazos(plazos)
  if (preset === 'custom') {
    return {
      presetPlazo: 'custom',
      plazosCustom: plazos.join('-'),
      tasaFinanciacionPct,
    }
  }
  if (preset === 'contado') {
    return { presetPlazo: '30-60-90', plazosCustom: '30-60-90', tasaFinanciacionPct }
  }
  return {
    presetPlazo: preset as PresetPlazoKey,
    plazosCustom: plazos.join('-'),
    tasaFinanciacionPct,
  }
}

export function PlazosFinanciacionPanel({
  totalNeto,
  presetPlazo,
  onPresetPlazoChange,
  plazosCustom,
  onPlazosCustomChange,
  tasaFinanciacionPct,
  onTasaFinanciacionPctChange,
  fechaEmision = new Date(),
  descripcion = 'Cada plazo se cuenta desde la fecha de emisión. Al llegar cada día se avisa a Guillermo y Lucas.',
  className,
}: Props) {
  const plazos = useMemo(
    () => plazosDesdeEstado(presetPlazo, plazosCustom),
    [presetPlazo, plazosCustom],
  )

  const interesFinanciacion = useMemo(
    () => calcularInteresFinanciacion(totalNeto, plazos, tasaFinanciacionPct),
    [totalNeto, plazos, tasaFinanciacionPct],
  )

  const preview = useMemo(
    () =>
      plazos.length > 0 && totalNeto > 0
        ? previewVencimientosConFinanciacion(
            fechaEmision,
            plazos,
            totalNeto,
            tasaFinanciacionPct,
          )
        : [],
    [fechaEmision, plazos, totalNeto, tasaFinanciacionPct],
  )

  return (
    <div className={className}>
      <label className="text-[11.5px] font-semibold text-[#5b626d] tracking-wide uppercase block mb-2">
        Plazos de cobranza
      </label>
      <p className="text-[11.5px] text-[#9aa1ab] mb-3">{descripcion}</p>
      <div className="flex flex-wrap gap-2 mb-3">
        {PRESET_LABELS.map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => onPresetPlazoChange(key)}
            className={`px-3 py-1.5 rounded-[8px] text-[12px] font-semibold border transition-colors ${
              presetPlazo === key
                ? 'bg-[#E8650A] text-white border-[#E8650A]'
                : 'bg-white text-[#3a4150] border-[#e4e7eb] hover:border-[#E8650A]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {presetPlazo === 'custom' && (
        <Input
          value={plazosCustom}
          onChange={(e) => onPlazosCustomChange(e.target.value)}
          placeholder="Ej: 15-45-58 o 20, 40, 60"
          autoComplete="off"
          className="mb-3"
        />
      )}
      <div className="mb-3 max-w-xs">
        <Input
          label="Tasa de financiación (% mensual)"
          type="number"
          min={0}
          step={0.1}
          value={tasaFinanciacionPct || ''}
          onChange={(e) => onTasaFinanciacionPctChange(Number(e.target.value) || 0)}
          placeholder="0"
        />
      </div>
      {preview.length > 0 && (
        <div className="bg-[#f4f6f9] rounded-[8px] px-3 py-2.5">
          <p className="text-[11px] font-bold text-[#5b626d] uppercase mb-2">Cronograma</p>
          <div className="flex flex-col gap-1">
            {preview.map((v) => (
              <div key={v.numeroCuota} className="flex justify-between text-[12px] text-[#3a4150]">
                <span>
                  Cuota {v.numeroCuota} — día {v.dias} ({formatFecha(v.fecha)})
                  {v.interes > 0 && (
                    <span className="text-[#9aa1ab] ml-1">
                      (int. {formatMonto(v.interes)})
                    </span>
                  )}
                </span>
                <span className="font-semibold">{formatMonto(v.monto)}</span>
              </div>
            ))}
          </div>
          {interesFinanciacion > 0 && (
            <p className="text-[11px] text-[#6b7280] mt-2 pt-2 border-t border-[#e4e7eb]">
              Interés total de financiación:{' '}
              <span className="font-semibold text-[#E8650A]">{formatMonto(interesFinanciacion)}</span>
              {' · '}
              Total a cobrar:{' '}
              <span className="font-semibold">{formatMonto(totalNeto + interesFinanciacion)}</span>
            </p>
          )}
        </div>
      )}
    </div>
  )
}
