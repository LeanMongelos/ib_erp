import { notFound, redirect } from 'next/navigation'
import { Header } from '@/components/layout/Header'
import { NuevoPresupuestoForm } from '@/components/presupuestos/NuevoPresupuestoForm'
import { prisma } from '@/lib/prisma'
import { plain } from '@/lib/serialize'
import {
  ensureClienteEventual,
  ordenarClientesConEventual,
} from '@/lib/clientes/eventual'
import { requirePagePermission } from '@/lib/page-guard'
import { obtenerPlantillaPredeterminadaResumen } from '@/lib/plantillas/resolver-plantilla'

export default async function NuevoPresupuestoPage({
  searchParams,
}: {
  searchParams: Promise<{ otId?: string; clienteId?: string; negocioEmbudoId?: string; modo?: string }>
}) {
  await requirePagePermission('presupuestos.create')

  const { otId, clienteId: clienteIdParam, negocioEmbudoId, modo } = await searchParams
  const modoOcasional = modo === 'ocasional'
  const clienteEventual = await ensureClienteEventual()

  const ot = otId
    ? await prisma.ordenTrabajo.findUnique({
        where: { id: otId },
        include: { repuestos: true },
      })
    : null

  if (otId && !ot) notFound()

  if (ot) {
    const presExistente = await prisma.presupuesto.findFirst({
      where: {
        otId: ot.id,
        estado: { notIn: ['RECHAZADO', 'VENCIDO'] },
        factura: null,
      },
      orderBy: { creadoEn: 'desc' },
    })
    if (presExistente) {
      redirect(`/presupuestos/${presExistente.id}`)
    }
    const otConFactura = await prisma.factura.findUnique({ where: { otId: ot.id } })
    if (otConFactura) {
      redirect(`/servicio-tecnico/${ot.id}`)
    }
  }

  const [clientesRaw, emisores] = await Promise.all([
    prisma.cliente.findMany({
      where: { activo: true },
      select: {
        id: true,
        nombre: true,
        condicionIva: true,
        alicuotaIva: { select: { porcentaje: true } },
      },
    }),
    prisma.emisor.findMany({
      where: { activo: true },
      select: { id: true, razonSocial: true, predeterminado: true },
    }),
  ])

  const clientes = ordenarClientesConEventual(clientesRaw, clienteEventual.id)
  const plantillaPresupuesto = await obtenerPlantillaPredeterminadaResumen('PRESUPUESTO')

  const subtitle = ot
    ? `Desde OT ${ot.numero} · ${ot.descripcion.slice(0, 60)}`
    : modoOcasional
      ? 'Venta ocasional · Nueva cotización'
      : 'Presupuestos · Nueva cotización'

  return (
    <>
      <Header title="Nuevo Presupuesto" subtitle={subtitle} />
      <div className="flex-1 overflow-y-auto bg-[#F4F6F9] p-6">
        <NuevoPresupuestoForm
          clientes={JSON.parse(JSON.stringify(plain(clientes)))}
          emisores={JSON.parse(JSON.stringify(plain(emisores)))}
          clienteEventualId={clienteEventual.id}
          clienteInicialId={clienteIdParam ?? ot?.clienteId ?? ''}
          negocioEmbudoId={negocioEmbudoId}
          otPrefill={ot ? plain(ot) : null}
          plantillaPresupuesto={plain(plantillaPresupuesto)}
          modoOcasional={modoOcasional}
        />
      </div>
    </>
  )
}
