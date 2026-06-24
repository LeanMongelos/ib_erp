import { notFound } from 'next/navigation'
import { Header } from '@/components/layout/Header'
import { ClienteFicha } from '@/components/crm/ClienteFicha'
import { prisma } from '@/lib/prisma'
import { calcularMetricasCliente } from '@/lib/clientes-metrics'
import { requirePagePermission } from '@/lib/page-guard'

async function getCliente(id: string) {
  return prisma.cliente.findUnique({
    where: { id },
    include: {
      equipos: true,
      ots: {
        orderBy: { creadoEn: 'desc' },
        take: 20,
        include: { tecnico: true, equipo: true },
      },
      facturas: {
        orderBy: { fechaEmision: 'desc' },
        include: { items: true },
      },
      contactos: { orderBy: [{ principal: 'desc' }, { nombre: 'asc' }] },
      _count: { select: { equipos: true, ots: true } },
    },
  })
}

async function getResumenOperativo(clienteId: string) {
  const [otsAbiertas, saldoCobranza] = await Promise.all([
    prisma.ordenTrabajo.count({
      where: {
        clienteId,
        estado: { in: ['ABIERTA', 'EN_PROCESO', 'VENCIDA'] },
      },
    }),
    prisma.vencimientoCobranza.aggregate({
      where: {
        estado: { in: ['PENDIENTE', 'AVISO_ENVIADO'] },
        factura: { clienteId },
      },
      _sum: { monto: true },
    }),
  ])

  return {
    otsAbiertas,
    saldoCobranza: saldoCobranza._sum.monto ?? 0,
  }
}

export default async function ClienteFichaPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requirePagePermission('clientes.read')
  const { id } = await params
  const cliente = await getCliente(id)
  if (!cliente) notFound()

  const resumenOperativo = await getResumenOperativo(id)

  const metricas = calcularMetricasCliente(
    cliente.facturas.map((f) => ({
      estado: f.estado,
      total: Number(f.total),
      fechaEmision: f.fechaEmision,
      fechaVencimiento: f.fechaVencimiento,
      items: f.items.map((it) => ({
        descripcion: it.descripcion,
        cantidad: it.cantidad,
        subtotal: Number(it.subtotal),
      })),
    })),
    { limiteCredito: cliente.limiteCredito != null ? Number(cliente.limiteCredito) : null },
  )

  return (
    <>
      <Header title={cliente.nombre} subtitle="CRM · Ficha de cliente 360°" />
      <div className="flex-1 overflow-y-auto bg-[#F4F6F9] p-6">
        <ClienteFicha
          cliente={JSON.parse(JSON.stringify(cliente))}
          metricas={JSON.parse(JSON.stringify(metricas))}
          resumenOperativo={JSON.parse(JSON.stringify(resumenOperativo))}
        />
      </div>
    </>
  )
}
