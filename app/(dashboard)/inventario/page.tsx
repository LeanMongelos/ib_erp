import { Header } from '@/components/layout/Header'
import { Suspense } from 'react'
import { prisma } from '@/lib/prisma'
import { InventarioManager } from '@/components/inventario/InventarioManager'
import { ExportMovimientosStockButton } from '@/components/inventario/ExportMovimientosStockButton'
import { requirePagePermission } from '@/lib/page-guard'
import { tienePermiso } from '@/lib/rbac'
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
  const user = await requirePagePermission('inventario.read')

  const [items, faltantes] = await Promise.all([
    getInventario(),
    getFaltantesStock(),
  ])

  const stockBajo = items.filter((i) => i.stock <= i.stockMinimo)
  const puedeExportarMovimientos =
    tienePermiso(user.permissions, 'inventario.read') ||
    tienePermiso(user.permissions, 'reportes.read_operativo')

  return (
    <>
      <Header
        title="ERP · Inventario"
        subtitle={`${items.length} productos · ${stockBajo.length} con stock bajo`}
      />

      <div className="flex-1 overflow-y-auto bg-[#F4F6F9] p-6">
        {puedeExportarMovimientos && (
          <div className="flex justify-end mb-4">
            <ExportMovimientosStockButton />
          </div>
        )}
        <Suspense fallback={<p className="text-[12.5px] text-[#9aa1ab] p-6">Cargando inventario…</p>}>
          <InventarioManager
            items={JSON.parse(JSON.stringify(plain(items)))}
            faltantesCount={faltantes.length}
          />
        </Suspense>
      </div>
    </>
  )
}
