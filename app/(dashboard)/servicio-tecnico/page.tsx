import Link from 'next/link'
import { Suspense } from 'react'
import { Header } from '@/components/layout/Header'
import { OTsTable } from '@/components/servicio-tecnico/OTsTable'
import { prisma } from '@/lib/prisma'
import { actualizarOTsVencidas } from '@/lib/ots'
import { Button } from '@/components/ui/button'
import { ExportOtsAbiertasButton } from '@/components/servicio-tecnico/ExportOtsAbiertasButton'
import { Calendar, Map } from 'lucide-react'
import { requirePagePermission } from '@/lib/page-guard'
import { tienePermiso } from '@/lib/rbac'
import { plain } from '@/lib/serialize'

async function getResumenOTs() {
  await actualizarOTsVencidas()
  const [abiertas, vencidas] = await Promise.all([
    prisma.ordenTrabajo.count({ where: { estado: { in: ['ABIERTA', 'EN_PROCESO'] } } }),
    prisma.ordenTrabajo.count({ where: { estado: 'VENCIDA' } }),
  ])
  return { abiertas, vencidas }
}

async function getTecnicos() {
  return prisma.usuario.findMany({
    where: { activo: true, rol: { in: ['TECNICO', 'ADMIN'] } },
    select: { id: true, nombre: true },
    orderBy: { nombre: 'asc' },
  })
}

export default async function ServicioTecnicoPage() {
  const user = await requirePagePermission('servicio.read')
  const puedeExportarOts =
    tienePermiso(user.permissions, 'servicio.read') ||
    tienePermiso(user.permissions, 'reportes.read_operativo')

  const [{ abiertas, vencidas }, tecnicos] = await Promise.all([
    getResumenOTs(),
    getTecnicos(),
  ])

  return (
    <>
      <Header
        title="Servicio Técnico · Órdenes de Trabajo"
        subtitle={`${abiertas} abiertas · ${vencidas} vencidas`}
      />
      <div className="flex-1 overflow-y-auto bg-[#F4F6F9] p-6">
        <div className="flex justify-end gap-2 mb-4 flex-wrap">
          {puedeExportarOts && <ExportOtsAbiertasButton />}
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
        <Suspense fallback={<p className="text-[12.5px] text-[#9aa1ab]">Cargando…</p>}>
          <OTsTable tecnicos={JSON.parse(JSON.stringify(plain(tecnicos)))} />
        </Suspense>
      </div>
    </>
  )
}
