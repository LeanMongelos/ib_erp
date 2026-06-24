'use client'

import Link from 'next/link'
import { BookOpen, ChevronRight } from 'lucide-react'
import { Card, CardTitle } from '@/components/ui/card'

const RUTAS_POR_ROL = [
  { rol: 'Admin / Gerente', rutas: ['/configuracion/usuarios', '/configuracion/emisores', '/configuracion/integraciones', '/configuracion/logs'] },
  { rol: 'Vendedor / Comercial', rutas: ['/crm', '/presupuestos', '/crm/embudo'] },
  { rol: 'Técnico ST', rutas: ['/servicio-tecnico', '/servicio-tecnico/mapa', '/inventario'] },
  { rol: 'Compras / Cobranzas', rutas: ['/proveedores', '/compras', '/cobranzas', '/inventario?bajo=1'] },
] as const

export function CapacitacionBanner() {
  return (
    <Card className="max-w-5xl mb-4 bg-[#F8FAFF] border-[#DDE4F5]">
      <div className="flex items-start gap-2.5 mb-3">
        <div className="w-9 h-9 rounded-[9px] bg-[#EEF2FF] flex items-center justify-center flex-shrink-0">
          <BookOpen size={18} className="text-[#4338CA]" />
        </div>
        <div>
          <CardTitle className="text-[14px]">Capacitación por rol</CardTitle>
          <p className="text-[11px] text-[#9aa1ab] mt-0.5">
            Guía completa en{' '}
            <code className="text-[10.5px] bg-white px-1 py-0.5 rounded border border-[#e4e7eb]">
              docs/CAPACITACION-OPERADORES.md
            </code>{' '}
            (repositorio / VPS)
          </p>
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {RUTAS_POR_ROL.map(({ rol, rutas }) => (
          <div key={rol} className="rounded-[8px] bg-white border border-[#e8ebf0] px-3 py-2">
            <p className="text-[11px] font-bold text-[#4338CA] mb-1">{rol}</p>
            <ul className="flex flex-col gap-0.5">
              {rutas.map((href) => (
                <li key={href}>
                  <Link
                    href={href}
                    className="inline-flex items-center gap-1 text-[11px] text-[#3a4150] hover:text-[#E8650A] hover:underline"
                  >
                    {href.replace('?bajo=1', ' (stock bajo)')}
                    <ChevronRight size={11} />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Card>
  )
}
