import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { getAuthOptions } from '@/lib/auth'
import { DashboardShell } from '@/components/layout/DashboardShell'
import { SessionProvider } from './session-provider'
import { SecurityShell } from '@/components/security/SecurityShell'
import { getSessionUser } from '@/lib/api-auth'
import { tienePermiso } from '@/lib/rbac'
import { contarArticulosStockBajo } from '@/lib/inventario/alerta-stock-minimo'

export const dynamic = 'force-dynamic'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession(await getAuthOptions())

  if (!session) {
    redirect('/login')
  }

  let stockBajoCount: number | null = null
  const user = await getSessionUser()
  if (user && tienePermiso(user.permissions, 'compras.read')) {
    stockBajoCount = await contarArticulosStockBajo()
  }

  return (
    <SessionProvider session={session}>
      <DashboardShell stockBajoCount={stockBajoCount}>
        <SecurityShell>{children}</SecurityShell>
      </DashboardShell>
    </SessionProvider>
  )
}
