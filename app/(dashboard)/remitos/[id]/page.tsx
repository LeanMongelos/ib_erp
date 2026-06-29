import { Header } from '@/components/layout/Header'
import { RemitoVentaEditor } from '@/components/remitos/RemitoVentaEditor'
import { requirePagePermission } from '@/lib/page-guard'

export default async function RemitoVentaPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePagePermission('facturas.read')
  const { id } = await params

  return (
    <>
      <Header title="Remito de venta" subtitle="Asigná números de serie antes de facturar" />
      <div className="flex-1 overflow-y-auto bg-[#F4F6F9] p-6">
        <RemitoVentaEditor remitoId={id} />
      </div>
    </>
  )
}
