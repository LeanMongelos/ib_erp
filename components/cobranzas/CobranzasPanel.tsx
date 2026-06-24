'use client'

import { useState } from 'react'
import { VencimientosProximos } from '@/components/cobranzas/VencimientosProximos'
import { PagosRegistradosList } from '@/components/cobranzas/PagosRegistradosList'
import { ChequesCartera } from '@/components/cobranzas/ChequesCartera'
import { useCan } from '@/components/auth/useCan'

interface Cliente {
  id: string
  nombre: string
}

const BASE_TABS = ['Cronograma', 'Pagos registrados'] as const
type BaseTab = typeof BASE_TABS[number]

export function CobranzasPanel({ clientes }: { clientes: Cliente[] }) {
  const puedeCheques = useCan('cobranzas.cheques.read')
  const tabs = puedeCheques ? ([...BASE_TABS, 'Cheques en cartera'] as const) : BASE_TABS
  type TabId = typeof tabs[number]
  const [tab, setTab] = useState<TabId>('Cronograma')

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-0.5 border-b border-[#eef0f2] max-w-3xl">
        {tabs.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-[12.5px] font-semibold transition-colors whitespace-nowrap ${
              tab === t
                ? 'text-[#E8650A] border-b-[2.5px] border-[#E8650A] -mb-px'
                : 'text-[#9aa1ab] hover:text-[#3a4150]'
            }`}
          >
            {t}
          </button>
        ))}
      </div>
      {tab === 'Cronograma' && <VencimientosProximos />}
      {tab === 'Pagos registrados' && <PagosRegistradosList clientes={clientes} />}
      {tab === 'Cheques en cartera' && puedeCheques && <ChequesCartera clientes={clientes} />}
    </div>
  )
}
