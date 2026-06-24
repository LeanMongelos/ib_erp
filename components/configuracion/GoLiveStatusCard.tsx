'use client'

import { useEffect, useState } from 'react'
import { Card, CardTitle } from '@/components/ui/card'
import { AlertTriangle, CheckCircle2, CircleAlert, Loader2, Server } from 'lucide-react'
import type { GoLiveItem, GoLiveStatus } from '@/lib/admin/go-live-status'

const NIVEL_ICON = {
  pass: CheckCircle2,
  warn: AlertTriangle,
  fail: CircleAlert,
} as const

const NIVEL_COLOR = {
  pass: 'text-[#15803D]',
  warn: 'text-[#E8650A]',
  fail: 'text-[#C2261B]',
} as const

function ItemRow({ item }: { item: GoLiveItem }) {
  const Icon = NIVEL_ICON[item.nivel]
  return (
    <li className="flex items-start gap-2 text-[12px] text-[#3a4150]">
      <Icon size={14} className={`mt-0.5 flex-shrink-0 ${NIVEL_COLOR[item.nivel]}`} />
      <span>{item.msg}</span>
    </li>
  )
}

export function GoLiveStatusCard() {
  const [data, setData] = useState<GoLiveStatus | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/admin/go-live-status')
        if (!res.ok) {
          if (res.status === 403) {
            if (!cancelled) setError(null)
            return
          }
          throw new Error('No se pudo cargar el estado go-live')
        }
        const json = (await res.json()) as GoLiveStatus
        if (!cancelled) setData(json)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Error desconocido')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) {
    return (
      <Card className="max-w-5xl mb-4">
        <div className="flex items-center gap-2 text-[12px] text-[#7c828c]">
          <Loader2 size={14} className="animate-spin" />
          Verificando estado go-live…
        </div>
      </Card>
    )
  }

  if (error || !data) return null

  const { resumen, listo, items, workerAfip } = data
  const destacados = items.filter((i) => i.nivel !== 'pass').slice(0, 6)
  const badgeClass = listo
    ? resumen.warn > 0
      ? 'bg-[#FFF1E2] text-[#E8650A]'
      : 'bg-green-50 text-[#15803D]'
    : 'bg-red-50 text-[#C2261B]'

  return (
    <Card className="max-w-5xl mb-4">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-[9px] bg-[#FFF1E2] flex items-center justify-center">
            <Server size={18} className="text-[#E8650A]" />
          </div>
          <div>
            <CardTitle className="text-[14px]">Estado go-live / AFIP</CardTitle>
            <p className="text-[11px] text-[#9aa1ab] mt-0.5">
              PASS {resumen.pass} · WARN {resumen.warn} · FAIL {resumen.fail}
              {workerAfip.detectado ? ` · Worker ${workerAfip.estado ?? '?'}` : ''}
            </p>
          </div>
        </div>
        <span className={`text-[10.5px] font-bold px-2 py-1 rounded-[6px] ${badgeClass}`}>
          {listo ? (resumen.warn > 0 ? 'Listo con advertencias' : 'Listo') : 'Revisar FAIL'}
        </span>
      </div>

      {destacados.length > 0 ? (
        <ul className="flex flex-col gap-1.5 pl-0.5">
          {destacados.map((item, i) => (
            <ItemRow key={`${item.seccion}-${i}`} item={item} />
          ))}
        </ul>
      ) : (
        <p className="text-[12px] text-[#15803D]">Todos los controles críticos en verde.</p>
      )}
    </Card>
  )
}
