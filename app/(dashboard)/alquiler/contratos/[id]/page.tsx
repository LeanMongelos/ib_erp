import { notFound } from 'next/navigation'
import { Header } from '@/components/layout/Header'
import { prisma } from '@/lib/prisma'
import { requirePagePermission } from '@/lib/page-guard'
import { ContratoAlquilerDetalle } from '@/components/alquiler/ContratoAlquilerDetalle'
import { plain } from '@/lib/serialize'

type Props = { params: { id: string } }

export default async function ContratoAlquilerPage({ params }: Props) {
  await requirePagePermission('alquiler.read')

  const contrato = await prisma.contratoAlquiler.findUnique({
    where: { id: params.id },
    include: {
      cliente: { select: { id: true, nombre: true, cuit: true, telefono: true, email: true } },
      lineas: {
        include: {
          inventarioUnidad: {
            select: {
              numeroSerie: true,
              estado: true,
              inventario: { select: { nombre: true, marca: true, modelo: true } },
            },
          },
          equipo: { select: { id: true, nombre: true, numeroSerie: true } },
        },
        orderBy: { creadoEn: 'asc' },
      },
      cuotas: {
        orderBy: [{ periodo: 'desc' }, { vencimiento: 'asc' }],
        include: { factura: { select: { id: true, numero: true, estado: true } } },
      },
    },
  })

  if (!contrato) notFound()

  return (
    <>
      <Header title={contrato.numero} subtitle="Detalle del contrato de alquiler" />
      <div className="flex-1 overflow-y-auto bg-[#F4F6F9] p-6">
        <ContratoAlquilerDetalle contrato={JSON.parse(JSON.stringify(plain(contrato)))} />
      </div>
    </>
  )
}
