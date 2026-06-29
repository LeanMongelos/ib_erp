'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { PackageSearch } from 'lucide-react'

interface FleteLink {
  id: string
  numero: string
  estado: string
}

export function FleteEnlaceDoc({
  remitoVentaId,
  ordenCompraId,
}: {
  remitoVentaId?: string
  ordenCompraId?: string
}) {
  const [flete, setFlete] = useState<FleteLink | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!remitoVentaId && !ordenCompraId) {
      setLoading(false)
      return
    }
    const params = new URLSearchParams()
    if (remitoVentaId) params.set('remitoVentaId', remitoVentaId)
    if (ordenCompraId) params.set('ordenCompraId', ordenCompraId)

    let cancel = false
    fetch(`/api/fletes?${params}`, { credentials: 'include' })
      .then(async (res) => {
        if (!res.ok) return []
        return res.json()
      })
      .then((rows: FleteLink[]) => {
        if (!cancel) setFlete(rows[0] ?? null)
      })
      .catch(() => {
        if (!cancel) setFlete(null)
      })
      .finally(() => {
        if (!cancel) setLoading(false)
      })

    return () => {
      cancel = true
    }
  }, [remitoVentaId, ordenCompraId])

  if (loading || !flete) return null

  return (
    <Link
      href={`/fletes?id=${flete.id}`}
      className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#E8650A] hover:underline"
    >
      <PackageSearch size={14} />
      Flete {flete.numero} ({flete.estado.replace('_', ' ').toLowerCase()})
    </Link>
  )
}
