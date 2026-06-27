'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { formatFecha } from '@/lib/utils'
import { useCan } from '@/components/auth/useCan'
import { mensajeErrorDesconocido, mensajeErrorRespuesta } from '@/lib/errores'

type TabId = 'resumen' | 'datos' | 'componentes' | 'accesorios' | 'bitacora' | 'mantenimiento'

const TABS: { id: TabId; label: string }[] = [
  { id: 'resumen', label: 'Resumen' },
  { id: 'datos', label: 'Datos técnicos' },
  { id: 'componentes', label: 'Componentes y vencimientos' },
  { id: 'accesorios', label: 'Accesorios' },
  { id: 'bitacora', label: 'Bitácora' },
  { id: 'mantenimiento', label: 'Preventivo' },
]

const TIPO_COMPONENTE: Record<string, string> = {
  BATERIA: 'Batería',
  FILTRO: 'Filtro',
  CALIBRACION: 'Calibración',
  SENSOR: 'Sensor',
  OTRO: 'Otro',
}

const ESTADO_EQUIPO: Record<string, string> = {
  ACTIVO: 'Activo',
  EN_REPARACION: 'En reparación',
  BAJA: 'Baja',
}

export function HistoriaClinicaEquipo({ inicial }: { inicial: any }) {
  const router = useRouter()
  const puedeEditar = useCan('servicio.update')
  const [tab, setTab] = useState<TabId>('resumen')
  const [data, setData] = useState(inicial)
  const [saving, setSaving] = useState(false)
  const [sucursales, setSucursales] = useState<Array<{ id: string; nombre: string }>>([])

  const eq = data.equipo
  const clienteId = eq.clienteId ?? eq.cliente?.id

  useEffect(() => {
    if (!clienteId) return
    fetch(`/api/clientes/${clienteId}/sucursales`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : []))
      .then(setSucursales)
      .catch(() => setSucursales([]))
  }, [clienteId])

  const reload = useCallback(async () => {
    const res = await fetch(`/api/equipos/${eq.id}`)
    if (!res.ok) return
    setData(await res.json())
    router.refresh()
  }, [eq.id, router])

  async function guardarDatos(partial: Record<string, unknown>) {
    setSaving(true)
    try {
      const res = await fetch(`/api/equipos/${eq.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(partial),
      })
      if (!res.ok) throw new Error(await mensajeErrorRespuesta(res, 'No se pudieron guardar los datos del equipo'))
      toast.success('Datos guardados')
      await reload()
    } catch (e) {
      toast.error(mensajeErrorDesconocido(e, 'No se pudieron guardar los datos del equipo'))
    } finally {
      setSaving(false)
    }
  }

  async function agregarNota(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const titulo = String(fd.get('titulo') ?? '')
    const contenido = String(fd.get('contenido') ?? '')
    if (!titulo.trim()) return
    const res = await fetch(`/api/equipos/${eq.id}/notas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ titulo, contenido }),
    })
    if (res.ok) {
      toast.success('Nota agregada')
      ;(e.target as HTMLFormElement).reset()
      await reload()
    } else {
      toast.error(await mensajeErrorRespuesta(res, 'No se pudo guardar la nota'))
    }
  }

  async function agregarComponente(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const res = await fetch(`/api/equipos/${eq.id}/componentes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tipo: fd.get('tipo'),
        descripcion: fd.get('descripcion'),
        numeroSerie: fd.get('numeroSerie') || null,
        venceEn: fd.get('venceEn') || null,
        alertaDiasAntes: Number(fd.get('alertaDias') || 30),
      }),
    })
    if (res.ok) {
      toast.success('Componente registrado')
      ;(e.target as HTMLFormElement).reset()
      await reload()
    } else {
      toast.error(await mensajeErrorRespuesta(res, 'No se pudo registrar el componente'))
    }
  }

  async function agregarAccesorio(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const res = await fetch(`/api/equipos/${eq.id}/accesorios`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre: fd.get('nombre'),
        cantidad: Number(fd.get('cantidad') || 1),
        obligatorio: fd.get('obligatorio') === 'on',
      }),
    })
    if (res.ok) {
      toast.success('Accesorio agregado')
      ;(e.target as HTMLFormElement).reset()
      await reload()
    } else {
      toast.error(await mensajeErrorRespuesta(res, 'No se pudo agregar el accesorio'))
    }
  }

  const proximoComponente = eq.componentes?.find((c: any) => c.venceEn)
  const proximoPlan = eq.planes?.find((p: any) => p.proximoServicio)

  return (
    <div className="max-w-5xl flex flex-col gap-4">
      <Card className="bg-[#EFF6FF] border-[#93C5FD]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase text-[#1D4ED8] tracking-wide">Historia clínica del equipo</p>
            <h2 className="text-[18px] font-extrabold text-[#16181d] mt-1">{eq.nombre}</h2>
            <p className="text-[12.5px] text-[#4B5563] mt-1">
              {eq.marca} {eq.modeloExacto || eq.modelo} · N° serie <span className="font-mono font-semibold">{eq.numeroSerie ?? '—'}</span>
            </p>
            <p className="text-[12px] text-[#6B7280] mt-1">
              Cliente:{' '}
              <Link href={`/clientes/${eq.cliente.id}`} className="text-[#E8650A] font-semibold hover:underline">
                {eq.cliente.nombre}
              </Link>
              {eq.cliente.ciudad ? ` · ${eq.cliente.ciudad}` : ''}
            </p>
          </div>
          <div className="text-right">
            <span className="inline-block px-2.5 py-1 rounded-full text-[11px] font-bold bg-white border border-[#e4e7eb]">
              {ESTADO_EQUIPO[eq.estado] ?? eq.estado}
            </span>
            {eq.servicioInstalacion && (
              <p className="text-[12px] text-[#6B7280] mt-2">{eq.servicioInstalacion}{eq.pisoSala ? ` · ${eq.pisoSala}` : ''}</p>
            )}
          </div>
        </div>
      </Card>

      <div className="flex flex-wrap gap-2 border-b border-[#e4e7eb] pb-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-3 py-2 rounded-[8px] text-[12px] font-semibold transition-colors ${
              tab === t.id ? 'bg-[#E8650A] text-white' : 'bg-white text-[#3a4150] border border-[#e4e7eb] hover:border-[#E8650A]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'resumen' && (
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <h3 className="text-[13px] font-bold mb-3">Próximas acciones</h3>
            <ul className="text-[12.5px] space-y-2 text-[#4B5563]">
              <li>
                <span className="font-semibold text-[#16181d]">Preventivo:</span>{' '}
                {proximoPlan?.proximoServicio ? formatFecha(proximoPlan.proximoServicio) : 'Sin plan'}
              </li>
              <li>
                <span className="font-semibold text-[#16181d]">Componente por vencer:</span>{' '}
                {proximoComponente?.venceEn
                  ? `${proximoComponente.descripcion} — ${formatFecha(proximoComponente.venceEn)}`
                  : 'Ninguno registrado'}
              </li>
              <li>
                <span className="font-semibold text-[#16181d]">Garantía:</span>{' '}
                {eq.garantiaHasta ? formatFecha(eq.garantiaHasta) : '—'}
              </li>
              <li>
                <span className="font-semibold text-[#16181d]">Software:</span> {eq.softwareVersion ?? '—'}
              </li>
            </ul>
          </Card>
          <Card>
            <h3 className="text-[13px] font-bold mb-3">Instalación y origen</h3>
            <ul className="text-[12.5px] space-y-2 text-[#4B5563]">
              <li><span className="font-semibold">Instalado:</span> {eq.fechaInstalacion ? formatFecha(eq.fechaInstalacion) : '—'}</li>
              <li><span className="font-semibold">Ubicación:</span> {eq.direccionUbicacion ?? '—'}</li>
              <li><span className="font-semibold">Responsable:</span> {eq.contactoResponsable ?? '—'}</li>
              {eq.itemFacturaOrigen?.factura ? (
                <>
                  <li>
                    <span className="font-semibold">Venta (factura):</span>{' '}
                    <Link href={`/facturacion?highlight=${eq.itemFacturaOrigen.factura.id}`} className="text-[#E8650A] font-semibold hover:underline">
                      {eq.itemFacturaOrigen.factura.numero}
                    </Link>
                    {' '}· {formatFecha(eq.itemFacturaOrigen.factura.fechaEmision)}
                  </li>
                  <li><span className="font-semibold">Comprador:</span> {eq.itemFacturaOrigen.factura.cliente.nombre}</li>
                </>
              ) : (
                <>
                  <li><span className="font-semibold">Proveedor origen:</span> {eq.proveedorOrigen?.razonSocial ?? '—'}</li>
                  <li><span className="font-semibold">Ref. compra:</span> {eq.referenciaCompra ?? '—'}</li>
                </>
              )}
            </ul>
          </Card>
          <Card className="col-span-2">
            <h3 className="text-[13px] font-bold mb-3">Últimas OTs</h3>
            {eq.ots?.length ? (
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="text-[10px] uppercase text-[#8a909a]">
                    <th className="text-left pb-2">N° OT</th>
                    <th className="text-left pb-2">Descripción</th>
                    <th className="text-left pb-2">Estado</th>
                    <th className="text-left pb-2">Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {eq.ots.map((ot: any) => (
                    <tr key={ot.id} className="border-t border-[#f4f5f7]">
                      <td className="py-2">
                        <Link href={`/servicio-tecnico/${ot.id}`} className="text-[#E8650A] font-semibold hover:underline">{ot.numero}</Link>
                      </td>
                      <td className="py-2">{ot.descripcion.slice(0, 60)}</td>
                      <td className="py-2">{ot.estado}</td>
                      <td className="py-2">{formatFecha(ot.fechaApertura)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-[12.5px] text-[#9aa1ab]">Sin órdenes de trabajo</p>
            )}
          </Card>
        </div>
      )}

      {tab === 'datos' && (
        <Card>
          <h3 className="text-[13px] font-bold mb-4">Datos técnicos e instalación</h3>
          {puedeEditar ? (
            <div className="grid grid-cols-2 gap-4">
              <Input label="Modelo exacto" defaultValue={eq.modeloExacto ?? ''} onBlur={(e) => guardarDatos({ modeloExacto: e.target.value || null })} />
              <Input label="Código interno" defaultValue={eq.codigoInterno ?? ''} onBlur={(e) => guardarDatos({ codigoInterno: e.target.value || null })} />
              <Input label="Versión firmware" defaultValue={eq.firmwareVersion ?? ''} onBlur={(e) => guardarDatos({ firmwareVersion: e.target.value || null })} />
              <Input label="Versión software" defaultValue={eq.softwareVersion ?? ''} onBlur={(e) => guardarDatos({ softwareVersion: e.target.value || null })} />
              <Input label="Servicio / área" defaultValue={eq.servicioInstalacion ?? ''} onBlur={(e) => guardarDatos({ servicioInstalacion: e.target.value || null })} />
              <Input label="Piso / sala" defaultValue={eq.pisoSala ?? ''} onBlur={(e) => guardarDatos({ pisoSala: e.target.value || null })} />
              <Input label="Contacto responsable" defaultValue={eq.contactoResponsable ?? ''} onBlur={(e) => guardarDatos({ contactoResponsable: e.target.value || null })} />
              <Input label="Referencia de compra" defaultValue={eq.referenciaCompra ?? ''} onBlur={(e) => guardarDatos({ referenciaCompra: e.target.value || null })} />
              <Select
                label="Sucursal de instalación"
                className="col-span-2"
                value={eq.sucursalId ?? ''}
                onChange={(e) => guardarDatos({ sucursalId: e.target.value || null })}
                disabled={!puedeEditar}
                placeholder="Usar dirección fiscal del cliente"
                options={sucursales.map((s) => ({ value: s.id, label: s.nombre }))}
              />
              <Input
                label="Dirección de instalación (detalle)"
                className="col-span-2"
                defaultValue={eq.direccionUbicacion ?? ''}
                onBlur={(e) => guardarDatos({ direccionUbicacion: e.target.value || null })}
                placeholder="Ej. Piso 3 · UTI · acceso por calle lateral"
              />
              <label className="col-span-2 text-[13px]">
                Notas técnicas
                <textarea
                  className="mt-1 w-full border border-[#e4e7eb] rounded-lg px-3 py-2 text-[13px] min-h-[80px]"
                  defaultValue={eq.notasTecnicas ?? ''}
                  onBlur={(e) => guardarDatos({ notasTecnicas: e.target.value || null })}
                />
              </label>
            </div>
          ) : (
            <p className="text-[12.5px] text-[#6B7280]">Solo lectura — sin permiso de edición.</p>
          )}
          {saving && <p className="text-[11px] text-[#9aa1ab] mt-2">Guardando…</p>}
        </Card>
      )}

      {tab === 'componentes' && (
        <div className="flex flex-col gap-4">
          <Card padding={false}>
            <div className="px-5 py-3 border-b font-bold text-[13px]">Componentes con vencimiento</div>
            <table className="w-full text-[12px]">
              <thead>
                <tr className="text-[10px] uppercase text-[#8a909a]">
                  <th className="text-left px-5 py-2">Tipo</th>
                  <th className="text-left px-5 py-2">Descripción</th>
                  <th className="text-left px-5 py-2">N° serie</th>
                  <th className="text-left px-5 py-2">Vence</th>
                </tr>
              </thead>
              <tbody>
                {eq.componentes?.length ? eq.componentes.map((c: any) => (
                  <tr key={c.id} className="border-t border-[#f4f5f7]">
                    <td className="px-5 py-2">{TIPO_COMPONENTE[c.tipo] ?? c.tipo}</td>
                    <td className="px-5 py-2 font-semibold">{c.descripcion}</td>
                    <td className="px-5 py-2 font-mono">{c.numeroSerie ?? '—'}</td>
                    <td className="px-5 py-2">{c.venceEn ? formatFecha(c.venceEn) : '—'}</td>
                  </tr>
                )) : (
                  <tr><td colSpan={4} className="px-5 py-8 text-center text-[#9aa1ab]">Sin componentes — agregá baterías, filtros o calibraciones</td></tr>
                )}
              </tbody>
            </table>
          </Card>
          {puedeEditar && (
            <Card>
              <h3 className="text-[13px] font-bold mb-3">Registrar componente</h3>
              <form onSubmit={agregarComponente} className="grid grid-cols-2 gap-3">
                <label className="text-[12px]">
                  Tipo
                  <select name="tipo" className="mt-1 w-full border rounded-lg px-2 py-2 text-[13px]">
                    {Object.entries(TIPO_COMPONENTE).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </label>
                <Input label="Descripción" name="descripcion" required />
                <Input label="N° serie (opcional)" name="numeroSerie" />
                <Input label="Vence el" name="venceEn" type="date" />
                <Input label="Alerta (días antes)" name="alertaDias" type="number" defaultValue="30" />
                <div className="col-span-2">
                  <Button type="submit" variant="primary" size="sm">Agregar componente</Button>
                </div>
              </form>
            </Card>
          )}
        </div>
      )}

      {tab === 'accesorios' && (
        <div className="flex flex-col gap-4">
          <Card padding={false}>
            <table className="w-full text-[12px]">
              <thead>
                <tr className="text-[10px] uppercase text-[#8a909a]">
                  <th className="text-left px-5 py-2">Accesorio</th>
                  <th className="text-right px-5 py-2">Cant.</th>
                  <th className="text-right px-5 py-2">Obligatorio</th>
                </tr>
              </thead>
              <tbody>
                {eq.accesorios?.length ? eq.accesorios.map((a: any) => (
                  <tr key={a.id} className="border-t border-[#f4f5f7]">
                    <td className="px-5 py-2 font-semibold">{a.nombre}{a.inventario?.sku ? ` (${a.inventario.sku})` : ''}</td>
                    <td className="px-5 py-2 text-right">{a.cantidad}</td>
                    <td className="px-5 py-2 text-right">{a.obligatorio ? 'Sí' : 'No'}</td>
                  </tr>
                )) : (
                  <tr><td colSpan={3} className="px-5 py-8 text-center text-[#9aa1ab]">Sin accesorios registrados</td></tr>
                )}
              </tbody>
            </table>
          </Card>
          {puedeEditar && (
            <Card>
              <form onSubmit={agregarAccesorio} className="flex flex-wrap gap-3 items-end">
                <Input label="Nombre del accesorio" name="nombre" required className="flex-1 min-w-[200px]" />
                <Input label="Cantidad" name="cantidad" type="number" defaultValue="1" className="w-24" />
                <label className="flex items-center gap-2 text-[13px] pb-2">
                  <input type="checkbox" name="obligatorio" defaultChecked /> Obligatorio
                </label>
                <Button type="submit" variant="primary" size="sm">Agregar</Button>
              </form>
            </Card>
          )}
        </div>
      )}

      {tab === 'bitacora' && (
        <div className="flex flex-col gap-4">
          <Card padding={false}>
            <div className="px-5 py-3 border-b font-bold text-[13px]">Línea de tiempo</div>
            <div className="divide-y divide-[#f4f5f7] max-h-[480px] overflow-y-auto">
              {data.bitacora?.length ? data.bitacora.map((b: any) => (
                <div key={b.id} className="px-5 py-3">
                  <div className="flex justify-between gap-2">
                    <p className="text-[13px] font-semibold text-[#16181d]">{b.titulo}</p>
                    <span className="text-[11px] text-[#9aa1ab] shrink-0">{formatFecha(b.fecha)}</span>
                  </div>
                  <p className="text-[11px] text-[#E8650A] font-medium mt-0.5">{b.tipo} · {b.origen}</p>
                  {b.contenido && <p className="text-[12px] text-[#6B7280] mt-1">{b.contenido}</p>}
                  {b.usuarioNombre && <p className="text-[11px] text-[#9aa1ab] mt-1">{b.usuarioNombre}</p>}
                </div>
              )) : (
                <p className="p-6 text-[12.5px] text-[#9aa1ab]">Sin eventos en la bitácora</p>
              )}
            </div>
          </Card>
          {puedeEditar && (
            <Card>
              <h3 className="text-[13px] font-bold mb-3">Agregar nota</h3>
              <form onSubmit={agregarNota} className="flex flex-col gap-3">
                <Input label="Título" name="titulo" required />
                <label className="text-[13px]">
                  Detalle
                  <textarea name="contenido" className="mt-1 w-full border border-[#e4e7eb] rounded-lg px-3 py-2 text-[13px] min-h-[72px]" />
                </label>
                <Button type="submit" variant="primary" size="sm">Guardar nota</Button>
              </form>
            </Card>
          )}
        </div>
      )}

      {tab === 'mantenimiento' && (
        <Card padding={false}>
          <div className="px-5 py-3 border-b font-bold text-[13px]">Planes de mantenimiento preventivo</div>
          <table className="w-full text-[12px]">
            <thead>
              <tr className="text-[10px] uppercase text-[#8a909a]">
                <th className="text-left px-5 py-2">Descripción</th>
                <th className="text-right px-5 py-2">Intervalo</th>
                <th className="text-right px-5 py-2">Próximo</th>
                <th className="text-right px-5 py-2">Estado</th>
              </tr>
            </thead>
            <tbody>
              {eq.planes?.length ? eq.planes.map((p: any) => (
                <tr key={p.id} className="border-t border-[#f4f5f7]">
                  <td className="px-5 py-2 font-semibold">{p.descripcion}</td>
                  <td className="px-5 py-2 text-right">{p.intervaloDias} días</td>
                  <td className="px-5 py-2 text-right">{p.proximoServicio ? formatFecha(p.proximoServicio) : '—'}</td>
                  <td className="px-5 py-2 text-right">{p.estado}</td>
                </tr>
              )) : (
                <tr><td colSpan={4} className="px-5 py-8 text-center text-[#9aa1ab]">
                  Sin plan —{' '}
                  <Link href="/servicio-tecnico/preventivo" className="text-[#E8650A] font-semibold hover:underline">agendar en Preventivo</Link>
                </td></tr>
              )}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  )
}
