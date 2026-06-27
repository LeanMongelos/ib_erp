'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import { toast } from 'sonner'
import { Card } from '@/components/ui/card'
import { mensajeErrorDesconocido, mensajeErrorJson } from '@/lib/errores'

interface AlertaCompra {
  alertKey: string
  tipo: string
  diasAlerta: number
  diasTranscurridos: number
  ordenCompraId?: string
  facturaCompraId?: string
  chequeEmitidoId?: string
  numero: string
  proveedor: string
  mensaje: string
}

export function AlertasComprasBanner({
  onNavigateOc,
  onNavigateFacturas,
  onNavigatePagos,
}: {
  onNavigateOc?: () => void
  onNavigateFacturas?: () => void
  onNavigatePagos?: () => void
}) {
  const [alertas, setAlertas] = useState<AlertaCompra[]>([])
  const [dismissing, setDismissing] = useState<string | null>(null)

  async function cargar() {
    try {
      const res = await fetch('/api/compras/alertas', { credentials: 'include' })
      const data = await res.json()
      setAlertas(Array.isArray(data) ? data : [])
    } catch (e) {
      console.warn(mensajeErrorDesconocido(e, 'Alertas compras'))
      setAlertas([])
    }
  }

  useEffect(() => {
    cargar()
  }, [])

  async function dismiss(alertKey: string) {
    setDismissing(alertKey)
    try {
      const res = await fetch('/api/compras/alertas/dismiss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ alertKey }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(mensajeErrorJson(data, 'No se pudo descartar la alerta'))
      setAlertas((prev) => prev.filter((a) => a.alertKey !== alertKey))
    } catch (e) {
      toast.error(mensajeErrorDesconocido(e, 'No se pudo descartar la alerta'))
    } finally {
      setDismissing(null)
    }
  }

  if (alertas.length === 0) return null

  const criticas = alertas.filter((a) => a.diasAlerta >= 5 || a.tipo === 'CHEQUE_PROXIMO_DEBITO')

  return (
    <Card className="border-amber-200 bg-amber-50/80">
      <div className="flex items-start gap-3">
        <AlertTriangle size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <h3 className="text-[13px] font-bold text-amber-900">
            Alertas de compras ({alertas.length})
            {criticas.length > 0 && (
              <span className="ml-2 text-[11px] font-semibold text-red-700">{criticas.length} críticas</span>
            )}
          </h3>
          <ul className="mt-2 space-y-1.5 max-h-[140px] overflow-y-auto">
            {alertas.slice(0, 8).map((a) => (
              <li key={a.alertKey} className="text-[12px] text-amber-900/90 flex flex-wrap items-center gap-2">
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                  a.tipo === 'CHEQUE_PROXIMO_DEBITO'
                    ? 'bg-purple-200 text-purple-800'
                    : a.diasAlerta >= 7
                      ? 'bg-red-200 text-red-800'
                      : a.diasAlerta >= 5
                        ? 'bg-orange-200 text-orange-800'
                        : 'bg-amber-200 text-amber-800'
                }`}>
                  {a.tipo === 'CHEQUE_PROXIMO_DEBITO' ? `${a.diasAlerta}d` : `${a.diasTranscurridos}d`}
                </span>
                <span className="flex-1 min-w-0">{a.mensaje}</span>
                {a.ordenCompraId && a.tipo === 'FC_PENDIENTE_RECEPCION' && (
                  <button type="button" onClick={onNavigateOc} className="text-[11px] font-semibold text-[#E8650A] hover:underline">
                    Ver OC
                  </button>
                )}
                {a.facturaCompraId && a.tipo === 'FC_PENDIENTE_REGISTRO' && (
                  <button type="button" onClick={onNavigateFacturas} className="text-[11px] font-semibold text-[#E8650A] hover:underline">
                    Ver factura
                  </button>
                )}
                {a.chequeEmitidoId && a.tipo === 'CHEQUE_PROXIMO_DEBITO' && (
                  <button type="button" onClick={onNavigatePagos} className="text-[11px] font-semibold text-[#E8650A] hover:underline">
                    Ver cheques
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => dismiss(a.alertKey)}
                  disabled={dismissing === a.alertKey}
                  className="text-[#9aa1ab] hover:text-red-600 p-0.5"
                  title="Descartar alerta"
                >
                  <X size={14} />
                </button>
              </li>
            ))}
          </ul>
          {alertas.length > 8 && (
            <p className="text-[11px] text-amber-700 mt-1">+{alertas.length - 8} alertas más</p>
          )}
        </div>
      </div>
    </Card>
  )
}
