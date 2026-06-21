import { Header } from '@/components/layout/Header'
import { ClientesTable } from '@/components/crm/ClientesTable'
import { CrmSubNav } from '@/components/crm/CrmSubNav'
import { prisma } from '@/lib/prisma'

async function getClientes(search?: string, tipo?: string) {
  return prisma.cliente.findMany({
    where: {
      activo: true,
      ...(search && {
        OR: [
          { nombre:   { contains: search, mode: 'insensitive' } },
          { ciudad:   { contains: search, mode: 'insensitive' } },
          { contacto: { contains: search, mode: 'insensitive' } },
        ],
      }),
      ...(tipo && tipo !== 'TODOS' && { tipo: tipo as any }),
    },
    include: {
      _count: { select: { equipos: true, ots: true } },
      ots: {
        take: 1,
        orderBy: { creadoEn: 'desc' },
        select: { creadoEn: true },
      },
    },
    orderBy: { nombre: 'asc' },
  })
}

export default async function CRMPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tipo?: string }>
}) {
  const params = await searchParams
  const clientes = await getClientes(params.q, params.tipo)

  return (
    <>
      <Header
        title="CRM · Clientes"
        subtitle={`${clientes.length} clientes activos`}
      />
      <div className="flex-1 overflow-y-auto bg-[#F4F6F9] p-6">
        <CrmSubNav />
        <ClientesTable clientes={JSON.parse(JSON.stringify(clientes))} />
      </div>
    </>
  )
}
