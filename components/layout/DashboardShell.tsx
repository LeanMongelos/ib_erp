'use client'

import { SidebarProvider } from '@/components/layout/SidebarContext'
import { Sidebar } from '@/components/layout/Sidebar'
import { EmbudoSidebarRail } from '@/components/layout/EmbudoSidebarRail'

export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <div className="flex h-screen overflow-hidden bg-[#F4F6F9]">
        <Sidebar />
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {children}
        </main>
        <EmbudoSidebarRail />
      </div>
    </SidebarProvider>
  )
}
