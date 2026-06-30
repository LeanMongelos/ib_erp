'use client'

import { useSession, signOut } from 'next-auth/react'
import Link from 'next/link'
import { ChevronDown, LogOut, PanelLeftClose, PanelLeftOpen, User } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { ROLE_DEFS } from '@/lib/rbac'
import { GlobalSearchTrigger } from '@/components/layout/GlobalSearch'
import { NotificationBell } from '@/components/layout/NotificationBell'
import { AdminAlertasBell } from '@/components/layout/AdminAlertasBell'
import { CrmInboxBell } from '@/components/layout/CrmInboxBell'
import { TicketsBell } from '@/components/layout/TicketsBell'
import { useEmbudoSidebar } from '@/components/layout/SidebarContext'
import { UserAvatar } from '@/components/perfil/UserAvatar'

interface HeaderProps {
  title: string
  subtitle?: string
}

export function Header({ title, subtitle }: HeaderProps) {
  const { data: session } = useSession()
  const [menuOpen, setMenuOpen] = useState(false)
  const { isEmbudo, sidebarHidden, toggleSidebar } = useEmbudoSidebar()

  const userName = session?.user?.name ?? 'Usuario'
  const avatarUrl = session?.user?.avatarUrl ?? session?.user?.image ?? null
  const rolClave = session?.user?.role
  const rolLabel = (rolClave && ROLE_DEFS[rolClave]) || rolClave || 'Usuario'

  return (
    <header className="h-[62px] bg-white border-b border-[#edeff2] flex items-center justify-between px-6 flex-none">
      {/* Título */}
      <div className="flex items-center gap-3 min-w-0">
        {isEmbudo && (
          <button
            type="button"
            onClick={toggleSidebar}
            className={cn(
              'flex items-center gap-1.5 flex-shrink-0 rounded-lg border px-2.5 py-1.5 text-[12px] font-semibold transition-colors',
              sidebarHidden
                ? 'border-[#E8650A] bg-[#FFF1E2] text-[#E8650A] hover:bg-[#FFE8CC]'
                : 'border-[#e4e7eb] bg-white text-[#5b626d] hover:bg-gray-50',
            )}
            title={sidebarHidden ? 'Mostrar menú lateral' : 'Ocultar menú lateral'}
          >
            {sidebarHidden ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
            <span className="hidden sm:inline">{sidebarHidden ? 'Mostrar menú' : 'Ocultar menú'}</span>
          </button>
        )}
        <div className="min-w-0">
          <h1 className="text-[15.5px] font-bold text-[#16181d] truncate">{title}</h1>
          {subtitle && (
            <p className="text-[11.5px] text-[#9aa1ab] font-medium truncate">{subtitle}</p>
          )}
        </div>
      </div>

      {/* Controles */}
      <div className="flex items-center gap-4">
        <GlobalSearchTrigger />

        <div className="flex items-center gap-1">
          <TicketsBell />
          <AdminAlertasBell />
          <CrmInboxBell />
          <NotificationBell />
        </div>

        <div className="w-px h-[26px] bg-[#e9ebef]" />

        {/* Avatar + menú usuario */}
        <div className="relative">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex items-center gap-2.5 hover:bg-gray-50 rounded-lg px-2 py-1 transition-colors"
          >
            <UserAvatar name={userName} avatarUrl={avatarUrl} size={34} />
            <div className="leading-tight text-left hidden md:block">
              <p className="text-[12.5px] font-bold text-[#1f242c]">{userName}</p>
              <p className="text-[10.5px] text-[#9aa1ab]">{rolLabel}</p>
            </div>
            <ChevronDown size={14} className={cn('text-gray-400 transition-transform', menuOpen && 'rotate-180')} />
          </button>

          {/* Dropdown */}
          {menuOpen && (
            <div className="absolute right-0 top-full mt-1 w-44 bg-white border border-[#e9ebef] rounded-[10px] shadow-lg py-1 z-50">
              <Link
                href="/perfil"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2.5 w-full px-4 py-2.5 text-[12.5px] text-[#3a4150] font-medium hover:bg-gray-50 transition-colors"
              >
                <User size={15} />
                Mi perfil
              </Link>
              <div className="h-px bg-[#f0f1f4] my-1" />
              <button
                onClick={() => signOut({ callbackUrl: '/login' })}
                className="flex items-center gap-2.5 w-full px-4 py-2.5 text-[12.5px] text-red-600 font-medium hover:bg-red-50 transition-colors"
              >
                <LogOut size={15} />
                Cerrar sesión
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
