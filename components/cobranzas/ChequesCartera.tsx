'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { useCan } from '@/components/auth/useCan'
import { formatFecha, formatMonto } from '@/lib/utils'
import { mensajeErrorDesconocido, mensajeErrorRespuesta } from '@/lib/errores'

interface Cliente {
  id: string
  nombre: string
}

interface ChequeRow {
  id: string
  numero: string
  banco: string | null
  titular: string | null
  monto: number
  fechaRecepcion: string
  fechaVencimiento: string
  estado: string
  cliente: { id: string; nombre: string }
  pago: {
    imputaciones: Array<{ factura: { numero: string } }>
  }
}

const ESTADO_OPTS = [
  { value: 'EN_CARTERA', label: 'En cartera' },
  { value: 'DEPOSITADO', label: 'Depositados' },
  { value: 'RECHAZADO', label: 'Rechazados' },
  { value: 'TODOS', label: 'Todos' },
]

export function ChequesCartera({ clientes }: { clientes: Cliente[] }) {
  const puedeVer = useCan('cobranzas.cheques.read')
  const puedeGestionar = useCan('cobranzas.cheques.manage')
  const [cheques, setCheques] = useState<ChequeRow[]>([])
  const [estado, setEstado] = useState('EN_CARTERA')
  const [clienteId, setClienteId] = useState('')
  const [loading, setLoading] = useState(true)
  const [accionId, setAccionId] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    if (!puedeVer) return
    setLoading(true)
    try {
      const params = new URLSearchParams({ estado, limit: '50' })
      if (clienteId) params.set('clienteId', clienteId)
      const res = await fetch(`/api/cobranzas/cheques?${params}`, { credentials: 'include' })
      if (!res.ok) throw new Error(await mensajeErrorRespuesta(res, 'No se pudieron cargar los cheques'))
      const data = await res.json()
      setCheques(data.cheques ?? [])
    } catch (e) {
      toast.error(mensajeErrorDesconocido(e, 'Error al cargar cheques'))
      setCheques([])
    } finally {
      setLoading(false)
    }
  }, [puedeVer, estado, clienteId])

  useEffect(() => {
    cargar()
  }, [cargar])

  async function accion(id: string, accion: 'depositar' | 'rechazar') {
    if (!puedeGestionar) return
    const msg = accion === 'depositar' ? '¿Confirmás el depósito del cheque?' : '¿Marcar el cheque como rechazado? Se revertirá la imputación.'
    if (!window.confirm(msg)) return
    setAccionId(id)
    try {
      const res = await fetch(`/api/cobranzas/cheques/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion }),
      })
      if (!res.ok) throw new Error(await mensajeErrorRespuesta(res, 'No se pudo actualizar el cheque'))
      toast.success(accion === 'depositar' ? 'Cheque depositado' : 'Cheque rechazado')
      cargar()
    } catch (e) {
      toast.error(mensajeErrorDesconocido(e, 'Error al actualizar cheque'))
    } finally {
      setAccionId(null)
    }
  }

  if (!puedeVer) return null

  function facturasLabel(c: ChequeRow) {
    if (c.pago.imputaciones.length === 0) return '—'
    return c.pago.imputaciones.map((i) => i.factura.numero).join(', ')
  }

  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)

  return (
    <div className="flex flex-col gap-4">
      <Card className="p-4 flex flex-wrap gap-3 items-end">
        <Select
          label="Estado"
          value={estado}
          onChange={(e) => setEstado(e.target.value)}
          options={ESTADO_OPTS}
          className="min-w-[160px]"
        />
        <Select
          label="Cliente"
          value={clienteId}
          onChange={(e) => setClienteId(e.target.value)}
          options={[{ value: '', label: 'Todos' }, ...clientes.map((c) => ({ value: c.id, label: c.nombre }))]}
          className="min-w-[200px]"
        />
      </Card>

      <Card padding={false}>
        <div className="px-5 py-3 border-b border-[#eef0f2]">
          <h3 className="text-[13px] font-bold text-[#1f242c]">Cartera de cheques</h3>
          <p className="text-[11px] text-[#9aa1ab] mt-0.5">
            Los cheques en cartera no marcan la factura como pagada hasta confirmar el depósito.
          </p>
        </div>
        {loading ? (
          <p className="p-5 text-[12.5px] text-[#9aa1ab]">Cargando…</p>
        ) : cheques.length === 0 ? (
          <p className="p-5 text-[12.5px] text-[#9aa1ab]">Sin cheques en este filtro</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  {['Vencimiento', 'Cliente', 'N° cheque', 'Banco', 'Monto', 'Facturas', 'Estado', ...(puedeGestionar ? ['Acciones'] : [])].map((h) => (
                    <th key={h} className="px-5 py-2.5 text-[10px] font-bold text-[#8a909a] uppercase border-b text-left whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cheques.map((c, i) => {
                  const venc = new Date(c.fechaVencimiento)
                  venc.setHours(0, 0, 0, 0)
                  const aDepositar = c.estado === 'EN_CARTERA' && venc <= hoy
                  return (
                    <tr key={c.id} className={i % 2 === 0 ? 'bg-white' : 'bg-[#fafbfc]'}>
                      <td className={`px-5 py-3 text-[12.5px] border-b whitespace-nowrap ${aDepositar ? 'font-bold text-amber-700' : 'text-[#6b7280]'}`}>
                        {formatFecha(c.fechaVencimiento)}
                        {aDepositar && <span className="ml-1 text-[10px] uppercase">· depositar</span>}
                      </td>
                      <td className="px-5 py-3 text-[12.5px] font-semibold text-[#3a4150] border-b">{c.cliente.nombre}</td>
                      <td className="px-5 py-3 text-[12.5px] text-[#6b7280] border-b">{c.numero}</td>
                      <td className="px-5 py-3 text-[12.5px] text-[#6b7280] border-b">{c.banco ?? '—'}</td>
                      <td className="px-5 py-3 text-[12.5px] font-bold text-right text-green-700 border-b whitespace-nowrap">{formatMonto(c.monto)}</td>
                      <td className="px-5 py-3 text-[12.5px] text-[#E8650A] font-semibold border-b">{facturasLabel(c)}</td>
                      <td className="px-5 py-3 text-[12.5px] text-[#6b7280] border-b">{c.estado.replace('_', ' ')}</td>
                      {puedeGestionar && (
                        <td className="px-5 py-3 border-b whitespace-nowrap">
                          {c.estado === 'EN_CARTERA' && (
                            <div className="flex gap-2">
                              <Button size="sm" variant="primary" loading={accionId === c.id} onClick={() => accion(c.id, 'depositar')}>
                                Depositar
                              </Button>
                              <Button size="sm" variant="secondary" disabled={accionId === c.id} onClick={() => accion(c.id, 'rechazar')}>
                                Rechazar
                              </Button>
                            </div>
                          )}
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
