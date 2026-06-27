'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { mensajeErrorDesconocido, mensajeErrorRespuesta } from '@/lib/errores'
import { trazabilidadActivaClient } from '@/lib/inventario/trazabilidad-client'
import type { ItemInventario } from '@/components/inventario/InventarioManager'
import type { UnidadInventarioRow } from '@/components/inventario/InventarioUnidadesPanel'

interface DepositoOption {
  id: string
  nombre: string
}

interface Props {
  item: ItemInventario
  depositos: DepositoOption[]
  onClose: () => void
  onSuccess: () => void
}

export function TransferirStockModal({ item, depositos, onClose, onSuccess }: Props) {
  const serializado = trazabilidadActivaClient(item.modoTrazabilidad ?? 'NINGUNA')

  const [origen, setOrigen] = useState(depositos[0]?.id ?? '')
  const [destino, setDestino] = useState(depositos[1]?.id ?? '')
  const [cantidad, setCantidad] = useState('1')
  const [ubicacionDestino, setUbicacionDestino] = useState('')
  const [motivo, setMotivo] = useState('')
  const [loading, setLoading] = useState(false)
  const [stockOrigen, setStockOrigen] = useState<number | null>(null)
  const [unidades, setUnidades] = useState<UnidadInventarioRow[]>([])
  const [unidadesSel, setUnidadesSel] = useState<string[]>([])

  const cargarContexto = useCallback(async () => {
    if (!origen) return
    try {
      const params = new URLSearchParams({ inventarioId: item.id, depositoId: origen })
      const resStock = await fetch(`/api/inventario/stock-por-deposito?${params}`, { credentials: 'include' })
      if (resStock.ok) {
        const filas = (await resStock.json()) as Array<{ cantidad: number }>
        const total = filas.reduce((s, f) => s + f.cantidad, 0)
        setStockOrigen(total)
      }

      if (serializado) {
        const resU = await fetch(`/api/inventario/${item.id}/unidades?estado=EN_STOCK`, {
          credentials: 'include',
        })
        if (resU.ok) {
          const rows = (await resU.json()) as UnidadInventarioRow[]
          setUnidades(rows.filter((u) => u.deposito?.id === origen || !u.deposito))
        }
      }
    } catch {
      setStockOrigen(null)
    }
  }, [item.id, origen, serializado])

  useEffect(() => {
    cargarContexto()
    setUnidadesSel([])
  }, [cargarContexto])

  const maxCantidad = useMemo(() => {
    if (serializado && unidadesSel.length > 0) return unidadesSel.length
    return stockOrigen ?? item.stock
  }, [serializado, unidadesSel.length, stockOrigen, item.stock])

  function toggleUnidad(id: string) {
    setUnidadesSel((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  async function transferir() {
    if (!origen || !destino) {
      toast.error('Seleccioná depósito de origen y destino')
      return
    }
    if (origen === destino) {
      toast.error('Origen y destino deben ser distintos')
      return
    }

    const body: Record<string, unknown> = {
      depositoOrigenId: origen,
      depositoDestinoId: destino,
      ubicacionDetalleDestino: ubicacionDestino.trim() || null,
      motivo: motivo.trim() || undefined,
    }

    if (serializado) {
      if (unidadesSel.length === 0) {
        toast.error('Seleccioná al menos una unidad (SN) para transferir')
        return
      }
      body.unidadIds = unidadesSel
    } else {
      const cant = Number(cantidad)
      if (!Number.isInteger(cant) || cant <= 0) {
        toast.error('Cantidad inválida')
        return
      }
      body.cantidad = cant
    }

    setLoading(true)
    try {
      const res = await fetch(`/api/inventario/${item.id}/transferir`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error(await mensajeErrorRespuesta(res, 'No se pudo transferir'))
      toast.success('Transferencia registrada')
      onSuccess()
      onClose()
    } catch (e) {
      toast.error(mensajeErrorDesconocido(e, 'No se pudo transferir'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-[14px] w-full max-w-lg shadow-xl p-5 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-[14px] font-bold mb-1">Transferir entre depósitos</h3>
        <p className="text-[12px] text-[#6b7280] mb-4">
          {item.nombre} · stock global: {item.stock}
          {stockOrigen != null && origen && (
            <> · en origen: <strong>{stockOrigen}</strong></>
          )}
        </p>
        <p className="text-[11px] text-[#9aa1ab] mb-3">
          El stock global no cambia; queda trazabilidad entre ubicaciones.
        </p>

        <div className="flex flex-col gap-3">
          <Select
            label="Depósito origen"
            value={origen}
            onChange={(e) => setOrigen(e.target.value)}
            options={depositos.map((d) => ({ value: d.id, label: d.nombre }))}
          />
          <Select
            label="Depósito destino"
            value={destino}
            onChange={(e) => setDestino(e.target.value)}
            options={depositos.map((d) => ({ value: d.id, label: d.nombre }))}
          />

          {serializado ? (
            <div className="border border-[#eef0f2] rounded-[9px] p-3">
              <p className="text-[11px] font-semibold text-[#5b626d] uppercase mb-2">
                Unidades en origen (seleccionar SN)
              </p>
              {unidades.length === 0 ? (
                <p className="text-[12px] text-[#9aa1ab]">Sin unidades en el depósito de origen</p>
              ) : (
                <ul className="flex flex-col gap-1 max-h-40 overflow-y-auto">
                  {unidades.map((u) => (
                    <li key={u.id}>
                      <label className="flex items-center gap-2 text-[12px] cursor-pointer py-1">
                        <input
                          type="checkbox"
                          checked={unidadesSel.includes(u.id)}
                          onChange={() => toggleUnidad(u.id)}
                        />
                        <span className="font-mono">{u.numeroSerie ?? u.id.slice(0, 8)}</span>
                        {u.lote && <span className="text-[#9aa1ab]">· lote {u.lote}</span>}
                        {u.ubicacionDetalle && (
                          <span className="text-[#9aa1ab] truncate">· {u.ubicacionDetalle}</span>
                        )}
                      </label>
                    </li>
                  ))}
                </ul>
              )}
              {unidadesSel.length > 0 && (
                <p className="text-[11px] text-[#6b7280] mt-2">{unidadesSel.length} unidad(es) seleccionada(s)</p>
              )}
            </div>
          ) : (
            <Input
              label="Cantidad"
              type="number"
              min={1}
              max={maxCantidad}
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value)}
            />
          )}

          <Input
            label="Ubicación en destino (opcional)"
            value={ubicacionDestino}
            onChange={(e) => setUbicacionDestino(e.target.value)}
            placeholder="Ej. Estante B · fila 2"
          />
          <Input
            label="Motivo (opcional)"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
          />
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" loading={loading} onClick={transferir}>
            Transferir{serializado && unidadesSel.length > 0 ? ` (${unidadesSel.length})` : ''}
          </Button>
        </div>
      </div>
    </div>
  )
}
