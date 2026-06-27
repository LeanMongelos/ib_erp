'use client'

import Link from 'next/link'

const ESTADO_OC: Record<string, string> = {
  BORRADOR: 'Borrador',
  PENDIENTE_APROBACION: 'Pend. aprob.',
  APROBADA: 'Aprobada',
  RECHAZADA: 'Rechazada',
  ENVIADA: 'Enviada',
  PARCIAL: 'Parcial',
  RECIBIDA: 'Recibida',
  CANCELADA: 'Cancelada',
}

export function OcsVinculadasLinks({
  ordenes,
}: {
  ordenes: { id: string; numero: string; estado: string }[]
}) {
  if (ordenes.length === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-2 mt-2">
      <span className="text-[11px] font-bold text-[#8a909a] uppercase tracking-wide">OC vinculadas:</span>
      {ordenes.map((oc) => (
        <Link
          key={oc.id}
          href={`/compras?tab=oc&oc=${oc.id}`}
          className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#E8650A] hover:underline"
        >
          {oc.numero}
          <span className="text-[10px] font-bold text-[#6b7280] normal-case">
            ({ESTADO_OC[oc.estado] ?? oc.estado})
          </span>
        </Link>
      ))}
    </div>
  )
}
