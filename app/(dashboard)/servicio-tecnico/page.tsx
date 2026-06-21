import Link from 'next/link'
import { Header } from '@/components/layout/Header'
import { OTsTable } from '@/components/servicio-tecnico/OTsTable'
import { prisma } from '@/lib/prisma'
import { actualizarOTsVencidas } from '@/lib/ots'
import { Button } from '@/components/ui/button'
import { Calendar, Map } from 'lucide-react'

async function getOTs() {
  await actualizarOTsVencidas()
  return prisma.ordenTrabajo.findMany({
    orderBy: { creadoEn: 'desc' },
    select: {
      id: true,
      numero: true,
      descripcion: true,
      tipo: true,
      estado: true,
      prioridad: true,
      slaHoras: true,
      fechaApertura: true,
      fechaCierre: true,
      slaVence: true,
      clienteId: true,
      cliente: { select: { nombre: true } },
      equipo: { select: { nombre: true } },
      tecnico: { select: { nombre: true } },
    },
  })
}

export default async function ServicioTecnicoPage() {
  const ots = await getOTs()
  const abiertas = ots.filter((o) => o.estado === 'ABIERTA' || o.estado === 'EN_PROCESO').length
  const vencidas = ots.filter((o) => o.estado === 'VENCIDA').length

  return (
    <>
      <Header
        title="Servicio Técnico · Órdenes de Trabajo"
        subtitle={`${abiertas} abiertas · ${vencidas} vencidas`}
      />
      <div className="flex-1 overflow-y-auto bg-[#F4F6F9] p-6">
        <div className="flex justify-end gap-2 mb-4">
          <Link href="/servicio-tecnico/mapa">
            <Button variant="outline" size="sm">
              <Map size={15} /> Mapa de equipos
            </Button>
          </Link>
          <Link href="/servicio-tecnico/preventivo">
            <Button variant="outline" size="sm">
              <Calendar size={15} /> Mantenimiento preventivo
            </Button>
          </Link>
        </div>
        <OTsTable ots={JSON.parse(JSON.stringify(ots))} />
      </div>
    </>
  )
}
