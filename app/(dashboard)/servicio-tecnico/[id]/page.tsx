import { notFound } from 'next/navigation'
import { Header } from '@/components/layout/Header'
import { OTDetalle } from '@/components/servicio-tecnico/OTDetalle'
import { prisma } from '@/lib/prisma'
import { actualizarOTsVencidas } from '@/lib/ots'
import { plain } from '@/lib/serialize'
import { requirePagePermission } from '@/lib/page-guard'

async function getOT(id: string) {
  await actualizarOTsVencidas()
  return prisma.ordenTrabajo.findUnique({
    where: { id },
    include: {
      cliente:  true,
      equipo:   true,
      tecnico:  true,
      repuestos: true,
      historial: { orderBy: { creadoEn: 'asc' } },
      factura: { select: { id: true, numero: true } },
      presupuestos: {
        orderBy: { creadoEn: 'desc' },
        include: {
          factura: { select: { id: true, numero: true } },
          ordenVenta: {
            select: {
              id: true,
              numero: true,
              estado: true,
              remitos: {
                orderBy: { creadoEn: 'desc' },
                select: {
                  id: true,
                  numero: true,
                  estado: true,
                  items: {
                    select: {
                      descripcion: true,
                      inventarioId: true,
                      inventarioUnidadId: true,
                      equipoId: true,
                      numeroSerie: true,
                      inventario: {
                        select: {
                          modoTrazabilidad: true,
                          tipoArticulo: true,
                          esSerializado: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      ordenesCompra: {
        select: { id: true, numero: true, estado: true },
        orderBy: { creadoEn: 'desc' },
      },
    },
  })
}

export default async function OTDetallePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requirePagePermission('servicio.read')
  const { id } = await params
  const ot = await getOT(id)
  if (!ot) notFound()

  return (
    <>
      <Header title={ot.numero} subtitle="Servicio Técnico · Detalle de OT" />
      <div className="flex-1 overflow-y-auto bg-[#F4F6F9] p-6">
        <OTDetalle ot={plain(ot)} />
      </div>
    </>
  )
}
