import Link from 'next/link'
import { Header } from '@/components/layout/Header'
import { prisma } from '@/lib/prisma'
import { requirePagePermission } from '@/lib/page-guard'
import { NuevoContratoAlquilerForm } from '@/components/alquiler/NuevoContratoAlquilerForm'
import { Button } from '@/components/ui/button'
import { plain } from '@/lib/serialize'

export default async function NuevoContratoAlquilerPage() {
  await requirePagePermission('alquiler.create')

  const clientes = await prisma.cliente.findMany({
    where: { activo: true },
    select: { id: true, nombre: true, cuit: true },
    orderBy: { nombre: 'asc' },
  })

  return (
    <>
      <Header title="Nuevo contrato de alquiler" subtitle="Cliente pagador, equipos y beneficiarios" />
      <div className="flex-1 overflow-y-auto bg-[#F4F6F9] p-6">
        <div className="mb-4">
          <Link href="/alquiler">
            <Button variant="outline" size="sm">← Volver al listado</Button>
          </Link>
        </div>
        <NuevoContratoAlquilerForm clientes={JSON.parse(JSON.stringify(plain(clientes)))} />
      </div>
    </>
  )
}
