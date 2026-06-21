import { Header } from '@/components/layout/Header'
import { NuevaOTForm } from '@/components/servicio-tecnico/NuevaOTForm'
import { prisma } from '@/lib/prisma'
import { requirePagePermission } from '@/lib/page-guard'
import { plain } from '@/lib/serialize'

export default async function NuevaOTPage({
  searchParams,
}: {
  searchParams: Promise<{ clienteId?: string; equipoId?: string }>
}) {
  await requirePagePermission('servicio.create')

  const { clienteId, equipoId } = await searchParams

  const [clientes, equipos, tecnicos] = await Promise.all([
    prisma.cliente.findMany({
      where: { activo: true },
      select: { id: true, nombre: true },
      orderBy: { nombre: 'asc' },
    }),
    prisma.equipo.findMany({
      where: { estado: 'ACTIVO' },
      select: {
        id: true,
        nombre: true,
        clienteId: true,
        cliente: { select: { nombre: true } },
      },
      orderBy: { nombre: 'asc' },
    }),
    prisma.usuario.findMany({
      where: { activo: true, rol: { in: ['TECNICO', 'ADMIN'] } },
      select: { id: true, nombre: true },
      orderBy: { nombre: 'asc' },
    }),
  ])

  return (
    <>
      <Header title="Nueva orden de trabajo" subtitle="Servicio Técnico · Alta de OT" />
      <div className="flex-1 overflow-y-auto bg-[#F4F6F9] p-6">
        <NuevaOTForm
          clientes={JSON.parse(JSON.stringify(plain(clientes)))}
          equipos={JSON.parse(JSON.stringify(plain(equipos)))}
          tecnicos={JSON.parse(JSON.stringify(plain(tecnicos)))}
          clienteInicialId={clienteId ?? ''}
          equipoInicialId={equipoId ?? ''}
        />
      </div>
    </>
  )
}
