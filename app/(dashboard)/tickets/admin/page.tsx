import { Suspense } from 'react'
import { Header } from '@/components/layout/Header'
import { TicketsTable } from '@/components/tickets/TicketsTable'
import { prisma } from '@/lib/prisma'
import { requirePagePermission } from '@/lib/page-guard'
import { estadosTicketAbiertos } from '@/lib/tickets/transiciones'

async function getResumen() {
  const abiertas = await prisma.ticket.count({
    where: { estado: { in: estadosTicketAbiertos() } },
  })
  const sinAsignar = await prisma.ticket.count({
    where: { asignadoId: null, estado: { in: estadosTicketAbiertos() } },
  })
  return { abiertas, sinAsignar }
}

export default async function TicketsAdminPage() {
  await requirePagePermission('tickets.read_all')
  const { abiertas, sinAsignar } = await getResumen()

  return (
    <>
      <Header
        title="Tickets — Panel administración"
        subtitle={`${abiertas} abiertos · ${sinAsignar} sin asignar · orden cronológico`}
      />
      <div className="flex-1 overflow-y-auto bg-[#F4F6F9] p-6">
        <Suspense fallback={<p className="text-[12.5px] text-[#9aa1ab]">Cargando…</p>}>
          <TicketsTable modoAdmin />
        </Suspense>
      </div>
    </>
  )
}
