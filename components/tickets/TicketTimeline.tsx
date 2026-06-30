import { formatFechaHora } from '@/lib/utils'
import { labelEstadoTicket } from '@/lib/tickets/constants'

const DOT_COLORS: Record<string, string> = {
  ABIERTA: '#1D4ED8',
  EN_REVISION: '#2563EB',
  EN_PROGRESO: '#E8650A',
  ESPERANDO_INFO: '#D97706',
  RESUELTA: '#15803D',
  CERRADA: '#6B7280',
  CANCELADA: '#9CA3AF',
}

interface HistorialItem {
  id: string
  estado: string
  nota?: string | null
  creadoEn: string
  usuario?: { nombre: string } | null
}

export function TicketTimeline({ historial }: { historial: HistorialItem[] }) {
  return (
    <div className="flex flex-col">
      {historial.map((item, i) => {
        const isLast = i === historial.length - 1
        const color = DOT_COLORS[item.estado] ?? '#6B7280'
        return (
          <div key={item.id} className="flex gap-3.5">
            <div className="flex flex-col items-center">
              <span
                className="w-[11px] h-[11px] rounded-full border-2 border-white flex-shrink-0"
                style={{ background: color, boxShadow: `0 0 0 2px ${color}` }}
              />
              {!isLast && <span className="w-0.5 flex-1 bg-[#eef0f3] min-h-[26px]" />}
            </div>
            <div className="pb-[18px]">
              <p className="text-[12.5px] font-bold text-[#1f242c]">
                {labelEstadoTicket(item.estado as never)}
              </p>
              {item.nota && (
                <p className="text-[12px] text-[#6b7280] mt-0.5 italic">{item.nota}</p>
              )}
              <p className="text-[11.5px] text-[#9aa1ab] mt-0.5">
                {item.usuario?.nombre ?? 'Sistema'} · {formatFechaHora(item.creadoEn)}
              </p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
