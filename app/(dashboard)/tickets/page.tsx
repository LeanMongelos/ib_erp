import { redirect } from 'next/navigation'
import { getSessionUser } from '@/lib/api-auth'
import { tienePermiso } from '@/lib/rbac'

export default async function TicketsIndexPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')
  if (tienePermiso(user.permissions, 'tickets.read_all')) redirect('/tickets/admin')
  redirect('/tickets/mis')
}
