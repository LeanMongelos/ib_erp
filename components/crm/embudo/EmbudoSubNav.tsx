'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Kanban, History } from 'lucide-react'

const TABS = [
  { href: '/crm/embudo', label: 'Kanban', icon: Kanban, exact: true },
  { href: '/crm/embudo/seguimiento', label: 'Seguimiento', icon: History, exact: false },
]

export function EmbudoSubNav() {
  const pathname = usePathname()

  return (
    <div className="flex gap-1 mb-2 p-1 bg-white border border-[#edeef1] rounded-[10px] w-fit flex-shrink-0">
      {TABS.map(({ href, label, icon: Icon, exact }) => {
        const active = exact ? pathname === href : pathname.startsWith(href)
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-[8px] text-[12.5px] font-semibold transition-colors',
              active ? 'bg-[#FFF1E2] text-[#E8650A]' : 'text-[#6b7280] hover:text-[#3a4150]',
            )}
          >
            <Icon size={16} />
            {label}
          </Link>
        )
      })}
    </div>
  )
}
