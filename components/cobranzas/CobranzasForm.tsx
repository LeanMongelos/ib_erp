'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { ClienteCombobox } from '@/components/clientes/ClienteCombobox'
import { MEDIO_PAGO } from '@/lib/form-options'
import { formatFecha, formatMonto } from '@/lib/utils'
import { mensajeErrorDesconocido, mensajeErrorRespuesta } from '@/lib/errores'
import { useCan } from '@/components/auth/useCan'

interface FacturaPendiente {
  id: string
  numero: string
  total: number
  estado: string
  fechaEmision: string
  clienteId: string
}

interface Cliente {
  id: string
  nombre: string
}

export function CobranzasForm({ clientes }: { clientes: Cliente[] }) {
  const [clienteId, setClienteId] = useState('')
  const [facturas, setFacturas] = useState<FacturaPendiente[]>([])
  const [imputaciones, setImputaciones] = useState<Record<string, number>>({})
  const [medio, setMedio] = useState('TRANSFERENCIA')
  const [referencia, setReferencia] = useState('')
  const [chequeNumero, setChequeNumero] = useState('')
  const [chequeBanco, setChequeBanco] = useState('')
  const [chequeTitular, setChequeTitular] = useState('')
  const [chequeVencimiento, setChequeVencimiento] = useState('')
  const [loading, setLoading] = useState(false)
  const puedeCheques = useCan('cobranzas.cheques.manage')

  useEffect(() => {
    if (!clienteId) { setFacturas([]); return }
    fetch('/api/facturas')
      .then((r) => r.json())
      .then((all: FacturaPendiente[]) => {
        setFacturas(all.filter((f) =>
          f.clienteId === clienteId &&
          ['PENDIENTE', 'EMITIDA', 'VENCIDA'].includes(f.estado),
        ))
        setImputaciones({})
      })
      .catch(() => setFacturas([]))
  }, [clienteId])

  const montoTotal = Object.values(imputaciones).reduce((a, v) => a + v, 0)

  async function registrar() {
    if (!clienteId) { toast.error('Seleccioná un cliente'); return }
    const imps = Object.entries(imputaciones).filter(([, m]) => m > 0).map(([facturaId, monto]) => ({ facturaId, monto }))
    if (imps.length === 0) { toast.error('Indicá montos a imputar'); return }
    if (montoTotal <= 0) { toast.error('El monto debe ser mayor a 0'); return }
    if (medio === 'CHEQUE') {
      if (!puedeCheques) { toast.error('No tenés permiso para registrar cheques'); return }
      if (!chequeNumero.trim()) { toast.error('Indicá el número de cheque'); return }
      if (!chequeVencimiento) { toast.error('Indicá la fecha de vencimiento del cheque'); return }
    }
    if (medio === 'TARJETA' && !referencia.trim()) {
      toast.error('Indicá el N° de cupón o lote de la tarjeta')
      return
    }

    setLoading(true)
    try {
      const body: Record<string, unknown> = {
        clienteId,
        monto: montoTotal,
        medio,
        referencia: referencia || undefined,
        imputaciones: imps,
      }
      if (medio === 'CHEQUE') {
        body.cheque = {
          numero: chequeNumero.trim(),
          banco: chequeBanco.trim() || undefined,
          titular: chequeTitular.trim() || undefined,
          fechaVencimiento: chequeVencimiento,
        }
      }
      const res = await fetch('/api/cobranzas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error(await mensajeErrorRespuesta(res, 'No se pudo registrar el pago'))
      toast.success(medio === 'CHEQUE' ? 'Cheque registrado en cartera' : 'Pago registrado')
      setImputaciones({})
      setReferencia('')
      setChequeNumero('')
      setChequeBanco('')
      setChequeTitular('')
      setChequeVencimiento('')
    } catch (e) {
      toast.error(mensajeErrorDesconocido(e, 'No se pudo registrar el pago'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-3xl flex flex-col gap-4">
      <Card>
        <h3 className="text-[13.5px] font-bold text-[#1f242c] mb-4">Registrar cobranza</h3>
        <div className="grid grid-cols-2 gap-4">
          <ClienteCombobox
            value={clienteId}
            onChange={setClienteId}
            initialOptions={clientes}
          />
          <Select
            label="Medio de pago"
            value={medio}
            onChange={(e) => setMedio(e.target.value)}
            options={MEDIO_PAGO}
          />
          <div className="col-span-2">
            <Input
              label={medio === 'TARJETA' ? 'N° cupón / lote' : medio === 'OTRO' ? 'Referencia / acreditación' : 'Referencia'}
              value={referencia}
              onChange={(e) => setReferencia(e.target.value)}
              placeholder={
                medio === 'CHEQUE'
                  ? 'Opcional si completás N° cheque abajo'
                  : medio === 'TARJETA'
                    ? 'N° cupón, lote o terminal…'
                    : medio === 'OTRO'
                      ? 'Detalle del pago o comprobante…'
                      : 'N° transferencia…'
              }
              required={medio === 'TARJETA'}
              autoComplete="off"
            />
          </div>
          {medio === 'CHEQUE' && puedeCheques && (
            <>
              <Input label="N° cheque" value={chequeNumero} onChange={(e) => setChequeNumero(e.target.value)} required />
              <Input label="Banco" value={chequeBanco} onChange={(e) => setChequeBanco(e.target.value)} />
              <Input label="Titular" value={chequeTitular} onChange={(e) => setChequeTitular(e.target.value)} />
              <Input label="Fecha vencimiento" type="date" value={chequeVencimiento} onChange={(e) => setChequeVencimiento(e.target.value)} required />
            </>
          )}
        </div>
      </Card>

      {clienteId && (
        <Card padding={false}>
          <div className="px-5 py-3 border-b border-[#eef0f2]">
            <h3 className="text-[13px] font-bold text-[#1f242c]">Imputar a facturas</h3>
          </div>
          <table className="w-full">
            <thead>
              <tr>
                {['Factura', 'Emisión', 'Total', 'A imputar'].map((h, i) => (
                  <th key={h} className={`px-5 py-2.5 text-[10px] font-bold text-[#8a909a] uppercase border-b ${i > 1 ? 'text-right' : 'text-left'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {facturas.map((f, i) => (
                <tr key={f.id} className={i % 2 === 0 ? 'bg-white' : 'bg-[#fafbfc]'}>
                  <td className="px-5 py-3 text-[12.5px] font-bold text-[#E8650A] border-b">{f.numero}</td>
                  <td className="px-5 py-3 text-[12.5px] text-[#6b7280] border-b">{formatFecha(f.fechaEmision)}</td>
                  <td className="px-5 py-3 text-[12.5px] font-bold text-right border-b">{formatMonto(f.total)}</td>
                  <td className="px-5 py-3 text-right border-b">
                    <input type="number" min={0} max={f.total} step={0.01}
                      value={imputaciones[f.id] ?? ''}
                      onChange={(e) => setImputaciones({ ...imputaciones, [f.id]: Number(e.target.value) })}
                      className="w-28 text-right text-[12.5px] border border-[#e4e7eb] rounded-[6px] px-2 py-1" />
                  </td>
                </tr>
              ))}
              {facturas.length === 0 && (
                <tr><td colSpan={4} className="px-5 py-8 text-center text-[12.5px] text-[#9aa1ab]">Sin facturas pendientes</td></tr>
              )}
            </tbody>
          </table>
          <div className="px-5 py-4 flex items-center justify-between border-t border-[#f0f1f4]">
            <span className="text-[13px] font-bold">Total a cobrar: {formatMonto(montoTotal)}</span>
            <Button onClick={registrar} loading={loading} disabled={montoTotal <= 0}>
              {medio === 'CHEQUE' ? 'Registrar cheque' : 'Registrar pago'}
            </Button>
          </div>
        </Card>
      )}
    </div>
  )
}
