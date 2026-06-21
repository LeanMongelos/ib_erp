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

export function PresupuestoFacturacionPicker({ clienteId, className }: Props) {
  const router = useRouter()
  const [options, setOptions] = useState<ComboboxOption[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams({ facturables: '1' })
    if (clienteId) params.set('clienteId', clienteId)

    setLoading(true)
    fetch(`/api/presupuestos?${params}`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setOptions(mapPresupuestos(data)))
      .catch(() => setOptions([]))
      .finally(() => setLoading(false))
  }, [clienteId])

  return (
    <div className={`bg-[#FFF7ED] border border-[#FDBA74] rounded-[10px] px-4 py-3 ${className ?? ''}`}>
      <p className="text-[13px] font-bold text-[#9A3412] mb-2">Importar desde presupuesto</p>
      <p className="text-[12px] text-[#C2410C] mb-3">
        Elegí un presupuesto aprobado sin facturar para cargar cliente, ítems y condiciones.
      </p>
      <Combobox
        value=""
        onChange={(id) => {
          if (id) router.push(`/facturacion/nueva?presupuestoId=${id}`)
        }}
        options={options}
        placeholder={loading ? 'Cargando presupuestos…' : 'Buscar presupuesto aprobado…'}
        disabled={loading}
      />
    </div>
  )
}
