import { notFound } from 'next/navigation'
import { Header } from '@/components/layout/Header'
import { PresupuestoDetalle } from '@/components/presupuestos/PresupuestoDetalle'
import { prisma } from '@/lib/prisma'
import { plain } from '@/lib/serialize'
import { requirePagePermission } from '@/lib/page-guard'
import { listarVersionesPresupuesto } from '@/lib/presupuestos/revision'
import { ordenarClientesConEventual, ensureClienteEventual } from '@/lib/clientes/eventual'

export default async function PresupuestoDetallePage({ params }: { params: Promise<{ id: string }> }) {
  await requirePagePermission('presupuestos.read')
  const { id } = await params

  const [presupuesto, versiones, clienteEventual] = await Promise.all([
    prisma.presupuesto.findUnique({
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
        ordenVenta: {
          select: {
            id: true,
            numero: true,
            estado: true,
            remitos: {
              orderBy: { creadoEn: 'desc' },
              select: { id: true, numero: true, estado: true },
            },
          },
        },
        negociosEmbudo: {
          where: { activo: true },
          select: { id: true, numero: true, etapa: true, vendedor: true },
          take: 1,
        },
        ordenesCompra: {
          select: { id: true, numero: true, estado: true },
          orderBy: { creadoEn: 'desc' },
        },
      },
    }),
    listarVersionesPresupuesto(id),
    ensureClienteEventual(),
  ])

  if (!presupuesto) notFound()

  const clientesRaw = await prisma.cliente.findMany({
    where: { activo: true },
    select: {
      id: true,
      nombre: true,
      condicionIva: true,
      alicuotaIva: { select: { porcentaje: true } },
    },
  })
  const clientesCopia = ordenarClientesConEventual(clientesRaw, clienteEventual.id)

  return (
    <>
      <Header title="Detalle de presupuesto" subtitle={presupuesto.numero} />
      <div className="flex-1 overflow-y-auto bg-[#F4F6F9] p-6">
        <PresupuestoDetalle
          presupuesto={JSON.parse(JSON.stringify(plain(presupuesto)))}
          versiones={JSON.parse(JSON.stringify(plain(versiones)))}
          clientesCopia={JSON.parse(JSON.stringify(plain(clientesCopia)))}
        />
      </div>
    </>
  )
}
