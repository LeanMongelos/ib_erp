'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ShoppingCart } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useCan } from '@/components/auth/useCan'
import { mensajeErrorDesconocido, mensajeErrorJson } from '@/lib/errores'

type OrigenOc = 'ot' | 'presupuesto'

const ENDPOINTS: Record<OrigenOc, { url: string; bodyKey: string }> = {
  ot: { url: '/api/ordenes-compra/desde-ot', bodyKey: 'otId' },
  presupuesto: { url: '/api/ordenes-compra/desde-presupuesto', bodyKey: 'presupuestoId' },
}

export function BotonGenerarOcDesde({
  origen,
  origenId,
  disabled,
  disabledTitle,
  size = 'sm',
  variant = 'secondary',
  className,
}: {
  origen: OrigenOc
  origenId: string
  disabled?: boolean
  disabledTitle?: string
  size?: 'sm' | 'md'
  variant?: 'primary' | 'secondary' | 'outline'
  className?: string
}) {
  const puede = useCan('compras.create')
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  if (!puede) return null

  async function generar() {
    setLoading(true)
    try {
      const cfg = ENDPOINTS[origen]
      const res = await fetch(cfg.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [cfg.bodyKey]: origenId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(mensajeErrorJson(data, 'No se pudo generar la orden de compra'))
      toast.success(`OC ${data.numero} creada — revisá proveedor y enviá a aprobación`)
      router.push(`/compras?tab=oc&oc=${data.id}`)
    } catch (e) {
      toast.error(mensajeErrorDesconocido(e, 'No se pudo generar la OC'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      onClick={generar}
      loading={loading}
      disabled={disabled}
      title={disabled ? disabledTitle : undefined}
    >
      <ShoppingCart size={14} />
      Generar OC
    </Button>
  )
}
