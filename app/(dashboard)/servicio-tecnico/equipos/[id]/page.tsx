import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Header } from '@/components/layout/Header'
import { HistoriaClinicaEquipo } from '@/components/servicio-tecnico/HistoriaClinicaEquipo'
import { requirePagePermission } from '@/lib/page-guard'
import { getEquipoHistoriaCompleta } from '@/lib/equipos/historia-clinica'
import { plain } from '@/lib/serialize'

export default async function EquipoHistoriaPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requirePagePermission('servicio.read')
  const { id } = await params
  const data = await getEquipoHistoriaCompleta(id)
  if (!data) notFound()

  const inicial = JSON.parse(JSON.stringify(plain(data)))

  return (
    <>
      <Header
        title="Historia clínica del equipo"
        subtitle={`${inicial.equipo.nombre} · ${inicial.equipo.numeroSerie ?? 'sin serie'}`}
      />
      <div className="flex-1 overflow-y-auto bg-[#F4F6F9] p-6">
        <div className="mb-4">
          <Link href="/servicio-tecnico" className="text-[12px] text-[#E8650A] font-semibold hover:underline">
            ← Volver a Servicio técnico
          </Link>
        </div>
        <HistoriaClinicaEquipo inicial={inicial} />
      </div>
    </>
  )
}
