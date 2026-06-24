'use client'

import { useEffect, useState } from 'react'
import { Card, CardTitle } from '@/components/ui/card'
import { AlertTriangle, CheckCircle2, CircleAlert, ClipboardList, Loader2 } from 'lucide-react'
import type { GoLiveItem, GoLiveStatus } from '@/lib/admin/go-live-status'

const ONBOARDING_CODIGOS = [
  'onboarding_admin',
  'onboarding_emisor',
  'onboarding_smtp',
  'onboarding_cron',
] as const

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

export function OnboardingChecklist() {
  const [items, setItems] = useState<GoLiveItem[] | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/admin/go-live-status')
        if (!res.ok) {
          if (res.status === 403) return
          throw new Error('No se pudo cargar el checklist')
        }
        const json = (await res.json()) as GoLiveStatus
        const onboarding = json.items.filter(
          (i) => i.seccion === 'onboarding' && ONBOARDING_CODIGOS.includes(i.codigo as typeof ONBOARDING_CODIGOS[number]),
        )
        if (!cancelled) setItems(onboarding)
      } catch {
        if (!cancelled) setItems([])
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
          Cargando checklist de onboarding…
        </div>
      </Card>
    )
  }

  if (!items || items.length === 0) return null

  const completos = items.filter((i) => i.nivel === 'pass').length
  const listo = items.every((i) => i.nivel !== 'fail')

  return (
    <Card className="max-w-5xl mb-4">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-[9px] bg-[#EEF2FF] flex items-center justify-center">
            <ClipboardList size={18} className="text-[#4338CA]" />
          </div>
          <div>
            <CardTitle className="text-[14px]">Checklist onboarding empresa</CardTitle>
            <p className="text-[11px] text-[#9aa1ab] mt-0.5">
              {completos}/{items.length} pasos completos — setup inicial del ERP
            </p>
          </div>
        </div>
        <span
          className={`text-[10.5px] font-bold px-2 py-1 rounded-[6px] ${
            listo ? 'bg-green-50 text-[#15803D]' : 'bg-red-50 text-[#C2261B]'
          }`}
        >
          {listo ? 'Setup OK' : 'Pendiente'}
        </span>
      </div>
      <ul className="flex flex-col gap-1.5 pl-0.5">
        {items.map((item) => (
          <ItemRow key={item.codigo ?? item.msg} item={item} />
        ))}
      </ul>
    </Card>
  )
}
