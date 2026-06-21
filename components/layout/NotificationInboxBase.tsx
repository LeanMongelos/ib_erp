'use client'

import { useCallback, useEffect, useRef, useState, type ElementType } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Bell,
  AlertTriangle,
  Wrench,
  Receipt,
  Package,
  ClipboardList,
  MessageCircle,
  Calendar,
  Settings,
  CheckCheck,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CategoriaAlerta, PrioridadAlerta } from '@/lib/notificaciones/generar-inbox-types'
import type { InboxScope } from '@/lib/notificaciones/inbox-scope'

interface AlertaItem {
  clave: string
  categoria: CategoriaAlerta
  prioridad: PrioridadAlerta
  titulo: string
  mensaje: string
  href: string
  fecha: string
  leida: boolean
}

const ICONO_CATEGORIA: Record<CategoriaAlerta, typeof Bell> = {
  cobranza: Receipt,
  ot: Wrench,
  preventivo: Calendar,
  componente: AlertTriangle,
  inventario: Package,
  presupuesto: ClipboardList,
  factura: Receipt,
  crm: MessageCircle,
}

const PRIORIDAD_COLOR: Record<PrioridadAlerta, string> = {
  urgente: 'bg-red-500',
  importante: 'bg-[#E8650A]',
  info: 'bg-blue-400',
}

interface NotificationInboxBaseProps {
  scope: InboxScope
  icon: ElementType
  ariaLabel: string
  panelTitle: string
  emptyTitle: string
  emptyHint: string
  badgeClassName?: string
  iconClassName?: string
  footerHref?: string
  footerLabel?: string
}

export function NotificationInboxBase({
  scope,
  icon: IconTrigger,
  ariaLabel,
  panelTitle,
  emptyTitle,
  emptyHint,
  badgeClassName = 'bg-[#E8650A]',
  iconClassName = 'text-[#5b626d]',
  footerHref,
  footerLabel,
}: NotificationInboxBaseProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<AlertaItem[]>([])
  const [noLeidas, setNoLeidas] = useState(0)
  const [loading, setLoading] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  const cargar = useCallback(async () => {
    try {
      const res = await fetch(`/api/notificaciones/inbox?scope=${scope}`, { credentials: 'include' })
      if (!res.ok) return
      const data = await res.json()
      setItems(data.items ?? [])
      setNoLeidas(data.noLeidas ?? 0)
    } catch {
      /* ignore */
    }
  }, [scope])

  useEffect(() => {
    cargar()
    const t = window.setInterval(cargar, 60_000)
    return () => window.clearInterval(t)
  }, [cargar])

  useEffect(() => {
    if (!open) return
    setLoading(true)
    cargar().finally(() => setLoading(false))
  }, [open, cargar])

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  async function marcarLeida(clave: string, href: string) {
    await fetch('/api/notificaciones/inbox', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ claves: [clave] }),
    })
    setOpen(false)
    router.push(href)
    cargar()
  }

  async function marcarTodas() {
    await fetch('/api/notificaciones/inbox', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ todas: true, scope }),
    })
    cargar()
  }

  const visibles = items.filter((i) => !i.leida).slice(0, 12)
  const recientesLeidas = items.filter((i) => i.leida).slice(0, 3)

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative p-1 rounded-lg hover:bg-[#f4f6f9] transition-colors"
        aria-label={`${ariaLabel}${noLeidas ? ` (${noLeidas} sin leer)` : ''}`}
      >
        <IconTrigger size={20} strokeWidth={1.8} className={iconClassName} />
        {noLeidas > 0 && (
          <span
            className={cn(
              'absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center text-[10px] font-bold text-white rounded-full border-2 border-white',
              badgeClassName,
            )}
          >
            {noLeidas > 9 ? '9+' : noLeidas}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-[360px] max-h-[min(480px,70vh)] bg-white border border-[#e9ebef] rounded-[12px] shadow-xl z-[80] flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-[#eef0f2] flex items-center justify-between shrink-0">
            <div>
              <p className="text-[13px] font-bold text-[#16181d]">{panelTitle}</p>
              <p className="text-[11px] text-[#9aa1ab]">
                {noLeidas > 0 ? `${noLeidas} pendiente(s)` : 'Todo al día'}
              </p>
            </div>
            {noLeidas > 0 && (
              <button
                type="button"
                onClick={marcarTodas}
                className="text-[11px] font-semibold text-[#E8650A] hover:underline flex items-center gap-1"
              >
                <CheckCheck size={14} /> Marcar todas
              </button>
            )}
          </div>

          <div className="overflow-y-auto flex-1">
            {loading && items.length === 0 && (
              <p className="px-4 py-8 text-center text-[12px] text-[#9aa1ab]">Cargando…</p>
            )}
            {!loading && visibles.length === 0 && (
              <div className="px-4 py-10 text-center">
                <IconTrigger size={28} className="mx-auto text-[#d1d5db] mb-2" />
                <p className="text-[12.5px] font-semibold text-[#6b7280]">{emptyTitle}</p>
                <p className="text-[11px] text-[#9aa1ab] mt-1">{emptyHint}</p>
              </div>
            )}
            {visibles.map((item) => {
              const Icon = ICONO_CATEGORIA[item.categoria] ?? Bell
              return (
                <button
                  key={item.clave}
                  type="button"
                  onClick={() => marcarLeida(item.clave, item.href)}
                  className="w-full text-left px-4 py-3 border-b border-[#f4f5f7] hover:bg-[#fafbfc] transition-colors flex gap-3"
                >
                  <span className="relative shrink-0 mt-0.5">
                    <span
                      className={cn(
                        'flex items-center justify-center w-8 h-8 rounded-lg',
                        scope === 'crm' ? 'bg-[#EFF6FF] text-[#0d6efd]' : 'bg-[#FFF7ED] text-[#E8650A]',
                      )}
                    >
                      <Icon size={15} />
                    </span>
                    <span className={cn('absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full', PRIORIDAD_COLOR[item.prioridad])} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[12.5px] font-bold text-[#1f242c] leading-snug">{item.titulo}</span>
                    <span className="block text-[11.5px] text-[#6b7280] mt-0.5 line-clamp-2">{item.mensaje}</span>
                  </span>
                </button>
              )
            })}
            {recientesLeidas.length > 0 && visibles.length > 0 && (
              <p className="px-4 pt-3 pb-1 text-[10px] font-bold uppercase text-[#9aa1ab]">Recientes</p>
            )}
            {recientesLeidas.map((item) => (
              <Link
                key={item.clave}
                href={item.href}
                onClick={() => setOpen(false)}
                className="block px-4 py-2.5 border-b border-[#f4f5f7] opacity-60 hover:opacity-100 hover:bg-[#fafbfc]"
              >
                <p className="text-[12px] font-semibold text-[#6b7280]">{item.titulo}</p>
              </Link>
            ))}
          </div>

          {footerHref && footerLabel && (
            <div className="px-4 py-2.5 border-t border-[#eef0f2] bg-[#fafbfc] shrink-0">
              <Link
                href={footerHref}
                onClick={() => setOpen(false)}
                className="text-[11.5px] font-semibold text-[#6b7280] hover:text-[#E8650A] flex items-center gap-1.5"
              >
                <Settings size={13} /> {footerLabel}
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
