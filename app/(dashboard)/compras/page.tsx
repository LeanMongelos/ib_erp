import { Header } from '@/components/layout/Header'
import { ComprasManager } from '@/components/compras/ComprasManager'
import { prisma } from '@/lib/prisma'
import { requirePagePermission } from '@/lib/page-guard'
import { plain } from '@/lib/serialize'
import { getFaltantesStock } from '@/lib/inventario'
import { contarArticulosStockBajo } from '@/lib/inventario/alerta-stock-minimo'
import { fcInclude } from '@/lib/compras/factura-compra-crud'
import { ocInclude } from '@/lib/compras/oc-include'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export default async function ComprasPage() {
  const session = await getServerSession(authOptions)
  await requirePagePermission('compras.read')

  const [proveedores, ordenes, faltantes, stockBajoCount, facturas, tiposComprobante, usuarios, depositos, plantillasOc, configContable] = await Promise.all([
    prisma.proveedor.findMany({
      where: { activo: true },
      select: { id: true, razonSocial: true, tipoCompra: true, moneda: true },
      orderBy: { razonSocial: 'asc' },
    }),
    prisma.ordenCompra.findMany({
      orderBy: { creadoEn: 'desc' },
      include: ocInclude,
    }),
    getFaltantesStock(),
    contarArticulosStockBajo(),
    prisma.facturaCompra.findMany({
      orderBy: { fecha: 'desc' },
      take: 50,
      include: fcInclude,
    }),
    prisma.tipoComprobanteAfip.findMany({
      where: { activo: true },
      select: { id: true, codigoAfip: true, letra: true, descripcion: true },
      orderBy: { codigoAfip: 'asc' },
    }),
    prisma.usuario.findMany({
      where: { activo: true },
      select: { id: true, nombre: true },
      orderBy: { nombre: 'asc' },
    }),
    prisma.deposito.findMany({
      where: { activo: true },
      select: { id: true, nombre: true, tipo: true },
      orderBy: { nombre: 'asc' },
    }),
    prisma.plantillaOC.findMany({
      where: { activa: true },
      select: {
        id: true,
        nombre: true,
        clasificacionOrigen: true,
        activa: true,
        recordatorioDiaMes: true,
        proveedor: { select: { razonSocial: true } },
      },
      orderBy: { nombre: 'asc' },
    }),
    prisma.configuracionContable.findUnique({
      where: { id: 'default' },
      select: { cotizacionUsdManual: true },
    }),
  ])

  const inicial = JSON.parse(JSON.stringify(plain({
    proveedores,
    ordenes,
    faltantes,
    facturas,
    tiposComprobante,
    usuarios,
    depositos,
    plantillasOc,
  })))

  const subtitle =
    stockBajoCount > 0
      ? `${stockBajoCount} artículo${stockBajoCount !== 1 ? 's' : ''} bajo mínimo · compras y facturas`
      : 'Órdenes de compra, facturas y libro de compras'

  return (
    <>
      <Header title="Compras" subtitle={subtitle} />
      <div className="flex-1 overflow-y-auto bg-[#F4F6F9] p-6">
        <ComprasManager
          proveedores={inicial.proveedores}
          tiposComprobante={inicial.tiposComprobante}
          inicialOrdenes={inicial.ordenes}
          inicialFaltantes={inicial.faltantes}
          inicialFacturas={inicial.facturas}
          usuarios={inicial.usuarios}
          depositos={inicial.depositos}
          plantillasOc={inicial.plantillasOc}
          actorId={session?.user?.id}
          cotizacionUsdDefault={configContable?.cotizacionUsdManual ?? null}
        />
      </div>
    </>
  )
}
