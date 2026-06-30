import { Header } from '@/components/layout/Header'
import { TicketDetalle } from '@/components/tickets/TicketDetalle'
import { requirePagePermission } from '@/lib/page-guard'

export default async function TicketDetallePage({ params }: { params: Promise<{ id: string }> }) {
  await requirePagePermission('tickets.read')
  const { id } = await params

  return (
    <>
      <Header title="Ticket" subtitle="Seguimiento y comentarios" />
      <div className="flex-1 overflow-y-auto bg-[#F4F6F9] p-6">
        <TicketDetalle ticketId={id} />
      </div>
    </>
  )
}
