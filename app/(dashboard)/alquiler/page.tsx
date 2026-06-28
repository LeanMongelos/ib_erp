import { Header } from '@/components/layout/Header'
import { prisma } from '@/lib/prisma'
import { requirePagePermission } from '@/lib/page-guard'
import { getResumenAlquiler } from '@/lib/alquiler/resumen'
import { AlquilerDashboard } from '@/components/alquiler/AlquilerDashboard'
import { plain } from '@/lib/serialize'

export default async function AlquilerPage() {
  await requirePagePermission('alquiler.read')

  const [contratos, resumen] = await Promise.all([
    prisma.contratoAlquiler.findMany({
      include: {
        cliente: { select: { id: true, nombre: true, cuit: true } },
        _count: { select: { lineas: true, cuotas: true } },
      },
      orderBy: { creadoEn: 'desc' },
      take: 200,
    }),
    getResumenAlquiler(),
  ])

  return (
    <>
      <Header title="Alquiler de equipos" subtitle="Contratos, cuotas y parque en alquiler" />
      <div className="flex-1 overflow-y-auto bg-[#F4F6F9] p-6">
        <AlquilerDashboard
          contratos={JSON.parse(JSON.stringify(plain(contratos)))}
          resumen={JSON.parse(JSON.stringify(plain(resumen)))}
        />
      </div>
    </>
  )
}
