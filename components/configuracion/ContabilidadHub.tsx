'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AlicuotasIvaManager } from '@/components/configuracion/AlicuotasIvaManager'
import type { ContabilidadResumen } from '@/lib/contabilidad/types'
import { mensajeErrorDesconocido, mensajeErrorJson } from '@/lib/errores'

type TabId = 'empresa' | 'iva' | 'retenciones' | 'iibb' | 'plan' | 'comercial' | 'afip'

const TABS: { id: TabId; label: string }[] = [
  { id: 'empresa', label: 'Empresa y ejercicio' },
  { id: 'iva', label: 'IVA' },
  { id: 'retenciones', label: 'Retenciones y percepciones' },
  { id: 'iibb', label: 'Ingresos brutos' },
  { id: 'plan', label: 'Plan de cuentas' },
  { id: 'comercial', label: 'Condiciones comerciales' },
  { id: 'afip', label: 'AFIP / Comprobantes' },
]

const TIPO_REGIMEN_LABEL: Record<string, string> = {
  RET_GAN: 'Ret. Ganancias',
  RET_IVA: 'Ret. IVA',
  PERC_IVA: 'Perc. IVA',
  RET_IIBB: 'Ret. IIBB',
  PERC_IIBB: 'Perc. IIBB',
  RET_SUSS: 'Ret. SUSS',
}

function EmptyRow({ cols, msg }: { cols: number; msg: string }) {
  return (
    <tr>
      <td colSpan={cols} className="py-6 text-center text-[#9aa1ab] text-[12.5px]">
        {msg}
      </td>
    </tr>
  )
}

function esResumenValido(v: unknown): v is ContabilidadResumen {
  return Boolean(v && typeof v === 'object' && 'alicuotas' in v && Array.isArray((v as ContabilidadResumen).alicuotas))
}

export function ContabilidadHub({ inicial }: { inicial: ContabilidadResumen }) {
  const router = useRouter()
  const [tab, setTab] = useState<TabId>('empresa')
  const [data, setData] = useState<ContabilidadResumen>(inicial)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [nuevoRegimen, setNuevoRegimen] = useState({ codigo: '', nombre: '', tipo: 'RET_GAN', alicuota: '2' })
  const [nuevaCondPago, setNuevaCondPago] = useState({ codigo: '', nombre: '', diasPlazo: '30' })
  const [nuevaCuenta, setNuevaCuenta] = useState({ codigo: '', nombre: '', tipo: 'ACTIVO' })

  useEffect(() => {
    if (esResumenValido(inicial)) setData(inicial)
  }, [inicial])

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/contabilidad/resumen')
      const json = await res.json()
      if (!res.ok) throw new Error(mensajeErrorJson(json, 'No se pudo cargar la configuración contable'))
      if (!esResumenValido(json)) throw new Error('Respuesta inválida del servidor')
      setData(json)
    } catch (err) {
      toast.error(mensajeErrorDesconocido(err, 'No se pudo cargar la configuración contable'))
    } finally {
      setLoading(false)
    }
  }, [])

  async function restaurarCatalogos() {
    setLoading(true)
    try {
      const res = await fetch('/api/contabilidad/resumen', { method: 'POST' })
      const json = await res.json()
      if (!res.ok) throw new Error(mensajeErrorJson(json, 'No se pudieron restaurar los catálogos'))
      if (!esResumenValido(json)) throw new Error('Respuesta inválida del servidor')
      setData(json)
      toast.success('Catálogos Argentina restaurados')
      router.refresh()
    } catch (err) {
      toast.error(mensajeErrorDesconocido(err, 'No se pudieron restaurar los catálogos'))
    } finally {
      setLoading(false)
    }
  }

  async function guardarConfig(partial: Record<string, unknown>) {
    setSaving(true)
    try {
      const res = await fetch('/api/contabilidad/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(partial),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(mensajeErrorJson(json, 'No se pudo guardar la configuración contable'))
      setData((prev) => ({ ...prev, config: json }))
      toast.success('Configuración guardada')
    } catch (err) {
      toast.error(mensajeErrorDesconocido(err, 'No se pudo guardar la configuración contable'))
    } finally {
      setSaving(false)
    }
  }

  async function patchCatalogo(tipo: string, id: string, patch: Record<string, unknown>) {
    const res = await fetch('/api/contabilidad/catalogos', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo, id, data: patch }),
    })
    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      throw new Error(mensajeErrorJson(json, 'No se pudo actualizar el catálogo'))
    }
    await reload()
  }

  async function crearCatalogo(tipo: string, payload: Record<string, unknown>) {
    const res = await fetch('/api/contabilidad/catalogos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo, data: payload }),
    })
    const json = await res.json()
    if (!res.ok) throw new Error(mensajeErrorJson(json, 'No se pudo crear el registro contable'))
    toast.success('Registro creado')
    await reload()
    router.refresh()
  }

  const cfg = (data.config ?? {}) as Record<string, unknown>
  const counts = {
    alicuotas: data.alicuotas?.length ?? 0,
    condicionesIva: data.condicionesIva?.length ?? 0,
    regimenes: data.regimenes?.length ?? 0,
    comprobantes: data.comprobantesAfip?.length ?? 0,
  }
  const catalogosVacios = counts.alicuotas === 0 && counts.comprobantes === 0

  return (
    <div className="max-w-5xl flex flex-col gap-4">
      <Card className="bg-[#FFF7ED] border-[#FDBA74]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[13px] font-bold text-[#9A3412]">Panel contable — Argentina</p>
            <p className="text-[12px] text-[#C2410C] mt-1">
              IVA · IIBB · Retenciones · Plan de cuentas · AFIP. Configuración para Lucas (contador).
            </p>
            <p className="text-[11px] text-[#9A3412] mt-2 font-mono">
              {counts.alicuotas} alícuotas · {counts.condicionesIva} cond. IVA · {counts.regimenes} regímenes · {counts.comprobantes} comprobantes AFIP
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button variant="secondary" size="sm" loading={loading} onClick={() => reload()}>
              Recargar
            </Button>
            {catalogosVacios && (
              <Button size="sm" loading={loading} onClick={() => restaurarCatalogos()}>
                Cargar catálogos default
              </Button>
            )}
          </div>
        </div>
      </Card>

      {catalogosVacios && (
        <Card className="border-amber-300 bg-amber-50">
          <p className="text-[13px] text-amber-900 font-semibold">Los catálogos están vacíos</p>
          <p className="text-[12px] text-amber-800 mt-1">
            Hacé clic en &quot;Cargar catálogos default&quot; para sembrar alícuotas, condiciones IVA, regímenes y comprobantes AFIP de Argentina.
          </p>
        </Card>
      )}

      <div className="flex flex-wrap gap-2 border-b border-[#e4e7eb] pb-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-3 py-2 rounded-[8px] text-[12px] font-semibold transition-colors ${
              tab === t.id
                ? 'bg-[#E8650A] text-white'
                : 'bg-white text-[#3a4150] border border-[#e4e7eb] hover:border-[#E8650A]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'empresa' && (
        <Card>
          <h3 className="text-[13.5px] font-bold mb-4">Parámetros generales</h3>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Moneda funcional" value={String(cfg.monedaFuncional ?? 'ARS')} readOnly />
            <Input
              label="Cotización USD manual (opcional)"
              type="number"
              defaultValue={cfg.cotizacionUsdManual != null ? String(cfg.cotizacionUsdManual) : ''}
              onBlur={(e) => guardarConfig({ cotizacionUsdManual: e.target.value ? Number(e.target.value) : null })}
            />
            <label className="flex items-center gap-2 text-[13px] col-span-2">
              <input
                type="checkbox"
                defaultChecked={cfg.usaCotizacionBna !== false}
                onChange={(e) => guardarConfig({ usaCotizacionBna: e.target.checked })}
              />
              Usar cotización BNA (Banco Nación) como referencia
            </label>
            <div className="col-span-2 flex flex-col gap-1.5">
              <label className="text-[11.5px] font-semibold text-[#5b626d] uppercase">Ejercicio contable activo</label>
              <select
                className="border border-[#e4e7eb] rounded-[9px] px-3 py-2.5 text-[13px]"
                value={String(cfg.ejercicioActivoId ?? '')}
                onChange={(e) => guardarConfig({ ejercicioActivoId: e.target.value || null })}
              >
                <option value="">Seleccionar…</option>
                {data.ejercicios?.map((ej) => (
                  <option key={ej.id} value={ej.id}>{ej.nombre} {ej.cerrado ? '(cerrado)' : ''}</option>
                ))}
              </select>
            </div>
            <div className="col-span-2 flex flex-col gap-1.5">
              <label className="text-[11.5px] font-semibold text-[#5b626d] uppercase">Notas del contador</label>
              <textarea
                rows={3}
                defaultValue={String(cfg.notasContador ?? '')}
                className="border border-[#e4e7eb] rounded-[9px] px-3 py-2.5 text-[13px] resize-none"
                placeholder="Observaciones internas, criterios contables, referencias RG…"
                onBlur={(e) => guardarConfig({ notasContador: e.target.value || null })}
              />
            </div>
          </div>
          <div className="mt-4 pt-4 border-t">
            <h4 className="text-[12px] font-bold text-[#8a909a] uppercase mb-3">Libro IVA</h4>
            <div className="grid grid-cols-2 gap-4">
              <label className="flex items-center gap-2 text-[13px]">
                <input type="checkbox" defaultChecked={cfg.libroIvaDigital !== false} onChange={(e) => guardarConfig({ libroIvaDigital: e.target.checked })} />
                Libro IVA digital (AFIP)
              </label>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11.5px] font-semibold text-[#5b626d] uppercase">Periodicidad IVA</label>
                <select
                  className="border rounded-[9px] px-3 py-2.5 text-[13px]"
                  value={String(cfg.periodicidadIva ?? 'MENSUAL')}
                  onChange={(e) => guardarConfig({ periodicidadIva: e.target.value })}
                >
                  <option value="MENSUAL">Mensual</option>
                  <option value="BIMESTRAL">Bimestral</option>
                </select>
              </div>
              <Input
                label="Día de cierre interno IVA"
                type="number"
                min={1}
                max={28}
                defaultValue={String(cfg.cierreIvaDia ?? 20)}
                onBlur={(e) => guardarConfig({ cierreIvaDia: Number(e.target.value) })}
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <Button loading={saving} onClick={() => toast.success('Los cambios se guardan al salir de cada campo')}>
              Guardado automático
            </Button>
          </div>
        </Card>
      )}

      {tab === 'iva' && (
        <div className="flex flex-col gap-4">
          <AlicuotasIvaManager inicial={data.alicuotas ?? []} />
          <Card>
            <h3 className="text-[13.5px] font-bold mb-3">Condiciones ante el IVA (clientes/proveedores)</h3>
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="text-[10px] uppercase text-[#8a909a]">
                  <th className="text-left pb-2">Código</th>
                  <th className="text-left pb-2">Nombre</th>
                  <th className="text-left pb-2">Alícuota sugerida</th>
                  <th className="text-left pb-2">CUIT</th>
                </tr>
              </thead>
              <tbody>
                {(data.condicionesIva?.length ?? 0) === 0 ? (
                  <EmptyRow cols={4} msg="Sin condiciones IVA. Usá «Cargar catálogos default» arriba." />
                ) : (
                  data.condicionesIva.map((c) => (
                    <tr key={c.id} className="border-t border-[#f4f5f7]">
                      <td className="py-2 font-mono">{c.codigo}</td>
                      <td className="py-2">
                        <div className="font-semibold">{c.nombre}</div>
                        {c.descripcion && <div className="text-[11px] text-[#9aa1ab]">{c.descripcion}</div>}
                      </td>
                      <td className="py-2">{c.alicuotaIva ? `${c.alicuotaIva.porcentaje}%` : '—'}</td>
                      <td className="py-2">{c.requiereCuit ? 'Obligatorio' : 'Opcional'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </Card>
        </div>
      )}

      {tab === 'retenciones' && (
        <div className="flex flex-col gap-4">
          <Card padding={false}>
            <div className="px-5 py-4 border-b">
              <h3 className="text-[13.5px] font-bold">Agentes de retención y percepción</h3>
              <div className="grid grid-cols-2 gap-3 mt-3">
                {(
                  [
                    ['agenteRetencionGanancias', 'Agente retención Ganancias'],
                    ['agenteRetencionIva', 'Agente retención IVA'],
                    ['agentePercepcionIva', 'Agente percepción IVA'],
                    ['agenteRetencionIibb', 'Agente retención IIBB'],
                    ['agentePercepcionIibb', 'Agente percepción IIBB'],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2 text-[12.5px]">
                    <input
                      type="checkbox"
                      checked={Boolean(cfg[key])}
                      onChange={(e) => guardarConfig({ [key]: e.target.checked })}
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="text-[10px] uppercase text-[#8a909a]">
                  <th className="text-left px-5 py-2">Régimen</th>
                  <th className="text-left px-5 py-2">Tipo</th>
                  <th className="text-right px-5 py-2">Alícuota</th>
                  <th className="text-right px-5 py-2">Mín. no imp.</th>
                  <th className="text-right px-5 py-2">Activo</th>
                </tr>
              </thead>
              <tbody>
                {(data.regimenes?.length ?? 0) === 0 ? (
                  <EmptyRow cols={5} msg="Sin regímenes impositivos cargados." />
                ) : (
                  data.regimenes.map((r) => (
                    <tr key={r.id} className="border-t border-[#f4f5f7]">
                      <td className="px-5 py-3">
                        <div className="font-semibold">{r.nombre}</div>
                        <div className="text-[10px] font-mono text-[#9aa1ab]">{r.codigo}</div>
                      </td>
                      <td className="px-5 py-3">{TIPO_REGIMEN_LABEL[r.tipo] ?? r.tipo}</td>
                      <td className="px-5 py-3 text-right font-bold">{r.alicuota}%</td>
                      <td className="px-5 py-3 text-right">{r.minimoNoImponible > 0 ? `$${r.minimoNoImponible.toLocaleString('es-AR')}` : '—'}</td>
                      <td className="px-5 py-3 text-right">
                        <input
                          type="checkbox"
                          checked={r.activo}
                          onChange={(e) => patchCatalogo('regimen', r.id, { activo: e.target.checked }).catch((err) => toast.error(mensajeErrorDesconocido(err, 'No se pudo actualizar el régimen')))}
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </Card>
          <Card>
            <h3 className="text-[13px] font-bold mb-3">Agregar régimen impositivo</h3>
            <div className="grid grid-cols-4 gap-3">
              <Input label="Código" value={nuevoRegimen.codigo} onChange={(e) => setNuevoRegimen({ ...nuevoRegimen, codigo: e.target.value.toUpperCase() })} />
              <Input label="Nombre" value={nuevoRegimen.nombre} onChange={(e) => setNuevoRegimen({ ...nuevoRegimen, nombre: e.target.value })} />
              <div className="flex flex-col gap-1.5">
                <label className="text-[11.5px] font-semibold text-[#5b626d] uppercase">Tipo</label>
                <select className="border rounded-[9px] px-3 py-2.5 text-[13px]" value={nuevoRegimen.tipo} onChange={(e) => setNuevoRegimen({ ...nuevoRegimen, tipo: e.target.value })}>
                  {Object.entries(TIPO_REGIMEN_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <Input label="Alícuota %" type="number" value={nuevoRegimen.alicuota} onChange={(e) => setNuevoRegimen({ ...nuevoRegimen, alicuota: e.target.value })} />
            </div>
            <div className="mt-3 flex justify-end">
              <Button
                onClick={() => crearCatalogo('regimen', { ...nuevoRegimen, alicuota: Number(nuevoRegimen.alicuota) }).catch((e) => toast.error(mensajeErrorDesconocido(e, 'No se pudo crear el régimen')))}
                disabled={!nuevoRegimen.codigo || !nuevoRegimen.nombre}
              >
                Agregar régimen
              </Button>
            </div>
          </Card>
        </div>
      )}

      {tab === 'iibb' && (
        <Card>
          <h3 className="text-[13.5px] font-bold mb-3">Ingresos brutos</h3>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <label className="flex items-center gap-2 text-[13px]">
              <input type="checkbox" checked={Boolean(cfg.inscriptoIibb)} onChange={(e) => guardarConfig({ inscriptoIibb: e.target.checked })} />
              Empresa inscripta en IIBB
            </label>
            <label className="flex items-center gap-2 text-[13px]">
              <input type="checkbox" checked={Boolean(cfg.convenioMultilateralIibb)} onChange={(e) => guardarConfig({ convenioMultilateralIibb: e.target.checked })} />
              Adherida a Convenio Multilateral (SIRCAR)
            </label>
            <Input
              label="N° inscripción IIBB"
              defaultValue={String(cfg.numeroInscripcionIibb ?? '')}
              onBlur={(e) => guardarConfig({ numeroInscripcionIibb: e.target.value || null })}
            />
          </div>
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="text-[10px] uppercase text-[#8a909a]">
                <th className="text-left pb-2">Jurisdicción</th>
                <th className="text-left pb-2">Provincia</th>
                <th className="text-right pb-2">Alícuota ref.</th>
                <th className="text-right pb-2">CM</th>
              </tr>
            </thead>
            <tbody>
              {(data.jurisdicciones?.length ?? 0) === 0 ? (
                <EmptyRow cols={4} msg="Sin jurisdicciones IIBB cargadas." />
              ) : (
                data.jurisdicciones.map((j) => (
                  <tr key={j.id} className="border-t border-[#f4f5f7]">
                    <td className="py-2 font-semibold">{j.nombre}</td>
                    <td className="py-2">{j.provincia}</td>
                    <td className="py-2 text-right">{j.alicuotaGeneral != null ? `${j.alicuotaGeneral}%` : '—'}</td>
                    <td className="py-2 text-right">{j.convenioMultilateral ? 'Sí' : 'No'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </Card>
      )}

      {tab === 'plan' && (
        <div className="flex flex-col gap-4">
          <Card padding={false}>
            <div className="px-5 py-3 border-b font-bold text-[13px]">Plan de cuentas (estructura macro)</div>
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="text-[10px] uppercase text-[#8a909a]">
                  <th className="text-left px-5 py-2">Código</th>
                  <th className="text-left px-5 py-2">Cuenta</th>
                  <th className="text-left px-5 py-2">Tipo</th>
                  <th className="text-right px-5 py-2">Imputable</th>
                </tr>
              </thead>
              <tbody>
                {(data.planCuentas?.length ?? 0) === 0 ? (
                  <EmptyRow cols={4} msg="Sin cuentas en el plan. Cargá los defaults o agregá una abajo." />
                ) : (
                  data.planCuentas.map((c) => (
                    <tr key={c.id} className="border-t border-[#f4f5f7]">
                      <td className="px-5 py-2 font-mono" style={{ paddingLeft: 12 + (c.nivel - 1) * 16 }}>{c.codigo}</td>
                      <td className="px-5 py-2 font-semibold">{c.nombre}</td>
                      <td className="px-5 py-2 text-[#6b7280]">{c.tipo}</td>
                      <td className="px-5 py-2 text-right">{c.aceptaImputacion ? 'Sí' : '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </Card>
          <Card>
            <h3 className="text-[13px] font-bold mb-3">Agregar cuenta</h3>
            <div className="grid grid-cols-3 gap-3">
              <Input label="Código" value={nuevaCuenta.codigo} onChange={(e) => setNuevaCuenta({ ...nuevaCuenta, codigo: e.target.value })} placeholder="4.3" />
              <Input label="Nombre" value={nuevaCuenta.nombre} onChange={(e) => setNuevaCuenta({ ...nuevaCuenta, nombre: e.target.value })} />
              <div className="flex flex-col gap-1.5">
                <label className="text-[11.5px] font-semibold text-[#5b626d] uppercase">Tipo</label>
                <select className="border rounded-[9px] px-3 py-2.5 text-[13px]" value={nuevaCuenta.tipo} onChange={(e) => setNuevaCuenta({ ...nuevaCuenta, tipo: e.target.value })}>
                  {['ACTIVO', 'PASIVO', 'PATRIMONIO', 'INGRESO', 'EGRESO'].map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <div className="mt-3 flex justify-end">
              <Button
                onClick={() => crearCatalogo('plan_cuenta', { ...nuevaCuenta, nivel: nuevaCuenta.codigo.split('.').length, aceptaImputacion: true }).catch((e) => toast.error(mensajeErrorDesconocido(e, 'No se pudo crear la cuenta')))}
                disabled={!nuevaCuenta.codigo || !nuevaCuenta.nombre}
              >
                Agregar cuenta
              </Button>
            </div>
          </Card>
        </div>
      )}

      {tab === 'comercial' && (
        <div className="flex flex-col gap-4">
          <Card>
            <h3 className="text-[13.5px] font-bold mb-3">Condiciones de pago</h3>
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="text-[10px] uppercase text-[#8a909a]">
                  <th className="text-left pb-2">Código</th>
                  <th className="text-left pb-2">Nombre</th>
                  <th className="text-right pb-2">Días</th>
                  <th className="text-left pb-2">Plazos cobranza</th>
                </tr>
              </thead>
              <tbody>
                {(data.condicionesPago?.length ?? 0) === 0 ? (
                  <EmptyRow cols={4} msg="Sin condiciones de pago." />
                ) : (
                  data.condicionesPago.map((cp) => (
                    <tr key={cp.id} className="border-t border-[#f4f5f7]">
                      <td className="py-2 font-mono">{cp.codigo}</td>
                      <td className="py-2 font-semibold">{cp.nombre} {cp.esDefault && <span className="text-[10px] text-green-700">(default)</span>}</td>
                      <td className="py-2 text-right">{cp.diasPlazo}</td>
                      <td className="py-2">{cp.plazosCobranza ?? '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </Card>
          <Card>
            <h3 className="text-[13px] font-bold mb-3">Agregar condición de pago</h3>
            <div className="grid grid-cols-3 gap-3">
              <Input label="Código" value={nuevaCondPago.codigo} onChange={(e) => setNuevaCondPago({ ...nuevaCondPago, codigo: e.target.value.toUpperCase() })} />
              <Input label="Nombre" value={nuevaCondPago.nombre} onChange={(e) => setNuevaCondPago({ ...nuevaCondPago, nombre: e.target.value })} />
              <Input label="Días plazo" type="number" value={nuevaCondPago.diasPlazo} onChange={(e) => setNuevaCondPago({ ...nuevaCondPago, diasPlazo: e.target.value })} />
            </div>
            <div className="mt-3 flex justify-end">
              <Button
                onClick={() => crearCatalogo('condicion_pago', { ...nuevaCondPago, diasPlazo: Number(nuevaCondPago.diasPlazo) }).catch((e) => toast.error(mensajeErrorDesconocido(e, 'No se pudo crear la condición de pago')))}
                disabled={!nuevaCondPago.codigo || !nuevaCondPago.nombre}
              >
                Agregar condición
              </Button>
            </div>
          </Card>
        </div>
      )}

      {tab === 'afip' && (
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <h3 className="text-[13.5px] font-bold mb-3">Tipos de comprobante AFIP</h3>
            <table className="w-full text-[12px]">
              <thead>
                <tr className="text-[10px] uppercase text-[#8a909a]">
                  <th className="text-left pb-2">Cód.</th>
                  <th className="text-left pb-2">Letra</th>
                  <th className="text-left pb-2">Descripción</th>
                </tr>
              </thead>
              <tbody>
                {(data.comprobantesAfip?.length ?? 0) === 0 ? (
                  <EmptyRow cols={3} msg="Sin comprobantes. Usá «Cargar catálogos default»." />
                ) : (
                  data.comprobantesAfip.map((t) => (
                    <tr key={t.id} className="border-t border-[#f4f5f7]">
                      <td className="py-2 font-mono w-12">{t.codigoAfip}</td>
                      <td className="py-2 font-bold w-8">{t.letra}</td>
                      <td className="py-2">{t.descripcion}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </Card>
          <Card>
            <h3 className="text-[13.5px] font-bold mb-3">Tipos de documento receptor</h3>
            <table className="w-full text-[12px]">
              <thead>
                <tr className="text-[10px] uppercase text-[#8a909a]">
                  <th className="text-left pb-2">Cód.</th>
                  <th className="text-left pb-2">Tipo</th>
                </tr>
              </thead>
              <tbody>
                {(data.tiposDocumento?.length ?? 0) === 0 ? (
                  <EmptyRow cols={2} msg="Sin tipos de documento." />
                ) : (
                  data.tiposDocumento.map((d) => (
                    <tr key={d.id} className="border-t border-[#f4f5f7]">
                      <td className="py-2 font-mono w-12">{d.codigoAfip}</td>
                      <td className="py-2">{d.nombre}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </Card>
        </div>
      )}
    </div>
  )
}
