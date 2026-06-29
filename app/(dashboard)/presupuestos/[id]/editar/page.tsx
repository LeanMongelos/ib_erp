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
import { presupuestoEditable } from '@/lib/presupuestos/revision'

export default async function EditarPresupuestoPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePagePermission('presupuestos.update')
  const { id } = await params

  const presupuesto = await prisma.presupuesto.findUnique({
    where: { id },
    include: {
      factura: { select: { id: true } },
      items: {
        include: {
          inventario: {
            select: { tipoArticulo: true, esSerializado: true },
          },
        },
      },
    },
  })
  if (!presupuesto) notFound()
  if (!presupuestoEditable(presupuesto.estado, Boolean(presupuesto.factura))) {
    redirect(`/presupuestos/${id}`)
  }

  const clienteEventual = await ensureClienteEventual()
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

  return (
    <>
      <Header
        title="Editar presupuesto"
        subtitle={`${presupuesto.numero} · v${presupuesto.version} · ${presupuesto.estado}`}
      />
      <div className="flex-1 overflow-y-auto bg-[#F4F6F9] p-6">
        <NuevoPresupuestoForm
          clientes={JSON.parse(JSON.stringify(plain(clientes)))}
          emisores={JSON.parse(JSON.stringify(plain(emisores)))}
          clienteEventualId={clienteEventual.id}
          plantillaPresupuesto={plain(plantillaPresupuesto)}
          editPrefill={JSON.parse(JSON.stringify(plain(presupuesto)))}
        />
      </div>
    </>
  )
}
