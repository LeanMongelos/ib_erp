'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useEmbudoSidebar } from '@/components/layout/SidebarContext'
import { usePermisos } from '@/components/auth/useCan'
import { puedeVerNavItem } from '@/lib/page-permissions'
import {
  LayoutDashboard,
  Users,
  Building2,
  Truck,
  Wrench,
  Package,
  FileText,
  Zap,
  Settings,
  ClipboardList,
  Receipt,
  ShoppingCart,
  Banknote,
  Wallet,
  Calendar,
  BarChart3,
  Repeat,
  PackageSearch,
  LifeBuoy,
} from 'lucide-react'

const navItems = [
  { label: 'Dashboard',         href: '/dashboard',                   icon: LayoutDashboard },
  { label: 'CRM',               href: '/crm',                         icon: Users           },
  { label: 'Reportes',          href: '/reportes',                    icon: BarChart3 },
  { label: 'Servicio Técnico',  href: '/servicio-tecnico',            icon: Wrench          },
  { label: 'Preventivo',        href: '/servicio-tecnico/preventivo', icon: Calendar        },
  { label: 'ERP / Inventario',  href: '/inventario',                  icon: Package         },
  { label: 'Presupuestos',      href: '/presupuestos',                icon: ClipboardList   },
  { label: 'Facturación',       href: '/facturacion',                 icon: Receipt         },
  { label: 'Cobranzas',         href: '/cobranzas',                   icon: Banknote        },
  { label: 'Tesorería',         href: '/tesoreria',                   icon: Wallet          },
  { label: 'Compras',           href: '/compras',                     icon: ShoppingCart    },
  { label: 'Fletes',            href: '/fletes',                      icon: PackageSearch   },
  { label: 'Alquiler',          href: '/alquiler',                    icon: Repeat          },
  { label: 'Solicitudes',       href: '/tickets',                     icon: LifeBuoy        },
  { label: 'Clientes',          href: '/clientes',                    icon: Building2       },
  { label: 'Proveedores',       href: '/proveedores',                 icon: Truck           },
  { label: 'Automatizaciones',  href: '/automatizaciones',            icon: Zap             },
  { label: 'Configuración',     href: '/configuracion',               icon: Settings        },
]

export function Sidebar({ stockBajoCount = null }: { stockBajoCount?: number | null }) {
  const pathname = usePathname()
  const { sidebarHidden } = useEmbudoSidebar()
  const permisos = usePermisos()

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + '/')
  }

  const itemsVisibles = navItems.filter((item) => puedeVerNavItem(item.href, permisos))

  return (
    <aside
      className={cn(
        'h-full min-h-0 bg-[#0A0A0A] flex flex-col font-sans border-r border-[#1c1c1c]',
        'transition-[width,min-width] duration-200 ease-in-out overflow-hidden flex-shrink-0',
        sidebarHidden ? 'w-0 min-w-0 border-r-0' : 'w-[248px] min-w-[248px]',
      )}
      aria-label="Menú principal"
      aria-hidden={sidebarHidden}
    >
      {/* Logo */}
      <div className="flex shrink-0 items-center gap-[11px] px-[18px] pt-5 pb-[18px]">
        <Image
          src="/logo.png"
          alt="IB"
          width={44}
          height={44}
          className="object-contain flex-shrink-0"
        />
        <div className="leading-tight">
          <p className="text-white text-[12.5px] font-bold tracking-[0.4px]">INGENIERÍA BIOMÉDICA</p>
          <p className="text-[#6b7280] text-[10.5px] font-medium tracking-[0.3px]">Sistema de Gestión</p>
        </div>
      </div>

      <div className="h-px shrink-0 bg-[#1c1c1c] mx-4 mb-2.5" />

      {/* Navegación — scroll cuando hay muchos módulos */}
      <nav
        className="flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden overscroll-contain pb-2 [scrollbar-width:thin] [scrollbar-color:#2a2a2a_#0A0A0A]"
        aria-label="Secciones del sistema"
      >
        <p className="px-[18px] pb-2 text-[#4b5563] text-[10px] font-bold tracking-[1.2px] uppercase">
          Principal
        </p>

        {itemsVisibles.map(({ label, href, icon: Icon }) => {
          const active = isActive(href)
          const badge =
            stockBajoCount != null && stockBajoCount > 0 && (href === '/compras' || href === '/inventario')
              ? stockBajoCount
              : null
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-[13px] px-[18px] py-2.5 mx-3 rounded-[9px] my-px',
                'text-[13.5px] font-semibold transition-all duration-150',
                'border-l-[3px]',
                active
                  ? 'bg-[rgba(232,101,10,0.13)] text-[#F0820A] border-[#E8650A]'
                  : 'text-[#9aa3af] border-transparent hover:text-[#d0d5dc] hover:bg-[#141414]',
              )}
              aria-current={active ? 'page' : undefined}
            >
              <Icon size={19} strokeWidth={1.8} />
              <span className="flex-1">{label}</span>
              {badge != null && (
                <span
                  className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[#E8650A] text-white min-w-[1.25rem] text-center"
                  title={`${badge} artículo(s) bajo mínimo`}
                >
                  {badge}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Footer LM Digital Solutions */}
      <a
        href="https://lmdigitalsolutions.com.ar/"
        target="_blank"
        rel="noopener noreferrer"
        className="m-3 shrink-0 p-3.5 bg-[#141414] rounded-[10px] border border-[#1f1f1f] flex items-center gap-2.5 hover:bg-[#1a1a1a] hover:border-[#2a2a2a] transition-colors"
      >
        <Image
          src="/1.png"
          alt="LM Digital Solutions"
          width={60}
          height={34}
          className="object-contain flex-shrink-0"
        />
        <div className="leading-tight">
          <p className="text-[#cbd5e1] text-[10.5px] font-semibold">Desarrollado por</p>
          <p className="text-[#7dd3fc] text-[11px] font-bold tracking-[0.3px]">LM Digital Solutions</p>
        </div>
      </a>
    </aside>
  )
}
