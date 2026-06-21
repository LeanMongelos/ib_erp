'use client'

interface AlicuotaOption {
  id: string
  codigo: string
  nombre: string
  porcentaje: number
}

interface Props {
  label?: string
  value: number
  onChange: (porcentaje: number) => void
  alicuotas: AlicuotaOption[]
  className?: string
  compact?: boolean
}

export function AlicuotaSelector({
  label,
  value,
  onChange,
  alicuotas,
  className = '',
  compact = false,
}: Props) {
  const opciones = [...alicuotas].sort((a, b) => a.porcentaje - b.porcentaje)
  const match = opciones.find((a) => Math.abs(a.porcentaje - value) < 0.001)
  const selectValue = match ? String(match.porcentaje) : 'custom'
  const pctLabel = Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, '')

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && (
        <label className="text-[11.5px] font-semibold text-[#5b626d] tracking-wide uppercase">
          {label}
        </label>
      )}
      <div className={compact ? 'flex gap-2 items-center' : 'flex flex-col gap-2'}>
        <select
          value={selectValue}
          onChange={(e) => {
            if (e.target.value === 'custom') return
            onChange(Number(e.target.value))
          }}
          className={`bg-white border border-[#e4e7eb] rounded-[9px] text-[13px] text-[#1f242c] focus:outline-none focus:ring-2 focus:ring-[#E8650A]/40 focus:border-[#E8650A] ${
            compact ? 'px-2 py-1.5' : 'px-3 py-2.5 w-full'
          }`}
        >
          {opciones.map((a) => (
            <option key={a.id} value={a.porcentaje}>
              {a.nombre} ({a.porcentaje}%)
            </option>
          ))}
          <option value="custom">Otro %…</option>
        </select>
        {(selectValue === 'custom' || !match) && (
          <input
            type="number"
            min={0}
            max={100}
            step={0.1}
            value={value}
            onChange={(e) => onChange(Number(e.target.value))}
            className={`bg-white border border-[#e4e7eb] rounded-[9px] text-[13px] ${
              compact ? 'w-20 px-2 py-1.5 text-right' : 'px-3 py-2.5 w-full'
            }`}
            placeholder="%"
          />
        )}
        {compact && match && (
          <span className="text-[11px] text-[#9aa1ab] whitespace-nowrap">{pctLabel}%</span>
        )}
      </div>
    </div>
  )
}

export type { AlicuotaOption }
