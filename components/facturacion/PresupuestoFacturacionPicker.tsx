'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Combobox, type ComboboxOption } from '@/components/ui/combobox'
import { formatMontoMoneda } from '@/lib/moneda'

interface PresupuestoFacturable {
  id: string
  numero: string
  total: number
  moneda?: string
  clienteId: string
  cliente: { nombre: string }
  ordenVenta?: {
    remitos: { id: string; numero: string }[]
  } | null
}

interface Props {
  clienteId?: string
  className?: string
}

function mapPresupuestos(data: unknown): ComboboxOption[] {
  if (!Array.isArray(data)) return []
  return data.map((p: PresupuestoFacturable) => ({
    value: p.id,
    label: `${p.numero} — ${p.cliente.nombre}`,
    hint: formatMontoMoneda(p.total, p.moneda ?? 'ARS'),
  }))
}

function urlFacturacionDesdePresupuesto(p: PresupuestoFacturable): string {
  const remitoEmitido = p.ordenVenta?.remitos?.[0]
  if (remitoEmitido) {
    return `/facturacion/nueva?remitoId=${remitoEmitido.id}&presupuestoId=${p.id}`
  }
  return `/facturacion/nueva?presupuestoId=${p.id}`
}

export function PresupuestoFacturacionPicker({ clienteId, className }: Props) {
  const router = useRouter()
  const [options, setOptions] = useState<ComboboxOption[]>([])
  const [presupuestos, setPresupuestos] = useState<PresupuestoFacturable[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams({ facturables: '1' })
    if (clienteId) params.set('clienteId', clienteId)

    setLoading(true)
    fetch(`/api/presupuestos?${params}`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        setPresupuestos(Array.isArray(data) ? data : [])
        setOptions(mapPresupuestos(data))
      })
      .catch(() => {
        setPresupuestos([])
        setOptions([])
      })
      .finally(() => setLoading(false))
  }, [clienteId])

  return (
    <div className={`bg-[#FFF7ED] border border-[#FDBA74] rounded-[10px] px-4 py-3 ${className ?? ''}`}>
      <p className="text-[13px] font-bold text-[#9A3412] mb-2">Importar desde presupuesto</p>
      <p className="text-[12px] text-[#C2410C] mb-3">
        Elegí un presupuesto aprobado sin facturar. Si tiene remito emitido, se cargará desde el remito.
      </p>
      <Combobox
        value=""
        onChange={(id) => {
          if (!id) return
          const pres = presupuestos.find((p) => p.id === id)
          router.push(pres ? urlFacturacionDesdePresupuesto(pres) : `/facturacion/nueva?presupuestoId=${id}`)
        }}
        options={options}
        placeholder={loading ? 'Cargando presupuestos…' : 'Buscar presupuesto aprobado…'}
        disabled={loading}
      />
    </div>
  )
}
