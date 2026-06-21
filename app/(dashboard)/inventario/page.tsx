import { Header } from '@/components/layout/Header'
import { prisma } from '@/lib/prisma'
import { InventarioManager } from '@/components/inventario/InventarioManager'
import { requirePagePermission } from '@/lib/page-guard'
import { getFaltantesStock } from '@/lib/inventario'
import { plain } from '@/lib/serialize'

async function getInventario() {
  return prisma.inventario.findMany({
    where: { activo: true },
    include: {
      alicuotaIva: { select: { id: true, porcentaje: true, nombre: true } },
      kitComoEquipo: { orderBy: { orden: 'asc' } },
    },
    orderBy: { nombre: 'asc' },
  })
}

export default async function InventarioPage() {
  await requirePagePermission('inventario.read')

  const [items, faltantes] = await Promise.all([
    getInventario(),
    getFaltantesStock(),
  ])

  const stockBajo = items.filter((i) => i.stock <= i.stockMinimo)

  return (
    <>
      <Header
        title="ERP · Inventario"
        subtitle={`${items.length} productos · ${stockBajo.length} con stock bajo`}
      />

      <div className="flex-1 overflow-y-auto bg-[#F4F6F9] p-6">
        <InventarioManager
          items={JSON.parse(JSON.stringify(plain(items)))}
          faltantesCount={faltantes.length}
        />
      </div>
    </>
  )
}
