import { Suspense } from 'react'
import { Header } from '@/components/layout/Header'
import { TicketsTable } from '@/components/tickets/TicketsTable'
import { requirePagePermission } from '@/lib/page-guard'

export default async function MisTicketsPage() {
  await requirePagePermission('tickets.read')

  return (
    <>
      <Header title="Mis tickets" subtitle="Pedidos que enviaste al equipo de desarrollo" />
      <div className="flex-1 overflow-y-auto bg-[#F4F6F9] p-6">
        <Suspense fallback={<p className="text-[12.5px] text-[#9aa1ab]">Cargando…</p>}>
          <TicketsTable soloMios />
        </Suspense>
      </div>
    </>
  )
}
