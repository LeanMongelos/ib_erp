import { Header } from '@/components/layout/Header'
import { prisma } from '@/lib/prisma'
import { requirePagePermission } from '@/lib/page-guard'
import { ProveedoresManager } from '@/components/proveedores/ProveedoresManager'

async function getProveedores() {
  return prisma.proveedor.findMany({
    where: { activo: true },
    include: { _count: { select: { productos: true, contactos: true } } },
    orderBy: { razonSocial: 'asc' },
  })
}

export default async function ProveedoresPage() {
  await requirePagePermission('proveedores.read')
  const proveedores = await getProveedores()

  return (
    <>
      <Header title="Proveedores" subtitle={`${proveedores.length} proveedores activos`} />
      <div className="flex-1 overflow-y-auto bg-[#F4F6F9] p-6">
        <ProveedoresManager proveedores={JSON.parse(JSON.stringify(proveedores))} />
      </div>
    </>
  )
}
