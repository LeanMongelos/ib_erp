import Link from 'next/link'
import { Header } from '@/components/layout/Header'
import { TrackingMap } from '@/components/tracking/TrackingMap'
import { prisma } from '@/lib/prisma'
import { requirePagePermission } from '@/lib/page-guard'
import { plain } from '@/lib/serialize'
import { Button } from '@/components/ui/button'

export default async function MapaTrackingPage() {
  await requirePagePermission('tracking.read')

  const equipos = await prisma.equipo.findMany({
    where: { estado: { not: 'BAJA' } },
    select: {
      id: true,
      nombre: true,
      numeroSerie: true,
      cliente: { select: { nombre: true } },
    },
    orderBy: { nombre: 'asc' },
    take: 500,
  })

  return (
    <>
      <Header title="Mapa de equipos" subtitle="Parque instalado · tracking geográfico" />
      <div className="flex-1 overflow-y-auto bg-[#F4F6F9] p-6">
        <div className="flex gap-2 mb-4">
          <Link href="/servicio-tecnico">
            <Button variant="outline" size="sm">← Órdenes de trabajo</Button>
          </Link>
          <Link href="/servicio-tecnico/preventivo">
            <Button variant="outline" size="sm">Mantenimiento preventivo</Button>
          </Link>
        </div>
        <TrackingMap equiposIniciales={JSON.parse(JSON.stringify(plain(equipos)))} />
      </div>
    </>
  )
}
