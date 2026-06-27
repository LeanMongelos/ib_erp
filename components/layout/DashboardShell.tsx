'use client'

import { SidebarProvider } from '@/components/layout/SidebarContext'
import { Sidebar } from '@/components/layout/Sidebar'
import { EmbudoSidebarRail } from '@/components/layout/EmbudoSidebarRail'
import { KeyboardNavProvider } from '@/components/layout/KeyboardNavProvider'

export function DashboardShell({
  children,
  stockBajoCount = null,
}: {
  children: React.ReactNode
  stockBajoCount?: number | null
}) {
  return (
    <KeyboardNavProvider>
      <SidebarProvider>
        <div className="flex h-screen overflow-hidden bg-[#F4F6F9]">
          <Sidebar stockBajoCount={stockBajoCount} />
          <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
            {children}
          </main>
          <EmbudoSidebarRail />
        </div>
      </SidebarProvider>
    </KeyboardNavProvider>
  )
}
