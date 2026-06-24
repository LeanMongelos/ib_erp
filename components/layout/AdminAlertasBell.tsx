'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Bell, AlertTriangle } from 'lucide-react'
import { useCan } from '@/components/auth/useCan'
import { etiquetaOrigenLog } from '@/lib/config/config-labels'
import { formatFechaHora } from '@/lib/utils'

interface AlertaItem {
  id: string
  origen: string
  mensaje: string
  fecha: string
}

export function AdminAlertasBell() {
  const puedeVer = useCan('config.read')
  const [open, setOpen] = useState(false)
  const [total, setTotal] = useState(0)
  const [alertas, setAlertas] = useState<AlertaItem[]>([])
  const [loading, setLoading] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!puedeVer) return
    let cancelled = false
    setLoading(true)
    fetch('/api/admin/alertas-recientes?limit=20', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data) return
        setTotal(data.total ?? 0)
        setAlertas(data.alertas ?? [])
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [puedeVer])

  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  if (!puedeVer) return null

  const logsHref = '/configuracion/logs?nivel=WARN'

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative p-1 rounded-lg hover:bg-[#f4f6f9] transition-colors"
        aria-label={`Alertas del sistema${total ? ` (${total} advertencias)` : ''}`}
      >
        <Bell size={20} strokeWidth={1.8} className={total > 0 ? 'text-amber-600' : 'text-[#5b626d]'} />
        {total > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center text-[10px] font-bold text-white rounded-full border-2 border-white bg-amber-500">
            {total > 9 ? '9+' : total}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-[380px] max-h-[min(480px,70vh)] bg-white border border-[#e9ebef] rounded-[12px] shadow-xl z-[80] flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-[#eef0f2] shrink-0">
            <p className="text-[13px] font-bold text-[#16181d]">Alertas del sistema</p>
            <p className="text-[11px] text-[#9aa1ab]">
              WARN últimos 7 días · afip-notify, integridad, cobranza
            </p>
          </div>

          <div className="overflow-y-auto flex-1">
            {loading && alertas.length === 0 && (
              <p className="px-4 py-8 text-center text-[12px] text-[#9aa1ab]">Cargando…</p>
            )}
            {!loading && alertas.length === 0 && (
              <div className="px-4 py-10 text-center">
                <Bell size={28} className="mx-auto text-[#d1d5db] mb-2" />
                <p className="text-[12.5px] font-semibold text-[#6b7280]">Sin advertencias recientes</p>
                <p className="text-[11px] text-[#9aa1ab] mt-1">AFIP, integridad y cobranzas al día.</p>
              </div>
            )}
            {alertas.map((a) => (
              <Link
                key={a.id}
                href={`${logsHref}&origen=${encodeURIComponent(a.origen)}`}
                onClick={() => setOpen(false)}
                className="block px-4 py-3 border-b border-[#f4f5f7] hover:bg-[#fafbfc] transition-colors"
              >
                <div className="flex gap-3">
                  <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-amber-50 text-amber-600 shrink-0 mt-0.5">
                    <AlertTriangle size={15} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="text-[10px] font-bold uppercase text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
                        {etiquetaOrigenLog(a.origen)}
                      </span>
                      <span className="text-[10px] text-[#9aa1ab]">{formatFechaHora(a.fecha)}</span>
                    </span>
                    <span className="block text-[12px] text-[#3a4150] mt-1 line-clamp-2">{a.mensaje}</span>
                  </span>
                </div>
              </Link>
            ))}
          </div>

          <div className="px-4 py-2.5 border-t border-[#eef0f2] bg-[#fafbfc] shrink-0">
            <Link
              href={logsHref}
              onClick={() => setOpen(false)}
              className="text-[11.5px] font-semibold text-[#6b7280] hover:text-[#E8650A]"
            >
              Ver todos en Configuración → Logs
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
