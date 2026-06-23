import { Header } from '@/components/layout/Header'
import { CobranzasForm } from '@/components/cobranzas/CobranzasForm'
import { VencimientosProximos } from '@/components/cobranzas/VencimientosProximos'
import { prisma } from '@/lib/prisma'
import { plain } from '@/lib/serialize'
import { requirePagePermission } from '@/lib/page-guard'

export default async function CobranzasPage() {
  await requirePagePermission('cobranzas.read')
  const clientes = await prisma.cliente.findMany({
    where: { activo: true },
    select: { id: true, nombre: true },
    orderBy: { nombre: 'asc' },
  })

  return (
    <>
      <Header title="Cobranzas" subtitle="Registro de pagos e imputaciones" />
      <div className="flex-1 overflow-y-auto bg-[#F4F6F9] p-6 flex flex-col gap-4">
        <VencimientosProximos />
        <CobranzasForm clientes={JSON.parse(JSON.stringify(plain(clientes)))} />
      </div>
    </>
  )
}
