import { Header } from '@/components/layout/Header'
import { ComprasManager } from '@/components/compras/ComprasManager'
import { prisma } from '@/lib/prisma'
import { requirePagePermission } from '@/lib/page-guard'
import { plain } from '@/lib/serialize'
import { getFaltantesStock } from '@/lib/inventario'
import { contarArticulosStockBajo } from '@/lib/inventario/alerta-stock-minimo'

export default async function ComprasPage() {
  await requirePagePermission('compras.read')

  const [proveedores, ordenes, faltantes, stockBajoCount] = await Promise.all([
    prisma.proveedor.findMany({
      where: { activo: true },
      select: { id: true, razonSocial: true },
      orderBy: { razonSocial: 'asc' },
    }),
    prisma.ordenCompra.findMany({
      orderBy: { creadoEn: 'desc' },
      include: {
        proveedor: { select: { razonSocial: true } },
        items: true,
      },
    }),
    getFaltantesStock(),
    contarArticulosStockBajo(),
  ])

  const inicial = JSON.parse(JSON.stringify(plain({ proveedores, ordenes, faltantes })))

  const subtitle =
    stockBajoCount > 0
      ? `${stockBajoCount} artículo${stockBajoCount !== 1 ? 's' : ''} bajo mínimo · órdenes de compra`
      : 'Órdenes de compra y recepción de mercadería'

  return (
    <>
      <Header title="Compras" subtitle={subtitle} />
      <div className="flex-1 overflow-y-auto bg-[#F4F6F9] p-6">
        <ComprasManager
          proveedores={inicial.proveedores}
          inicialOrdenes={inicial.ordenes}
          inicialFaltantes={inicial.faltantes}
        />
      </div>
    </>
  )
}
