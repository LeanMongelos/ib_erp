import Link from 'next/link'
import { Header } from '@/components/layout/Header'
import { PreventivoManager } from '@/components/servicio-tecnico/PreventivoManager'
import { prisma } from '@/lib/prisma'
import { requirePagePermission } from '@/lib/page-guard'
import { plain } from '@/lib/serialize'

export default async function PreventivoPage() {
  await requirePagePermission('preventivo.read')

  const [equipos, tecnicos] = await Promise.all([
    prisma.equipo.findMany({
      where: { estado: 'ACTIVO' },
      select: { id: true, nombre: true, cliente: { select: { nombre: true } } },
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
      <Header title="Mantenimiento preventivo" subtitle="Calendario y planes por equipo" />
      <div className="flex-1 overflow-y-auto bg-[#F4F6F9] p-6">
        <div className="flex gap-2 mb-4">
          <Link href="/servicio-tecnico" className="text-[12px] font-semibold text-[#6b7280] hover:text-[#E8650A]">
            ← Órdenes de trabajo
          </Link>
        </div>
        <PreventivoManager
          equipos={JSON.parse(JSON.stringify(plain(equipos)))}
          tecnicos={JSON.parse(JSON.stringify(plain(tecnicos)))}
        />
      </div>
    </>
  )
}
