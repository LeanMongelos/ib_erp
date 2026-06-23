import { notFound } from 'next/navigation'
import { Header } from '@/components/layout/Header'
import { PresupuestoDetalle } from '@/components/presupuestos/PresupuestoDetalle'
import { prisma } from '@/lib/prisma'
import { plain } from '@/lib/serialize'
import { requirePagePermission } from '@/lib/page-guard'

export default async function PresupuestoDetallePage({ params }: { params: Promise<{ id: string }> }) {
  await requirePagePermission('presupuestos.read')
  const { id } = await params
  const presupuesto = await prisma.presupuesto.findUnique({
    where: { id },
    include: {
      cliente: true,
      items: {
        include: {
          inventario: { select: { tipoArticulo: true } },
        },
      },
      emisor: true,
      vendedor: { select: { nombre: true } },
      factura: { select: { id: true, numero: true } },
      ot: { select: { id: true, numero: true } },
    },
  })
  if (!presupuesto) notFound()

  return (
    <>
      <Header title="Detalle de presupuesto" subtitle={presupuesto.numero} />
      <div className="flex-1 overflow-y-auto bg-[#F4F6F9] p-6">
        <PresupuestoDetalle presupuesto={JSON.parse(JSON.stringify(plain(presupuesto)))} />
      </div>
    </>
  )
}
