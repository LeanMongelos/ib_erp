import { notFound } from 'next/navigation'
import { Header } from '@/components/layout/Header'
import { ProveedorFicha } from '@/components/proveedores/ProveedorFicha'
import { prisma } from '@/lib/prisma'
import { requirePagePermission } from '@/lib/page-guard'
import { calcularMetricasProveedor } from '@/lib/proveedores-metrics'
import { resumenCuentaCorrienteProveedor } from '@/lib/compras/cuenta-corriente'

async function getProveedor(id: string) {
  return prisma.proveedor.findUnique({
    where: { id },
    include: {
      contactos: { orderBy: [{ principal: 'desc' }, { nombre: 'asc' }] },
      condiciones: { orderBy: { plazoDias: 'asc' } },
      productos: {
        orderBy: { vigenteDesde: 'desc' },
        include: { inventario: { select: { id: true, nombre: true, sku: true } } },
      },
    },
  })
}

export default async function ProveedorFichaPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requirePagePermission('proveedores.read')
  const { id } = await params
  const [proveedor, pagosProveedor, cuentaCorriente] = await Promise.all([
    getProveedor(id),
    prisma.pagoProveedor.findMany({
      where: { proveedorId: id, estado: 'REGISTRADO' },
      orderBy: { fecha: 'desc' },
      take: 10,
      select: {
        id: true,
        monto: true,
        moneda: true,
        fecha: true,
        medio: true,
        referencia: true,
        imputaciones: {
          select: {
            monto: true,
            vencimientoPago: {
              select: { facturaCompra: { select: { numero: true } } },
            },
          },
        },
      },
    }),
    resumenCuentaCorrienteProveedor(id),
  ])
  if (!proveedor) notFound()

  const metricasCalc = calcularMetricasProveedor(
    proveedor.productos.map((p) => ({
      inventarioId: p.inventarioId,
      nombreProducto: p.nombreProducto,
      costo: p.costo,
      moneda: p.moneda,
      leadTimeDias: p.leadTimeDias,
      vigenteDesde: p.vigenteDesde,
    })),
    proveedor.condiciones.map((c) => ({
      descripcion: c.descripcion,
      plazoDias: c.plazoDias,
      recargoPct: c.recargoPct,
      descuentoPct: c.descuentoPct,
    })),
    proveedor.contactos.length,
  )

  return (
    <>
      <Header title={proveedor.razonSocial} subtitle="Proveedores · Ficha" />
      <div className="flex-1 overflow-y-auto bg-[#F4F6F9] p-6">
        <ProveedorFicha
          proveedor={JSON.parse(JSON.stringify(proveedor))}
          metricas={JSON.parse(JSON.stringify(metricasCalc))}
          pagosProveedor={JSON.parse(JSON.stringify(pagosProveedor))}
          cuentaCorriente={JSON.parse(JSON.stringify(cuentaCorriente))}
        />
      </div>
    </>
  )
}
