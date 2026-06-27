'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { formatFecha, formatMonto } from '@/lib/utils'
import { mensajeErrorDesconocido, mensajeErrorJson, mensajeErrorRespuesta } from '@/lib/errores'
import { useCan } from '@/components/auth/useCan'

interface CuentaRow {
  id: string
  nombre: string
  tipo: 'BANCO' | 'CAJA'
  banco: string | null
  cbu: string | null
  alias: string | null
  moneda: string
  activa: boolean
  saldoInicialCargado: boolean
  predeterminada: boolean
  saldo: number
  planCuenta?: { codigo: string; nombre: string } | null
}

interface MovimientoRow {
  id: string
  fecha: string
  tipo: string
  monto: number
  montoSigned: number
  saldoPosterior: number | null
  descripcion: string
  referencia: string | null
  conciliadoEn: string | null
  extractoRef: string | null
  conciliadoPor: { nombre: string } | null
  pago?: { cliente: { nombre: string } } | null
  pagoProveedor?: {
    id: string
    medio: string
    monto: number
    proveedor: { id: string; razonSocial: string }
  } | null
}

const TIPO_CUENTA_LABEL: Record<string, string> = {
  BANCO: 'Banco',
  CAJA: 'Caja',
}

const TIPO_MOV_LABEL: Record<string, string> = {
  SALDO_INICIAL: 'Saldo inicial',
  INGRESO: 'Ingreso',
  EGRESO: 'Egreso',
  AJUSTE: 'Ajuste',
  TRANSFERENCIA: 'Transferencia',
}

const TABS = ['Cuentas', 'Movimientos', 'Transferencias', 'Conciliación'] as const
type TabId = typeof TABS[number]

export function TesoreriaManager() {
  const puedeGestionar = useCan('tesoreria.manage')
  const puedeSaldoInicial = useCan('tesoreria.initial_balance')
  const puedeConciliar = useCan('tesoreria.reconcile')

  const [tab, setTab] = useState<TabId>('Cuentas')
  const [cuentas, setCuentas] = useState<CuentaRow[]>([])
  const [totalGeneral, setTotalGeneral] = useState(0)
  const [loading, setLoading] = useState(true)
  const [cuentaSel, setCuentaSel] = useState('')
  const [movimientos, setMovimientos] = useState<MovimientoRow[]>([])
  const [saldoCuenta, setSaldoCuenta] = useState(0)
  const [movLoading, setMovLoading] = useState(false)

  const [nuevaNombre, setNuevaNombre] = useState('')
  const [nuevaTipo, setNuevaTipo] = useState<'BANCO' | 'CAJA'>('BANCO')
  const [nuevaBanco, setNuevaBanco] = useState('')
  const [saldoInicialMonto, setSaldoInicialMonto] = useState('')
  const [saldoInicialFecha, setSaldoInicialFecha] = useState('')
  const [saldoInicialCuenta, setSaldoInicialCuenta] = useState('')

  const [movTipo, setMovTipo] = useState<'INGRESO' | 'EGRESO' | 'AJUSTE'>('INGRESO')
  const [movMonto, setMovMonto] = useState('')
  const [movFecha, setMovFecha] = useState('')
  const [movDesc, setMovDesc] = useState('')
  const [movRef, setMovRef] = useState('')
  const [movCuenta, setMovCuenta] = useState('')

  const [filtroConciliado, setFiltroConciliado] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('')
  const [filtroEgresoProveedor, setFiltroEgresoProveedor] = useState(false)
  const [conciliandoId, setConciliandoId] = useState<string | null>(null)
  const [extractoRef, setExtractoRef] = useState('')

  const [txOrigen, setTxOrigen] = useState('')
  const [txDestino, setTxDestino] = useState('')
  const [txMonto, setTxMonto] = useState('')
  const [txFecha, setTxFecha] = useState('')
  const [txDesc, setTxDesc] = useState('')
  const [transferencias, setTransferencias] = useState<Array<{
    transferenciaId: string
    fecha: string
    monto: number
    descripcion: string
    cuentaOrigen: { id: string; nombre: string }
    cuentaDestino: { id: string; nombre: string } | null
  }>>([])

  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [extractoMatches, setExtractoMatches] = useState<Array<{
    linea: { indice: number; fecha: string; descripcion: string; montoSigned: number }
    movimientoId: string | null
    movimientoDescripcion: string | null
    confianza: string
    confirmado: boolean
  }>>([])
  const [importandoCsv, setImportandoCsv] = useState(false)

  const cargarResumen = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/tesoreria/resumen', { credentials: 'include' })
      if (!res.ok) throw new Error(await mensajeErrorRespuesta(res, 'No se pudo cargar tesorería'))
      const data = await res.json()
      setCuentas(data.cuentas ?? [])
      setTotalGeneral(data.total ?? 0)
      if (!cuentaSel && data.cuentas?.length) {
        setCuentaSel(data.cuentas[0].id)
        setMovCuenta(data.cuentas[0].id)
      }
    } catch (e) {
      toast.error(mensajeErrorDesconocido(e, 'No se pudo cargar tesorería'))
    } finally {
      setLoading(false)
    }
  }, [cuentaSel])

  const cargarMovimientos = useCallback(async (cuentaId: string, conciliado?: string, tipo?: string) => {
    if (!cuentaId) return
    setMovLoading(true)
    try {
      const params = new URLSearchParams({ limit: '50' })
      if (conciliado) params.set('conciliado', conciliado)
      if (tipo) params.set('tipo', tipo)
      const res = await fetch(`/api/tesoreria/cuentas/${cuentaId}/movimientos?${params}`, {
        credentials: 'include',
      })
      if (!res.ok) throw new Error(await mensajeErrorRespuesta(res, 'No se pudieron cargar movimientos'))
      const data = await res.json()
      let list: MovimientoRow[] = data.movimientos ?? []
      if (filtroEgresoProveedor) {
        list = list.filter((m) => m.tipo === 'EGRESO' && m.pagoProveedor)
      }
      setMovimientos(list)
      setSaldoCuenta(data.saldoActual ?? 0)
    } catch (e) {
      toast.error(mensajeErrorDesconocido(e, 'No se pudieron cargar movimientos'))
    } finally {
      setMovLoading(false)
    }
  }, [filtroEgresoProveedor])

  const cargarTransferencias = useCallback(async () => {
    try {
      const res = await fetch('/api/tesoreria/transferencias', { credentials: 'include' })
      if (!res.ok) return
      const data = await res.json()
      setTransferencias(data.transferencias ?? [])
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    cargarResumen()
  }, [cargarResumen])

  useEffect(() => {
    if (tab === 'Transferencias') cargarTransferencias()
  }, [tab, cargarTransferencias])

  useEffect(() => {
    if (tab !== 'Cuentas' && tab !== 'Transferencias' && cuentaSel) {
      const conc = tab === 'Conciliación' ? 'no' : filtroConciliado
      cargarMovimientos(cuentaSel, conc, filtroTipo || undefined)
    }
  }, [tab, cuentaSel, filtroConciliado, filtroTipo, filtroEgresoProveedor, cargarMovimientos])

  async function crearCuenta() {
    if (!nuevaNombre.trim()) {
      toast.error('Indicá el nombre de la cuenta')
      return
    }
    try {
      const res = await fetch('/api/tesoreria/cuentas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: nuevaNombre.trim(),
          tipo: nuevaTipo,
          banco: nuevaBanco.trim() || undefined,
          predeterminada: cuentas.filter((c) => c.tipo === nuevaTipo).length === 0,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(mensajeErrorJson(data, 'No se pudo crear la cuenta'))
      toast.success('Cuenta creada')
      setNuevaNombre('')
      setNuevaBanco('')
      await cargarResumen()
    } catch (e) {
      toast.error(mensajeErrorDesconocido(e, 'No se pudo crear la cuenta'))
    }
  }

  async function cargarSaldoInicial() {
    if (!saldoInicialCuenta || !saldoInicialMonto || !saldoInicialFecha) {
      toast.error('Completá cuenta, fecha y monto')
      return
    }
    try {
      const res = await fetch(`/api/tesoreria/cuentas/${saldoInicialCuenta}/saldo-inicial`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          monto: Number(saldoInicialMonto),
          fecha: saldoInicialFecha,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(mensajeErrorJson(data, 'No se pudo cargar el saldo inicial'))
      toast.success('Saldo inicial registrado')
      setSaldoInicialMonto('')
      await cargarResumen()
    } catch (e) {
      toast.error(mensajeErrorDesconocido(e, 'No se pudo cargar el saldo inicial'))
    }
  }

  async function registrarMovimiento() {
    if (!movCuenta || !movMonto || !movFecha || !movDesc.trim()) {
      toast.error('Completá todos los campos del movimiento')
      return
    }
    try {
      const res = await fetch('/api/tesoreria/movimientos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cuentaTesoreriaId: movCuenta,
          tipo: movTipo,
          monto: Number(movMonto),
          fecha: movFecha,
          descripcion: movDesc.trim(),
          referencia: movRef.trim() || undefined,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(mensajeErrorJson(data, 'No se pudo registrar el movimiento'))
      toast.success('Movimiento registrado')
      setMovMonto('')
      setMovDesc('')
      setMovRef('')
      await cargarResumen()
      if (cuentaSel === movCuenta) cargarMovimientos(cuentaSel, tab === 'Conciliación' ? 'no' : filtroConciliado, filtroTipo || undefined)
    } catch (e) {
      toast.error(mensajeErrorDesconocido(e, 'No se pudo registrar el movimiento'))
    }
  }

  async function registrarTransferencia() {
    if (!txOrigen || !txDestino || !txMonto || !txFecha) {
      toast.error('Completá origen, destino, fecha y monto')
      return
    }
    try {
      const res = await fetch('/api/tesoreria/transferencias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cuentaOrigenId: txOrigen,
          cuentaDestinoId: txDestino,
          monto: Number(txMonto),
          fecha: txFecha,
          descripcion: txDesc.trim() || undefined,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(mensajeErrorJson(data, 'No se pudo registrar la transferencia'))
      toast.success('Transferencia registrada')
      setTxMonto('')
      setTxDesc('')
      await cargarResumen()
      await cargarTransferencias()
    } catch (e) {
      toast.error(mensajeErrorDesconocido(e, 'No se pudo registrar la transferencia'))
    }
  }

  async function importarExtractoCsv() {
    if (!cuentaSel || !csvFile) {
      toast.error('Seleccioná cuenta y archivo CSV')
      return
    }
    setImportandoCsv(true)
    try {
      const form = new FormData()
      form.append('file', csvFile)
      const res = await fetch(`/api/tesoreria/cuentas/${cuentaSel}/importar-extracto`, {
        method: 'POST',
        body: form,
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(mensajeErrorJson(data, 'No se pudo parsear el CSV'))
      setExtractoMatches(
        (data.matches ?? []).map((m: {
          linea: { indice: number; fecha: string; descripcion: string; montoSigned: number }
          movimientoId: string | null
          movimientoDescripcion: string | null
          confianza: string
        }) => ({
          ...m,
          confirmado: m.confianza === 'alta' && !!m.movimientoId,
        })),
      )
      toast.success(`${data.lineas ?? 0} líneas importadas`)
    } catch (e) {
      toast.error(mensajeErrorDesconocido(e, 'Error al importar extracto'))
    } finally {
      setImportandoCsv(false)
    }
  }

  async function aplicarConciliacionCsv() {
    const matches = extractoMatches
      .filter((m) => m.confirmado && m.movimientoId)
      .map((m) => ({
        movimientoId: m.movimientoId!,
        extractoRef: `CSV:${m.linea.indice}:${m.linea.descripcion.slice(0, 40)}`,
      }))
    if (!matches.length) {
      toast.error('Marcá al menos una coincidencia')
      return
    }
    try {
      const res = await fetch(`/api/tesoreria/cuentas/${cuentaSel}/conciliar-extracto`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matches }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(mensajeErrorJson(data, 'No se pudo conciliar'))
      toast.success(`${data.conciliados ?? matches.length} movimiento(s) conciliado(s)`)
      setExtractoMatches([])
      setCsvFile(null)
      cargarMovimientos(cuentaSel, 'no', filtroTipo || undefined)
    } catch (e) {
      toast.error(mensajeErrorDesconocido(e, 'No se pudo conciliar'))
    }
  }

  async function conciliarMov(id: string) {
    setConciliandoId(id)
    try {
      const res = await fetch(`/api/tesoreria/movimientos/${id}/conciliar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ extractoRef: extractoRef.trim() || undefined }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(mensajeErrorJson(data, 'No se pudo conciliar'))
      toast.success('Movimiento conciliado')
      setExtractoRef('')
      cargarMovimientos(cuentaSel, tab === 'Conciliación' ? 'no' : filtroConciliado, filtroTipo || undefined)
    } catch (e) {
      toast.error(mensajeErrorDesconocido(e, 'No se pudo conciliar'))
    } finally {
      setConciliandoId(null)
    }
  }

  const cuentaOptions = cuentas.map((c) => ({
    value: c.id,
    label: `${c.nombre} (${TIPO_CUENTA_LABEL[c.tipo]})`,
  }))

  return (
    <div className="flex flex-col gap-4">
      <Card className="p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[12px] text-[#9aa1ab] uppercase font-bold tracking-wide">Total tesorería</p>
          <p className="text-[22px] font-bold text-[#1f242c]">{formatMonto(totalGeneral)}</p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => cargarResumen()} disabled={loading}>
          Actualizar
        </Button>
      </Card>

      <div className="flex gap-0.5 border-b border-[#eef0f2]">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-[12.5px] font-semibold transition-colors whitespace-nowrap ${
              tab === t
                ? 'text-[#E8650A] border-b-[2.5px] border-[#E8650A] -mb-px'
                : 'text-[#9aa1ab] hover:text-[#3a4150]'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'Cuentas' && (
        <div className="flex flex-col gap-4">
          {puedeGestionar && (
            <Card className="p-4 grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
              <Input label="Nombre" value={nuevaNombre} onChange={(e) => setNuevaNombre(e.target.value)} />
              <Select
                label="Tipo"
                value={nuevaTipo}
                onChange={(e) => setNuevaTipo(e.target.value as 'BANCO' | 'CAJA')}
                options={[
                  { value: 'BANCO', label: 'Banco' },
                  { value: 'CAJA', label: 'Caja' },
                ]}
              />
              <Input label="Banco (opcional)" value={nuevaBanco} onChange={(e) => setNuevaBanco(e.target.value)} />
              <Button variant="primary" onClick={crearCuenta}>Nueva cuenta</Button>
            </Card>
          )}

          {puedeSaldoInicial && (
            <Card className="p-4 grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
              <Select
                label="Cuenta"
                value={saldoInicialCuenta}
                onChange={(e) => setSaldoInicialCuenta(e.target.value)}
                options={[{ value: '', label: 'Seleccionar…' }, ...cuentaOptions]}
              />
              <Input label="Fecha" type="date" value={saldoInicialFecha} onChange={(e) => setSaldoInicialFecha(e.target.value)} />
              <Input label="Monto inicial" type="number" min={0} step={0.01} value={saldoInicialMonto} onChange={(e) => setSaldoInicialMonto(e.target.value)} />
              <Button variant="primary" onClick={cargarSaldoInicial}>Cargar saldo inicial</Button>
            </Card>
          )}

          <Card padding={false}>
            {loading ? (
              <p className="p-5 text-[12.5px] text-[#9aa1ab]">Cargando…</p>
            ) : cuentas.length === 0 ? (
              <p className="p-5 text-[12.5px] text-[#9aa1ab]">Sin cuentas. Creá una cuenta de banco o caja.</p>
            ) : (
              <table className="w-full">
                <thead>
                  <tr>
                    {['Cuenta', 'Tipo', 'Saldo', 'Saldo inicial', 'Estado'].map((h) => (
                      <th key={h} className="px-5 py-2.5 text-[10px] font-bold text-[#8a909a] uppercase border-b text-left">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {cuentas.map((c, i) => (
                    <tr key={c.id} className={i % 2 === 0 ? 'bg-white' : 'bg-[#fafbfc]'}>
                      <td className="px-5 py-3 text-[12.5px] font-semibold text-[#3a4150] border-b">
                        {c.nombre}
                        {c.predeterminada && <span className="ml-2 text-[10px] text-[#E8650A]">predeterminada</span>}
                      </td>
                      <td className="px-5 py-3 text-[12.5px] text-[#6b7280] border-b">{TIPO_CUENTA_LABEL[c.tipo]}</td>
                      <td className="px-5 py-3 text-[12.5px] font-bold text-right border-b">{formatMonto(c.saldo)}</td>
                      <td className="px-5 py-3 text-[12.5px] border-b">
                        {c.saldoInicialCargado ? (
                          <span className="text-green-700 font-semibold">Cargado</span>
                        ) : (
                          <span className="text-[#9aa1ab]">Pendiente</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-[12.5px] border-b">
                        {c.activa ? 'Activa' : 'Inactiva'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </div>
      )}

      {tab === 'Movimientos' && (
        <div className="flex flex-col gap-4">
          <Card className="p-4 flex flex-wrap gap-3 items-end">
            <Select
              label="Cuenta"
              value={cuentaSel}
              onChange={(e) => setCuentaSel(e.target.value)}
              options={cuentaOptions}
              className="min-w-[200px]"
            />
            <Select
              label="Conciliación"
              value={filtroConciliado}
              onChange={(e) => setFiltroConciliado(e.target.value)}
              options={[
                { value: '', label: 'Todos' },
                { value: 'si', label: 'Conciliados' },
                { value: 'no', label: 'Pendientes' },
              ]}
              className="min-w-[140px]"
            />
            <Select
              label="Tipo"
              value={filtroTipo}
              onChange={(e) => setFiltroTipo(e.target.value)}
              options={[
                { value: '', label: 'Todos' },
                { value: 'INGRESO', label: 'Ingresos' },
                { value: 'EGRESO', label: 'Egresos' },
                { value: 'AJUSTE', label: 'Ajustes' },
              ]}
              className="min-w-[120px]"
            />
            <label className="flex items-center gap-2 text-[12px] text-[#6b7280] pb-1 cursor-pointer">
              <input
                type="checkbox"
                checked={filtroEgresoProveedor}
                onChange={(e) => setFiltroEgresoProveedor(e.target.checked)}
              />
              Solo pagos a proveedores
            </label>
            <div className="text-[13px] font-bold text-[#1f242c]">
              Saldo: {formatMonto(saldoCuenta)}
            </div>
          </Card>

          {puedeGestionar && (
            <Card className="p-4 grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
              <Select label="Cuenta" value={movCuenta} onChange={(e) => setMovCuenta(e.target.value)} options={cuentaOptions} />
              <Select
                label="Tipo"
                value={movTipo}
                onChange={(e) => setMovTipo(e.target.value as 'INGRESO' | 'EGRESO' | 'AJUSTE')}
                options={[
                  { value: 'INGRESO', label: 'Ingreso' },
                  { value: 'EGRESO', label: 'Egreso' },
                  { value: 'AJUSTE', label: 'Ajuste (+/-)' },
                ]}
              />
              <Input label="Fecha" type="date" value={movFecha} onChange={(e) => setMovFecha(e.target.value)} />
              <Input label="Monto" type="number" step={0.01} value={movMonto} onChange={(e) => setMovMonto(e.target.value)} />
              <Input label="Descripción" value={movDesc} onChange={(e) => setMovDesc(e.target.value)} />
              <Button variant="primary" onClick={registrarMovimiento}>Registrar</Button>
            </Card>
          )}

          <MovimientosTable
            movimientos={movimientos}
            loading={movLoading}
            showConciliar={false}
          />
        </div>
      )}

      {tab === 'Transferencias' && (
        <div className="flex flex-col gap-4">
          {puedeGestionar && (
            <Card className="p-4 grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
              <Select label="Origen" value={txOrigen} onChange={(e) => setTxOrigen(e.target.value)} options={[{ value: '', label: 'Seleccionar…' }, ...cuentaOptions]} />
              <Select label="Destino" value={txDestino} onChange={(e) => setTxDestino(e.target.value)} options={[{ value: '', label: 'Seleccionar…' }, ...cuentaOptions]} />
              <Input label="Fecha" type="date" value={txFecha} onChange={(e) => setTxFecha(e.target.value)} />
              <Input label="Monto" type="number" step={0.01} min={0} value={txMonto} onChange={(e) => setTxMonto(e.target.value)} />
              <Input label="Descripción" value={txDesc} onChange={(e) => setTxDesc(e.target.value)} />
              <Button variant="primary" onClick={registrarTransferencia}>Transferir</Button>
            </Card>
          )}
          <Card padding={false}>
            {transferencias.length === 0 ? (
              <p className="p-5 text-[12.5px] text-[#9aa1ab]">Sin transferencias recientes</p>
            ) : (
              <table className="w-full">
                <thead>
                  <tr>
                    {['Fecha', 'Origen', 'Destino', 'Monto', 'Descripción'].map((h) => (
                      <th key={h} className="px-5 py-2.5 text-[10px] font-bold text-[#8a909a] uppercase border-b text-left">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {transferencias.map((t, i) => (
                    <tr key={t.transferenciaId} className={i % 2 === 0 ? 'bg-white' : 'bg-[#fafbfc]'}>
                      <td className="px-5 py-3 text-[12.5px] border-b">{formatFecha(t.fecha)}</td>
                      <td className="px-5 py-3 text-[12.5px] border-b">{t.cuentaOrigen?.nombre}</td>
                      <td className="px-5 py-3 text-[12.5px] border-b">{t.cuentaDestino?.nombre ?? '—'}</td>
                      <td className="px-5 py-3 text-[12.5px] font-bold border-b">{formatMonto(t.monto)}</td>
                      <td className="px-5 py-3 text-[12.5px] border-b">{t.descripcion}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </div>
      )}

      {tab === 'Conciliación' && (
        <div className="flex flex-col gap-4">
          <Card className="p-4 flex flex-wrap gap-3 items-end">
            <Select
              label="Cuenta"
              value={cuentaSel}
              onChange={(e) => setCuentaSel(e.target.value)}
              options={cuentaOptions}
              className="min-w-[200px]"
            />
            <Input
              label="Ref. extracto (para marcar)"
              value={extractoRef}
              onChange={(e) => setExtractoRef(e.target.value)}
              placeholder="Línea del extracto bancario"
              className="min-w-[200px]"
            />
          </Card>

          {puedeConciliar && (
            <Card className="p-4 space-y-3">
              <p className="text-[12px] font-bold text-[#6b7280] uppercase">Importar extracto CSV</p>
              <div className="flex flex-wrap gap-3 items-end">
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(e) => setCsvFile(e.target.files?.[0] ?? null)}
                  className="text-[12px]"
                />
                <Button variant="secondary" size="sm" onClick={importarExtractoCsv} disabled={importandoCsv || !csvFile}>
                  {importandoCsv ? 'Importando…' : 'Vista previa'}
                </Button>
                {extractoMatches.length > 0 && (
                  <Button variant="primary" size="sm" onClick={aplicarConciliacionCsv}>
                    Aplicar seleccionados
                  </Button>
                )}
              </div>
              {extractoMatches.length > 0 && (
                <div className="overflow-x-auto border border-[#eef0f2] rounded-[8px]">
                  <table className="w-full text-[12px]">
                    <thead>
                      <tr className="bg-[#fafbfc]">
                        {['Extracto', 'Monto', 'Movimiento sugerido', 'Conf.', 'OK'].map((h) => (
                          <th key={h} className="px-3 py-2 text-left font-bold text-[#8a909a]">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {extractoMatches.map((m, idx) => (
                        <tr key={idx} className="border-t border-[#eef0f2]">
                          <td className="px-3 py-2">
                            {formatFecha(m.linea.fecha)} — {m.linea.descripcion}
                          </td>
                          <td className="px-3 py-2 font-semibold">{formatMonto(m.linea.montoSigned)}</td>
                          <td className="px-3 py-2">{m.movimientoDescripcion ?? '—'}</td>
                          <td className="px-3 py-2">{m.confianza}</td>
                          <td className="px-3 py-2">
                            {m.movimientoId && (
                              <input
                                type="checkbox"
                                checked={m.confirmado}
                                onChange={(e) =>
                                  setExtractoMatches((prev) =>
                                    prev.map((row, i) => (i === idx ? { ...row, confirmado: e.target.checked } : row)),
                                  )
                                }
                              />
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          )}

          <MovimientosTable
            movimientos={movimientos}
            loading={movLoading}
            showConciliar={puedeConciliar}
            conciliandoId={conciliandoId}
            onConciliar={conciliarMov}
          />
        </div>
      )}
    </div>
  )
}

function MovimientosTable({
  movimientos,
  loading,
  showConciliar,
  conciliandoId,
  onConciliar,
}: {
  movimientos: MovimientoRow[]
  loading: boolean
  showConciliar: boolean
  conciliandoId?: string | null
  onConciliar?: (id: string) => void
}) {
  return (
    <Card padding={false}>
      {loading ? (
        <p className="p-5 text-[12.5px] text-[#9aa1ab]">Cargando…</p>
      ) : movimientos.length === 0 ? (
        <p className="p-5 text-[12.5px] text-[#9aa1ab]">Sin movimientos</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                {['Fecha', 'Tipo', 'Descripción', 'Monto', 'Saldo', 'Conciliación', ...(showConciliar ? ['Acción'] : [])].map((h, i) => (
                  <th
                    key={h}
                    className={`px-5 py-2.5 text-[10px] font-bold text-[#8a909a] uppercase border-b whitespace-nowrap ${
                      i >= 3 ? 'text-right' : 'text-left'
                    }`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {movimientos.map((m, i) => (
                <tr key={m.id} className={i % 2 === 0 ? 'bg-white' : 'bg-[#fafbfc]'}>
                  <td className="px-5 py-3 text-[12.5px] text-[#6b7280] border-b whitespace-nowrap">
                    {formatFecha(m.fecha)}
                  </td>
                  <td className="px-5 py-3 text-[12.5px] text-[#6b7280] border-b whitespace-nowrap">
                    {TIPO_MOV_LABEL[m.tipo] ?? m.tipo}
                  </td>
                  <td className="px-5 py-3 text-[12.5px] text-[#3a4150] border-b">
                    {m.descripcion}
                    {m.pago?.cliente && (
                      <span className="text-[#9aa1ab]"> · {m.pago.cliente.nombre}</span>
                    )}
                    {m.pagoProveedor?.proveedor && (
                      <span className="block text-[11px] text-[#E8650A] mt-0.5">
                        Pago proveedor: {m.pagoProveedor.proveedor.razonSocial}
                        {' · '}
                        <Link href="/compras" className="font-semibold hover:underline">
                          Ver en compras
                        </Link>
                      </span>
                    )}
                  </td>
                  <td
                    className={`px-5 py-3 text-[12.5px] font-bold text-right border-b whitespace-nowrap ${
                      m.montoSigned >= 0 ? 'text-green-700' : 'text-red-600'
                    }`}
                  >
                    {formatMonto(m.montoSigned)}
                  </td>
                  <td className="px-5 py-3 text-[12.5px] text-right border-b whitespace-nowrap">
                    {m.saldoPosterior != null ? formatMonto(m.saldoPosterior) : '—'}
                  </td>
                  <td className="px-5 py-3 text-[12.5px] border-b whitespace-nowrap">
                    {m.conciliadoEn ? (
                      <span className="text-green-700 font-semibold" title={m.extractoRef ?? undefined}>
                        {formatFecha(m.conciliadoEn)}
                      </span>
                    ) : m.tipo === 'SALDO_INICIAL' ? (
                      <span className="text-[#9aa1ab]">—</span>
                    ) : (
                      <span className="text-[#9aa1ab]">Pendiente</span>
                    )}
                  </td>
                  {showConciliar && (
                    <td className="px-5 py-3 text-[12.5px] border-b whitespace-nowrap text-right">
                      {!m.conciliadoEn && m.tipo !== 'SALDO_INICIAL' && onConciliar && (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={conciliandoId === m.id}
                          onClick={() => onConciliar(m.id)}
                        >
                          Conciliar
                        </Button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}
