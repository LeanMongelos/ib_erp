import { redirect } from 'next/navigation'

export default async function CrmClienteRedirect({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  redirect(`/clientes/${id}`)
}
