'use client'

import { useEffect, useState } from 'react'
import type { AlicuotaOption } from '@/components/fiscal/AlicuotaSelector'

export function useAlicuotasIva() {
  const [alicuotas, setAlicuotas] = useState<AlicuotaOption[]>([])
  const [defaultPct, setDefaultPct] = useState(21)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/alicuotas-iva')
      .then((r) => r.json())
      .then((list: AlicuotaOption[]) => {
        setAlicuotas(list)
        const pred = list.find((a) => (a as AlicuotaOption & { esPredeterminada?: boolean }).esPredeterminada)
          ?? list.find((a) => a.porcentaje === 21)
          ?? list[0]
        if (pred) setDefaultPct(pred.porcentaje)
      })
      .catch(() => setAlicuotas([]))
      .finally(() => setLoading(false))
  }, [])

  return { alicuotas, defaultPct, loading }
}
