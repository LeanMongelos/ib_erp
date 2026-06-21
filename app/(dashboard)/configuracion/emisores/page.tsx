import { Header } from '@/components/layout/Header'
import { prisma } from '@/lib/prisma'
import { requirePagePermission } from '@/lib/page-guard'
import { EmisoresManager } from '@/components/configuracion/EmisoresManager'

export default async function EmisoresPage() {
  await requirePagePermission('emisores.read')

  const emisores = await prisma.emisor.findMany({
    where: { activo: true },
    orderBy: [{ predeterminado: 'desc' }, { razonSocial: 'asc' }],
  })

  return (
    <>
      <Header title="Emisores / AFIP" subtitle={`${emisores.length} emisores`} />
      <div className="flex-1 overflow-y-auto bg-[#F4F6F9] p-6">
        <EmisoresManager emisores={JSON.parse(JSON.stringify(emisores))} />
      </div>
    </>
  )
}
