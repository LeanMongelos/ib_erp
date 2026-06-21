'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatFecha, formatMonto } from '@/lib/utils'
import { mensajeErrorDesconocido, mensajeErrorJson } from '@/lib/errores'

export function CobranzasManager({
  pagos,
  facturas,
}: {
  pagos: Array<{ id: string; monto: number; medio: string; fecha: string; cliente?: { nombre: string } }>
  facturas: Array<{ id: string; numero: string; total: number; cliente?: { id: string; nombre: string } }>
}) {
  const router = useRouter()
  const [facturaId, setFacturaId] = useState('')
  const [monto, setMonto] = useState('')
  const [loading, setLoading] = useState(false)

  const factura = facturas.find((f) => f.id === facturaId)

  async function registrar() {
    if (!facturaId || !monto) { toast.error('Completá factura y monto'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/cobranzas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clienteId: factura!.cliente!.id,
          monto: Number(monto),
          medio: 'TRANSFERENCIA',
          imputaciones: [{ facturaId, monto: Number(monto) }],
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(mensajeErrorJson(data, 'No se pudo registrar el pago'))
      toast.success('Pago registrado')
      router.refresh()
      setFacturaId(''); setMonto('')
    } catch (e: unknown) {
      toast.error(mensajeErrorDesconocido(e, 'No se pudo registrar el pago'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid grid-cols-2 gap-4 max-w-5xl">
      <Card>
        <h3 className="font-bold mb-4">Registrar pago</h3>
        <div className="flex flex-col gap-3">
          <div>
            <label className="text-[11.5px] font-semibold text-[#5b626d] uppercase">Factura</label>
            <select value={facturaId} onChange={(e) => { setFacturaId(e.target.value); const f = facturas.find(x => x.id === e.target.value); if (f) setMonto(String(f.total)) }}
              className="w-full mt-1.5 border border-[#e4e7eb] rounded-[9px] px-3 py-2.5 text-[13px]">
              <option value="">Seleccionar…</option>
              {facturas.map((f) => <option key={f.id} value={f.id}>{f.numero} — {f.cliente?.nombre} ({formatMonto(f.total)})</option>)}
            </select>
          </div>
          <Input label="Monto" type="number" value={monto} onChange={(e) => setMonto(e.target.value)} />
          <Button onClick={registrar} loading={loading}>Registrar pago</Button>
        </div>
      </Card>
      <Card padding={false}>
        <div className="px-5 py-3 border-b font-bold text-[13px]">Últimos pagos</div>
        {pagos.length === 0 ? (
          <p className="p-5 text-[#9aa1ab] text-[12.5px]">Sin pagos registrados</p>
        ) : pagos.map((p) => (
          <div key={p.id} className="px-5 py-3 border-b border-[#f4f5f7] flex justify-between">
            <div>
              <p className="font-semibold text-[12.5px]">{p.cliente?.nombre}</p>
              <p className="text-[11px] text-[#9aa1ab]">{formatFecha(p.fecha)} · {p.medio}</p>
            </div>
            <p className="font-bold text-green-700">{formatMonto(p.monto)}</p>
          </div>
        ))}
      </Card>
    </div>
  )
}
