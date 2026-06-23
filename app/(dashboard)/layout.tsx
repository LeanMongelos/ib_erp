import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { getAuthOptions } from '@/lib/auth'
import { DashboardShell } from '@/components/layout/DashboardShell'
import { SessionProvider } from './session-provider'
import { SecurityShell } from '@/components/security/SecurityShell'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession(await getAuthOptions())

  if (!session) {
    redirect('/login')
  }

  return (
    <SessionProvider session={session}>
      <DashboardShell>
        <SecurityShell>{children}</SecurityShell>
      </DashboardShell>
    </SessionProvider>
  )
}
