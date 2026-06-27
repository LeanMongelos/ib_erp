'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Inbox, Kanban } from 'lucide-react'

const TABS = [
  { href: '/crm/embudo', label: 'Embudo', icon: Kanban },
  { href: '/crm/inbox', label: 'Bandeja', icon: Inbox },
]

export function CrmSubNav() {
  const pathname = usePathname()

  return (
    <div className="flex gap-1 mb-2 p-1 bg-white border border-[#edeef1] rounded-[10px] w-fit flex-shrink-0">
      {TABS.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`)
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
