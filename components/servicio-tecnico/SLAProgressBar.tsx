import { calcularPorcentajeSLA } from '@/lib/utils'
import { cn } from '@/lib/utils'

interface SLAProgressBarProps {
  fechaApertura: string
  slaVence: string
  estado: string
}

export function SLAProgressBar({ fechaApertura, slaVence, estado }: SLAProgressBarProps) {
  const porcentaje = calcularPorcentajeSLA(fechaApertura, slaVence)
  const vencido = estado === 'VENCIDA' || porcentaje >= 100
  const enRiesgo = porcentaje >= 70 && !vencido

  const venceDate = new Date(slaVence)
  const ahora = new Date()
  const diffMs = venceDate.getTime() - ahora.getTime()
  const diffHoras = Math.floor(Math.abs(diffMs) / 3600000)
  const diffMin  = Math.floor((Math.abs(diffMs) % 3600000) / 60000)

  let label = ''
  if (vencido) {
    label = `SLA VENCIDO · superó el plazo hace ${diffHoras}h ${diffMin}m`
  } else if (enRiesgo) {
    label = `SLA en riesgo · vence en ${diffHoras}h ${diffMin}m`
  } else {
    label = `SLA activo · vence en ${diffHoras}h ${diffMin}m`
  }

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between mb-2">
        <span className={cn(
          'text-[11.5px] font-bold',
          vencido  ? 'text-[#C2261B]' :
          enRiesgo ? 'text-[#E8650A]' : 'text-[#15803D]',
        )}>
          {label.toUpperCase()}
        </span>
        <span className="text-[11.5px] text-[#9aa1ab] font-semibold">
          Plazo: {venceDate.toLocaleDateString('es-AR')} {venceDate.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
      <div className="h-2 bg-[#f0f1f4] rounded-full overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all',
            vencido  ? 'bg-gradient-to-r from-[#E8650A] to-[#C2261B]' :
            enRiesgo ? 'bg-[#E8650A]' : 'bg-[#22C55E]',
          )}
          style={{ width: `${Math.min(porcentaje, 100)}%` }}
        />
      </div>
    </div>
  )
}
