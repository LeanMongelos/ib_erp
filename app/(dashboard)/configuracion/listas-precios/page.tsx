import { Header } from '@/components/layout/Header'
import { prisma } from '@/lib/prisma'
import { requirePagePermission } from '@/lib/page-guard'
import { ListasPreciosManager } from '@/components/configuracion/ListasPreciosManager'

export default async function ListasPreciosPage() {
  await requirePagePermission('listas_precios.read')

  const listas = await prisma.listaPrecios.findMany({
    where: { activo: true },
    orderBy: [{ predeterminada: 'desc' }, { codigo: 'asc' }],
    include: { _count: { select: { items: true, clientes: true } } },
  })

  return (
    <>
      <Header title="Listas de precios" subtitle={`${listas.length} listas activas`} />
      <div className="flex-1 overflow-y-auto bg-[#F4F6F9] p-6">
        <ListasPreciosManager inicial={JSON.parse(JSON.stringify(listas))} />
      </div>
    </>
  )
}
