'use client'

import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Plus, RefreshCw } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { ProveedorCombobox } from '@/components/proveedores/ProveedorCombobox'
import { useCan } from '@/components/auth/useCan'
import { MEDIO_PAGO } from '@/lib/form-options'
import { formatFecha, formatMonto } from '@/lib/utils'
import { formatMontoMoneda } from '@/lib/compras/moneda-compra'
import { mensajeErrorDesconocido, mensajeErrorJson } from '@/lib/errores'

interface Proveedor {
  id: string
  razonSocial: string
}

interface VencimientoPendiente {
  id: string
  fecha: string
  monto: number
  saldo: number
  pagado: boolean
  facturaCompra: { id: string; numero: string; proveedorId: string; moneda?: string }
}

interface PagoProveedor {
  id: string
  monto: number
  moneda?: string
  fecha: string
  medio: string
  estado: string
  referencia?: string | null
  proveedor?: { razonSocial: string }
  cuentaTesoreria?: { nombre: string } | null
  imputaciones?: Array<{
    monto: number
    vencimientoPago?: { facturaCompra?: { numero: string } }
  }>
  chequeEmitido?: { id: string; numero: string; estado: string } | null
}

interface ChequeEmitido {
  id: string
  numero: string
  banco: string
  monto: number
  fechaEmision: string
  fechaDebito?: string | null
  estado: string
  proveedor?: { razonSocial: string }
  cuentaTesoreria?: { nombre: string }
}

const ESTADO_PAGO: Record<string, { label: string; cls: string }> = {
  REGISTRADO: { label: 'Registrado', cls: 'bg-green-100 text-green-700' },
  ANULADO:    { label: 'Anulado',    cls: 'bg-red-100 text-red-700' },
}

const ESTADO_CHEQUE: Record<string, { label: string; cls: string }> = {
  EMITIDO:   { label: 'Emitido',   cls: 'bg-amber-100 text-amber-800' },
  DEBITADO:  { label: 'Debitado',  cls: 'bg-green-100 text-green-700' },
  ANULADO:   { label: 'Anulado',   cls: 'bg-red-100 text-red-700' },
}

function diasHasta(fechaIso: string | null | undefined): number | null {
  if (!fechaIso) return null
  const ms = new Date(fechaIso).getTime() - Date.now()
  return Math.floor(ms / (1000 * 60 * 60 * 24))
}

function claseAlertaCheque(dias: number | null): string {
  if (dias === null) return ''
  if (dias < 0) return 'bg-red-50'
  if (dias <= 1) return 'bg-red-50'
  if (dias <= 3) return 'bg-orange-50'
  if (dias <= 7) return 'bg-amber-50'
  return ''
}

export function PagosProveedorPanel({
  proveedores,
  onPagoRegistrado,
}: {
  proveedores: Proveedor[]
  onPagoRegistrado?: () => void
}) {
  const puedePagar = useCan('compras.pay')
  const [vista, setVista] = useState<'lista' | 'nuevo' | 'cheque'>('lista')
  const [loading, setLoading] = useState(false)
  const [pagos, setPagos] = useState<PagoProveedor[]>([])
  const [cheques, setCheques] = useState<ChequeEmitido[]>([])
  const [proveedorId, setProveedorId] = useState('')
  const [vencimientos, setVencimientos] = useState<VencimientoPendiente[]>([])
  const [imputaciones, setImputaciones] = useState<Record<string, number>>({})
  const [medio, setMedio] = useState('TRANSFERENCIA')
  const [referencia, setReferencia] = useState('')
  const [chequeNumero, setChequeNumero] = useState('')
  const [chequeBanco, setChequeBanco] = useState('')
  const [chequeFechaDebito, setChequeFechaDebito] = useState('')
  const [cuentaTesoreriaId, setCuentaTesoreriaId] = useState('')
  const [cuentasTesoreria, setCuentasTesoreria] = useState<Array<{ id: string; nombre: string; tipo: string; predeterminada: boolean }>>([])
  // Standalone cheque
  const [chProvId, setChProvId] = useState('')
  const [chNumero, setChNumero] = useState('')
  const [chBanco, setChBanco] = useState('')
  const [chMonto, setChMonto] = useState('')
  const [chFechaDebito, setChFechaDebito] = useState('')
  const [chCuentaId, setChCuentaId] = useState('')

  const montoTotal = useMemo(
    () => Object.values(imputaciones).reduce((a, v) => a + v, 0),
    [imputaciones],
  )

  const saldoPendienteTotal = useMemo(
    () => vencimientos.reduce((a, v) => a + v.saldo, 0),
    [vencimientos],
  )

  const cuentasBanco = useMemo(
    () => cuentasTesoreria.filter((c) => c.tipo === 'BANCO'),
    [cuentasTesoreria],
  )

  function imputarSaldo(vencId: string, saldo: number) {
    setImputaciones((prev) => ({ ...prev, [vencId]: saldo }))
  }

  function imputarTodos() {
    const next: Record<string, number> = {}
    for (const v of vencimientos) next[v.id] = v.saldo
    setImputaciones(next)
  }

  function limpiarImputaciones() {
    setImputaciones({})
  }

  useEffect(() => {
    fetch('/api/tesoreria/cuentas', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : []))
      .then((list: Array<{ id: string; nombre: string; tipo: string; predeterminada: boolean }>) => {
        setCuentasTesoreria(list)
        const tipo = medio === 'EFECTIVO' ? 'CAJA' : 'BANCO'
        const pred = list.find((c) => c.tipo === tipo && c.predeterminada)
        const fallback = list.find((c) => c.tipo === tipo)
        setCuentaTesoreriaId(pred?.id ?? fallback?.id ?? '')
        const bancoPred = list.find((c) => c.tipo === 'BANCO' && c.predeterminada)
        const bancoFallback = list.find((c) => c.tipo === 'BANCO')
        setChCuentaId(bancoPred?.id ?? bancoFallback?.id ?? '')
      })
      .catch(() => setCuentasTesoreria([]))
  }, [medio])

  useEffect(() => {
    if (!proveedorId) {
      setVencimientos([])
      setImputaciones({})
      return
    }
    fetch(`/api/compras/facturas?proveedorId=${proveedorId}&estado=REGISTRADA`)
      .then((r) => (r.ok ? r.json() : []))
      .then((facturas: Array<{ id: string; numero: string; vencimientos: VencimientoPendiente[] }>) => {
        const vencs = facturas.flatMap((f) =>
          (f.vencimientos ?? [])
            .filter((v) => !v.pagado && v.saldo > 0.009)
            .map((v) => ({
              ...v,
              facturaCompra: { id: f.id, numero: f.numero, proveedorId },
            })),
        )
        setVencimientos(vencs)
        setImputaciones({})
      })
      .catch(() => setVencimientos([]))
  }, [proveedorId])

  async function cargarPagos() {
    setLoading(true)
    try {
      const [resPagos, resCheques] = await Promise.all([
        fetch('/api/compras/pagos'),
        fetch('/api/compras/cheques-emitidos?estado=EMITIDO'),
      ])
      const dataPagos = await resPagos.json()
      const dataCheques = await resCheques.json()
      if (!resPagos.ok) throw new Error(mensajeErrorJson(dataPagos, 'No se pudieron cargar los pagos'))
      if (!resCheques.ok) throw new Error(mensajeErrorJson(dataCheques, 'No se pudieron cargar los cheques'))
      setPagos(Array.isArray(dataPagos) ? dataPagos : [])
      setCheques(Array.isArray(dataCheques) ? dataCheques : [])
    } catch (e) {
      toast.error(mensajeErrorDesconocido(e, 'Error al cargar pagos'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    cargarPagos()
  }, [])

  async function registrarPago() {
    if (!proveedorId) { toast.error('Seleccioná un proveedor'); return }
    const imps = Object.entries(imputaciones)
      .filter(([, m]) => m > 0)
      .map(([vencimientoPagoId, monto]) => ({ vencimientoPagoId, monto }))
    if (imps.length === 0) { toast.error('Indicá montos a imputar'); return }
    if (montoTotal <= 0) { toast.error('El monto debe ser mayor a 0'); return }
    if (!cuentaTesoreriaId) { toast.error('Seleccioná cuenta de tesorería'); return }
    if (medio === 'CHEQUE' && !chequeNumero.trim()) { toast.error('Indicá el número de cheque'); return }

    setLoading(true)
    try {
      const res = await fetch('/api/compras/pagos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proveedorId,
          monto: montoTotal,
          medio,
          cuentaTesoreriaId,
          referencia: referencia || undefined,
          imputaciones: imps,
          ...(medio === 'CHEQUE' && {
            cheque: {
              numero: chequeNumero.trim(),
              banco: chequeBanco.trim() || undefined,
              ...(chequeFechaDebito && { fechaDebito: chequeFechaDebito }),
            },
          }),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(mensajeErrorJson(data, 'No se pudo registrar el pago'))
      toast.success(medio === 'CHEQUE' ? 'Pago con cheque registrado' : 'Pago registrado')
      setVista('lista')
      setProveedorId('')
      setImputaciones({})
      setReferencia('')
      setChequeNumero('')
      setChequeFechaDebito('')
      await cargarPagos()
      onPagoRegistrado?.()
    } catch (e) {
      toast.error(mensajeErrorDesconocido(e, 'No se pudo registrar el pago'))
    } finally {
      setLoading(false)
    }
  }

  async function anularPago(id: string) {
    if (!confirm('¿Anular este pago? Se revertirán las imputaciones.')) return
    setLoading(true)
    try {
      const res = await fetch(`/api/compras/pagos/${id}/anular`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(mensajeErrorJson(data, 'No se pudo anular'))
      toast.success('Pago anulado')
      await cargarPagos()
      onPagoRegistrado?.()
    } catch (e) {
      toast.error(mensajeErrorDesconocido(e, 'No se pudo anular el pago'))
    } finally {
      setLoading(false)
    }
  }

  async function debitarCheque(id: string) {
    setLoading(true)
    try {
      const res = await fetch(`/api/compras/cheques-emitidos/${id}/debitar`, { method: 'PATCH' })
      const data = await res.json()
      if (!res.ok) throw new Error(mensajeErrorJson(data, 'No se pudo debitar el cheque'))
      toast.success('Cheque debitado — egreso registrado en tesorería')
      await cargarPagos()
    } catch (e) {
      toast.error(mensajeErrorDesconocido(e, 'No se pudo debitar el cheque'))
    } finally {
      setLoading(false)
    }
  }

  async function emitirChequeStandalone() {
    if (!chProvId) { toast.error('Seleccioná un proveedor'); return }
    if (!chNumero.trim()) { toast.error('Indicá el número de cheque'); return }
    if (!chMonto || Number(chMonto) <= 0) { toast.error('Indicá un monto válido'); return }
    if (!chCuentaId) { toast.error('Seleccioná cuenta bancaria'); return }

    setLoading(true)
    try {
      const res = await fetch('/api/compras/cheques-emitidos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proveedorId: chProvId,
          numero: chNumero.trim(),
          banco: chBanco.trim() || undefined,
          monto: Number(chMonto),
          cuentaTesoreriaId: chCuentaId,
          ...(chFechaDebito && { fechaDebito: chFechaDebito }),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(mensajeErrorJson(data, 'No se pudo emitir el cheque'))
      toast.success('Cheque emitido')
      setVista('lista')
      setChProvId('')
      setChNumero('')
      setChBanco('')
      setChMonto('')
      setChFechaDebito('')
      await cargarPagos()
    } catch (e) {
      toast.error(mensajeErrorDesconocido(e, 'No se pudo emitir el cheque'))
    } finally {
      setLoading(false)
    }
  }

  const cuentasFiltradas = cuentasTesoreria.filter((c) =>
    medio === 'EFECTIVO' ? c.tipo === 'CAJA' : c.tipo === 'BANCO',
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setVista('lista')}
            className={`text-[12px] font-semibold px-3 py-1.5 rounded-full ${vista === 'lista' ? 'bg-[#1f242c] text-white' : 'bg-white text-[#6b7280] border border-[#e4e7eb]'}`}
          >
            Pagos ({pagos.filter((p) => p.estado === 'REGISTRADO').length})
          </button>
          {puedePagar && (
            <button
              type="button"
              onClick={() => setVista('nuevo')}
              className={`text-[12px] font-semibold px-3 py-1.5 rounded-full ${vista === 'nuevo' ? 'bg-[#E8650A] text-white' : 'bg-white text-[#6b7280] border border-[#e4e7eb]'}`}
            >
              <Plus size={12} className="inline mr-1" /> Registrar pago
            </button>
          )}
          {puedePagar && (
            <button
              type="button"
              onClick={() => setVista('cheque')}
              className={`text-[12px] font-semibold px-3 py-1.5 rounded-full ${vista === 'cheque' ? 'bg-[#1f242c] text-white' : 'bg-white text-[#6b7280] border border-[#e4e7eb]'}`}
            >
              Emitir cheque
            </button>
          )}
        </div>
        <button type="button" onClick={cargarPagos} className="text-[12px] text-[#6b7280] hover:text-[#E8650A] inline-flex items-center gap-1">
          <RefreshCw size={13} /> Actualizar
        </button>
      </div>

      {vista === 'nuevo' && puedePagar && (
        <Card>
          <h3 className="text-[13.5px] font-bold text-[#1f242c] mb-4">Nuevo pago a proveedor</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ProveedorCombobox
              value={proveedorId}
              onChange={setProveedorId}
              initialOptions={proveedores}
              label="Proveedor"
            />
            <Select label="Medio de pago" value={medio} onChange={(e) => setMedio(e.target.value)} options={MEDIO_PAGO} />
            <Select
              label="Cuenta tesorería"
              value={cuentaTesoreriaId}
              onChange={(e) => setCuentaTesoreriaId(e.target.value)}
              options={[
                { value: '', label: 'Seleccionar…' },
                ...cuentasFiltradas.map((c) => ({ value: c.id, label: `${c.nombre} (${c.tipo})` })),
              ]}
            />
            <Input label="Referencia" value={referencia} onChange={(e) => setReferencia(e.target.value)} placeholder="Opcional" />
            {medio === 'CHEQUE' && (
              <>
                <Input label="N° cheque" value={chequeNumero} onChange={(e) => setChequeNumero(e.target.value)} />
                <Input label="Banco" value={chequeBanco} onChange={(e) => setChequeBanco(e.target.value)} />
                <Input label="Fecha débito prevista" type="date" value={chequeFechaDebito} onChange={(e) => setChequeFechaDebito(e.target.value)} />
              </>
            )}
          </div>

          {vencimientos.length > 0 && (
            <div className="mt-4">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <p className="text-[12px] font-semibold text-[#6b7280]">
                  Vencimientos pendientes ({vencimientos.length} · saldo {formatMonto(saldoPendienteTotal)})
                </p>
                <div className="flex gap-2">
                  <button type="button" onClick={imputarTodos} className="text-[11px] font-semibold text-[#E8650A] hover:underline">
                    Imputar todos los saldos
                  </button>
                  <button type="button" onClick={limpiarImputaciones} className="text-[11px] text-[#9aa1ab] hover:underline">
                    Limpiar
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto border border-[#eef0f2] rounded-[8px]">
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="bg-[#fafbfc]">
                      {['Factura', 'Vencimiento', 'Saldo', 'Imputar', ''].map((h) => (
                        <th key={h} className="px-3 py-2 text-left text-[10px] font-bold text-[#8a909a] uppercase">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {vencimientos.map((v) => (
                      <tr key={v.id} className="border-t border-[#f4f5f7]">
                        <td className="px-3 py-2">{v.facturaCompra?.numero ?? '—'}</td>
                        <td className="px-3 py-2">{formatFecha(v.fecha)}</td>
                        <td className="px-3 py-2">{formatMonto(v.saldo)}</td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            min={0}
                            max={v.saldo}
                            step={0.01}
                            value={imputaciones[v.id] ?? ''}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0
                              setImputaciones((prev) => ({ ...prev, [v.id]: val }))
                            }}
                            className="w-28 border border-[#e4e7eb] rounded px-2 py-1"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <button
                            type="button"
                            onClick={() => imputarSaldo(v.id, v.saldo)}
                            className="text-[11px] font-semibold text-[#E8650A] hover:underline whitespace-nowrap"
                          >
                            Saldo completo
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-[12px] font-semibold text-[#1f242c]">
                Total imputado: {formatMonto(montoTotal)}
                {montoTotal > 0 && montoTotal < saldoPendienteTotal && (
                  <span className="ml-2 text-[11px] font-normal text-[#9aa1ab]">
                    (quedan {formatMonto(saldoPendienteTotal - montoTotal)} sin imputar)
                  </span>
                )}
              </p>
            </div>
          )}

          {proveedorId && vencimientos.length === 0 && (
            <p className="mt-4 text-[12px] text-[#9aa1ab]">Sin vencimientos pendientes para este proveedor.</p>
          )}

          <div className="mt-4 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setVista('lista')}>Cancelar</Button>
            <Button variant="primary" onClick={registrarPago} loading={loading} disabled={montoTotal <= 0}>
              Registrar pago
            </Button>
          </div>
        </Card>
      )}

      {vista === 'cheque' && puedePagar && (
        <Card>
          <h3 className="text-[13.5px] font-bold text-[#1f242c] mb-4">Emitir cheque (sin pago vinculado)</h3>
          <p className="text-[12px] text-[#9aa1ab] mb-4">
            Para cheques entregados fuera del flujo de pago con imputación. El egreso en tesorería se registra al debitar.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ProveedorCombobox value={chProvId} onChange={setChProvId} initialOptions={proveedores} label="Proveedor" />
            <Input label="N° cheque" value={chNumero} onChange={(e) => setChNumero(e.target.value)} />
            <Input label="Banco" value={chBanco} onChange={(e) => setChBanco(e.target.value)} />
            <Input label="Monto" type="number" min={0} step={0.01} value={chMonto} onChange={(e) => setChMonto(e.target.value)} />
            <Input label="Fecha débito prevista" type="date" value={chFechaDebito} onChange={(e) => setChFechaDebito(e.target.value)} />
            <Select
              label="Cuenta bancaria"
              value={chCuentaId}
              onChange={(e) => setChCuentaId(e.target.value)}
              options={[
                { value: '', label: 'Seleccionar…' },
                ...cuentasBanco.map((c) => ({ value: c.id, label: c.nombre })),
              ]}
            />
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setVista('lista')}>Cancelar</Button>
            <Button variant="primary" onClick={emitirChequeStandalone} loading={loading}>Emitir cheque</Button>
          </div>
        </Card>
      )}

      <Card padding={false}>
        {loading && vista === 'lista' ? (
          <p className="p-6 text-[12.5px] text-[#9aa1ab]">Cargando…</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  {['Fecha', 'Proveedor', 'Medio', 'Monto', 'Estado', 'Imputaciones', ''].map((h) => (
                    <th key={h} className="px-5 py-3 text-left text-[10.5px] font-bold text-[#8a909a] tracking-[0.6px] uppercase border-b border-[#eef0f2]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pagos.map((p, i) => {
                  const st = ESTADO_PAGO[p.estado] ?? { label: p.estado, cls: 'bg-gray-100' }
                  const imps = p.imputaciones?.map((imp) =>
                    `${imp.vencimientoPago?.facturaCompra?.numero ?? '?'} (${formatMonto(imp.monto)})`,
                  ).join(', ')
                  return (
                    <tr key={p.id} className={i % 2 === 0 ? 'bg-white' : 'bg-[#fafbfc]'}>
                      <td className="px-5 py-[13px] text-[12px] border-b border-[#f4f5f7]">{formatFecha(p.fecha)}</td>
                      <td className="px-5 py-[13px] text-[12.5px] border-b border-[#f4f5f7]">{p.proveedor?.razonSocial ?? '—'}</td>
                      <td className="px-5 py-[13px] text-[12px] border-b border-[#f4f5f7]">
                        {p.medio}
                        {p.chequeEmitido && (
                          <span className="block text-[10.5px] text-[#9aa1ab]">Ch. {p.chequeEmitido.numero}</span>
                        )}
                      </td>
                      <td className="px-5 py-[13px] text-[12.5px] font-semibold border-b border-[#f4f5f7]">
                        {formatMontoMoneda(p.monto, p.moneda ?? 'ARS')}
                      </td>
                      <td className="px-5 py-[13px] border-b border-[#f4f5f7]">
                        <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
                      </td>
                      <td className="px-5 py-[13px] text-[11px] text-[#6b7280] border-b border-[#f4f5f7] max-w-[200px] truncate" title={imps}>{imps || '—'}</td>
                      <td className="px-5 py-[13px] border-b border-[#f4f5f7] text-right">
                        {puedePagar && p.estado === 'REGISTRADO' && (
                          <Button variant="outline" size="sm" onClick={() => anularPago(p.id)}>Anular</Button>
                        )}
                      </td>
                    </tr>
                  )
                })}
                {pagos.length === 0 && (
                  <tr><td colSpan={7} className="px-5 py-10 text-center text-[12.5px] text-[#9aa1ab]">Sin pagos registrados</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {cheques.length > 0 && (
        <Card padding={false}>
          <div className="px-5 py-3 border-b border-[#eef0f2]">
            <h3 className="text-[13px] font-bold text-[#1f242c]">Cheques emitidos pendientes de débito</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  {['N°', 'Proveedor', 'Banco', 'Monto', 'Emisión', 'Débito previsto', 'Estado', ''].map((h) => (
                    <th key={h} className="px-5 py-3 text-left text-[10.5px] font-bold text-[#8a909a] uppercase border-b border-[#eef0f2]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cheques.map((ch, i) => {
                  const st = ESTADO_CHEQUE[ch.estado] ?? { label: ch.estado, cls: 'bg-gray-100' }
                  const diasDebito = diasHasta(ch.fechaDebito)
                  const alertaCls = ch.estado === 'EMITIDO' ? claseAlertaCheque(diasDebito) : ''
                  return (
                    <tr key={ch.id} className={`${i % 2 === 0 ? 'bg-white' : 'bg-[#fafbfc]'} ${alertaCls}`}>
                      <td className="px-5 py-[13px] text-[12.5px] font-bold border-b border-[#f4f5f7]">{ch.numero}</td>
                      <td className="px-5 py-[13px] text-[12px] border-b border-[#f4f5f7]">{ch.proveedor?.razonSocial ?? '—'}</td>
                      <td className="px-5 py-[13px] text-[12px] border-b border-[#f4f5f7]">{ch.banco || '—'}</td>
                      <td className="px-5 py-[13px] text-[12.5px] font-semibold border-b border-[#f4f5f7]">{formatMonto(ch.monto)}</td>
                      <td className="px-5 py-[13px] text-[12px] border-b border-[#f4f5f7]">{formatFecha(ch.fechaEmision)}</td>
                      <td className="px-5 py-[13px] text-[12px] border-b border-[#f4f5f7]">
                        {ch.fechaDebito ? (
                          <span className={diasDebito !== null && diasDebito <= 7 ? 'font-semibold text-amber-800' : ''}>
                            {formatFecha(ch.fechaDebito)}
                            {diasDebito !== null && diasDebito >= 0 && diasDebito <= 7 && (
                              <span className="block text-[10px] text-amber-700">en {diasDebito}d</span>
                            )}
                            {diasDebito !== null && diasDebito < 0 && (
                              <span className="block text-[10px] text-red-600">vencido</span>
                            )}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-5 py-[13px] border-b border-[#f4f5f7]">
                        <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
                      </td>
                      <td className="px-5 py-[13px] border-b border-[#f4f5f7] text-right">
                        {puedePagar && ch.estado === 'EMITIDO' && (
                          <Button variant="primary" size="sm" onClick={() => debitarCheque(ch.id)}>Debitar</Button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}
