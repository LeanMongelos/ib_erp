import Link from 'next/link'
import { BadgeEstadoOT } from '@/components/ui/badge'
import { formatFecha } from '@/lib/utils'
import type { OrdenTrabajo } from '@/types'

export function RecentOTsTable({ ots }: { ots: OrdenTrabajo[] }) {
  return (
    <table className="w-full">
      <thead>
        <tr>
          {['N° OT', 'Cliente', 'Equipo', 'Técnico', 'Estado'].map((h) => (
            <th
              key={h}
              className="px-5 py-2.5 text-left text-[10.5px] font-bold text-[#8a909a] tracking-[0.6px] uppercase border-b border-[#f0f1f4]"
            >
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {ots.map((ot, i) => (
          <tr key={ot.id} className={i % 2 === 0 ? 'bg-white' : 'bg-[#fafbfc]'}>
            <td className="px-5 py-[11px] border-b border-[#f4f5f7]">
              <Link
                href={`/servicio-tecnico/${ot.id}`}
                className="text-[12.5px] font-bold text-[#E8650A] hover:underline"
              >
                {ot.numero}
              </Link>
            </td>
            <td className="px-5 py-[11px] text-[12.5px] text-[#3a4150] border-b border-[#f4f5f7]">
              {ot.cliente?.nombre ?? '—'}
            </td>
            <td className="px-5 py-[11px] text-[12.5px] text-[#6b7280] border-b border-[#f4f5f7]">
              {ot.equipo?.nombre ?? '—'}
            </td>
            <td className="px-5 py-[11px] text-[12.5px] text-[#3a4150] border-b border-[#f4f5f7]">
              {ot.tecnico?.nombre ?? 'Sin asignar'}
            </td>
            <td className="px-5 py-[11px] border-b border-[#f4f5f7]">
              <BadgeEstadoOT estado={ot.estado} />
            </td>
          </tr>
        ))}
        {ots.length === 0 && (
          <tr>
            <td colSpan={5} className="px-5 py-8 text-center text-[12.5px] text-[#9aa1ab]">
              No hay órdenes de trabajo recientes
            </td>
          </tr>
        )}
      </tbody>
    </table>
  )
}
