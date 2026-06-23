'use client'

import Link from 'next/link'
import { Header } from '@/components/layout/Header'
import { Card } from '@/components/ui/card'
import { useCan } from '@/components/auth/useCan'
import {
  Users, Building2, FileText, Plug, Boxes, Bell, Shield, History, ChevronRight, Settings, Terminal,
} from 'lucide-react'

interface Item {
  href: string
  titulo: string
  desc: string
  icon: typeof Users
  permiso: string
  disponible: boolean
}

const ITEMS: Item[] = [
  { href: '/configuracion/usuarios', titulo: 'Usuarios y Roles', desc: 'Altas, roles y permisos del equipo', icon: Users, permiso: 'usuarios.read', disponible: true },
  { href: '/configuracion/contabilidad', titulo: 'Contabilidad y Fiscal', desc: 'IVA, IIBB, retenciones, plan de cuentas — Argentina', icon: Settings, permiso: 'config.manage_accounting', disponible: true },
  { href: '/configuracion/emisores', titulo: 'Emisores / AFIP', desc: 'CUITs, puntos de venta y certificados', icon: Building2, permiso: 'emisores.read', disponible: true },
  { href: '/configuracion/plantillas', titulo: 'Plantillas de impresión', desc: 'Factura, presupuesto y remito editables', icon: FileText, permiso: 'config.manage_billing_templates', disponible: true },
  { href: '/configuracion/integraciones', titulo: 'Integraciones', desc: 'WhatsApp, Instagram, Facebook, correo y n8n', icon: Plug, permiso: 'config.manage_integrations', disponible: true },
  { href: '/configuracion/catalogos', titulo: 'Catálogos / Maestros', desc: 'Categorías, depósitos, condiciones de pago', icon: Boxes, permiso: 'config.update', disponible: true },
  { href: '/configuracion/notificaciones', titulo: 'Notificaciones', desc: 'Plantillas y reglas de aviso', icon: Bell, permiso: 'config.update', disponible: true },
  { href: '/configuracion/seguridad', titulo: 'Seguridad', desc: 'Contraseñas, 2FA y sesiones', icon: Shield, permiso: 'config.update', disponible: true },
  { href: '/configuracion/auditoria', titulo: 'Auditoría', desc: 'Registro de cambios del sistema', icon: History, permiso: 'auditoria.read', disponible: true },
  { href: '/configuracion/logs', titulo: 'Logs del sistema', desc: 'Errores técnicos (15 días de retención)', icon: Terminal, permiso: 'logs.read', disponible: true },
]

export default function ConfiguracionPage() {
  return (
    <>
      <Header title="Configuración" subtitle="Ajustes del sistema" />
      <div className="flex-1 overflow-y-auto bg-[#F4F6F9] p-6">
        <div className="grid grid-cols-3 gap-4 max-w-5xl">
          {ITEMS.map((item) => (
            <ConfigCard key={item.href} item={item} />
          ))}
        </div>
      </div>
    </>
  )
}

function ConfigCard({ item }: { item: Item }) {
  const puede = useCan(item.permiso)
  if (!puede) return null

  const Icon = item.icon
  const contenido = (
    <Card className={`h-full transition-shadow ${item.disponible ? 'hover:shadow-md cursor-pointer' : 'opacity-70'}`}>
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-[10px] bg-[#FFF1E2] flex items-center justify-center flex-shrink-0">
          <Icon size={20} className="text-[#E8650A]" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <h3 className="text-[13.5px] font-bold text-[#16181d]">{item.titulo}</h3>
            {item.disponible ? (
              <ChevronRight size={16} className="text-gray-300" />
            ) : (
              <span className="text-[9.5px] font-bold text-[#9aa1ab] bg-gray-100 px-1.5 py-0.5 rounded">PRONTO</span>
            )}
          </div>
          <p className="text-[12px] text-[#7c828c] mt-1 leading-snug">{item.desc}</p>
        </div>
      </div>
    </Card>
  )

  if (!item.disponible) return contenido
  return <Link href={item.href}>{contenido}</Link>
}
