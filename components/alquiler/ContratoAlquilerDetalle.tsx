'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { ArrowLeft, Play, Receipt, Pause, RotateCcw, XCircle, PackageX, MapPin, CheckCircle2, AlertCircle } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatFecha } from '@/lib/utils'
import { ESTADO_CONTRATO_LABEL, ESTADO_CUOTA_LABEL, formatPeriodo } from '@/lib/alquiler/periodo'
import { useCan } from '@/components/auth/useCan'
import { mensajeErrorDesconocido, mensajeErrorRespuesta } from '@/lib/errores'
import {
  LineaAlquilerUbicacionFields,
  ubicacionLineaAlquilerConfirmada,
  ubicacionLineaAlquilerValida,
  type UbicacionLineaAlquilerValue,
} from '@/components/alquiler/LineaAlquilerUbicacionFields'

interface ContratoDetalle {
  id: string
  numero: string
  estado: string
  fechaInicio: string | null
  fechaFin: string | null
  diaFacturacion: number
  observaciones: string | null
  creadoEn: string
  cliente: { id: string; nombre: string; cuit: string | null; telefono: string | null; email: string | null }
  lineas: Array<{
    id: string
    activa?: boolean
    montoMensual: number
    beneficiarioNombre: string | null
    beneficiarioDocumento: string | null
    beneficiarioTelefono: string | null
    domicilio: string | null
    localidad: string | null
    provincia: string | null
    lat: number | null
    lng: number | null
    inventarioUnidad: {
      numeroSerie: string | null
      estado: string
      inventario: { nombre: string; marca: string | null; modelo: string | null }
    }
    equipo: { id: string; nombre: string; numeroSerie: string | null } | null
  }>
  cuotas: Array<{
    id: string
    periodo: string
    monto: number
    vencimiento: string
    estado: string
    facturaId?: string | null
    factura?: { id: string; numero: string; estado: string } | null
  }>
}

const ESTADO_VARIANT: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'info' | 'gray'> = {
  BORRADOR: 'default',
  ACTIVO: 'success',
  SUSPENDIDO: 'warning',
  FINALIZADO: 'info',
  CANCELADO: 'danger',
  PENDIENTE: 'warning',
  FACTURADA: 'info',
  COBRADA: 'success',
  VENCIDA: 'danger',
  ANULADA: 'gray',
}

function formatMonto(n: number) {
  return n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })
}

export function ContratoAlquilerDetalle({ contrato: inicial }: { contrato: ContratoDetalle }) {
  const router = useRouter()
  const puedeActivar = useCan('alquiler.update')
  const puedeFacturar = useCan('alquiler.bill')
  const puedeCerrar = useCan('alquiler.close')
  const [contrato, setContrato] = useState(inicial)
  const [loading, setLoading] = useState<string | null>(null)
  const [periodoFacturar, setPeriodoFacturar] = useState(formatPeriodo(new Date()))
  const [lineaEditUbicacion, setLineaEditUbicacion] = useState<string | null>(null)
  const [ubicacionDraft, setUbicacionDraft] = useState<UbicacionLineaAlquilerValue | null>(null)

  const lineasSinPin = useMemo(
    () => contrato.lineas.filter((l) => l.lat == null || l.lng == null),
    [contrato.lineas],
  )

  const montoTotal = contrato.lineas.reduce((s, l) => s + l.montoMensual, 0)

  const cuotasFacturables = useMemo(
    () => contrato.cuotas.filter((c) => ['PENDIENTE', 'VENCIDA'].includes(c.estado) && !c.facturaId),
    [contrato.cuotas],
  )

  const periodosPendientes = useMemo(
    () => [...new Set(cuotasFacturables.map((c) => c.periodo))].sort().reverse(),
    [cuotasFacturables],
  )

  async function recargar() {
    const res = await fetch(`/api/alquiler/contratos/${contrato.id}`)
    if (res.ok) setContrato(await res.json())
    router.refresh()
  }

  async function accion(url: string, msgOk: string, confirmMsg?: string) {
    if (confirmMsg && !confirm(confirmMsg)) return
    setLoading(url)
    try {
      const res = await fetch(url, { method: 'POST' })
      if (!res.ok) throw new Error(await mensajeErrorRespuesta(res, 'Error en la operación'))
      toast.success(msgOk)
      await recargar()
    } catch (e) {
      toast.error(mensajeErrorDesconocido(e, 'Error'))
    } finally {
      setLoading(null)
    }
  }

  function abrirEditUbicacion(lineaId: string) {
    if (lineaEditUbicacion === lineaId) {
      setLineaEditUbicacion(null)
      setUbicacionDraft(null)
      return
    }
    const linea = contrato.lineas.find((l) => l.id === lineaId)
    if (!linea) return
    setLineaEditUbicacion(lineaId)
    setUbicacionDraft(ubicacionLineaAlquilerConfirmada(linea))
  }

  async function guardarUbicacionLinea(lineaId: string) {
    if (!ubicacionDraft || !ubicacionLineaAlquilerValida(ubicacionDraft)) {
      toast.error('Confirmá la ubicación en el mapa antes de guardar')
      return
    }
    setLoading(`ubicacion-${lineaId}`)
    try {
      const res = await fetch(`/api/alquiler/lineas/${lineaId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domicilio: ubicacionDraft.domicilio.trim(),
          localidad: ubicacionDraft.localidad.trim(),
          provincia: ubicacionDraft.provincia.trim() || 'Formosa',
          lat: ubicacionDraft.lat,
          lng: ubicacionDraft.lng,
        }),
      })
      if (!res.ok) throw new Error(await mensajeErrorRespuesta(res, 'No se pudo guardar la ubicación'))
      toast.success('Ubicación guardada')
      setLineaEditUbicacion(null)
      setUbicacionDraft(null)
      await recargar()
    } catch (e) {
      toast.error(mensajeErrorDesconocido(e, 'Error al guardar ubicación'))
    } finally {
      setLoading(null)
    }
  }

  async function facturarPeriodo() {
    if (!periodosPendientes.includes(periodoFacturar)) {
      toast.error('No hay cuotas pendientes para ese período')
      return
    }
    setLoading('facturar')
    try {
      const res = await fetch(`/api/alquiler/contratos/${contrato.id}/facturar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ periodo: periodoFacturar }),
      })
      if (!res.ok) throw new Error(await mensajeErrorRespuesta(res, 'No se pudo facturar'))
      const factura = await res.json()
      toast.success(`Factura ${factura.numero} creada en borrador`)
      await recargar()
    } catch (e) {
      toast.error(mensajeErrorDesconocido(e, 'Error al facturar'))
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <Link href="/alquiler">
          <Button variant="outline" size="sm"><ArrowLeft size={14} /> Volver</Button>
        </Link>
        <Badge variant={ESTADO_VARIANT[contrato.estado] ?? 'default'}>
          {ESTADO_CONTRATO_LABEL[contrato.estado] ?? contrato.estado}
        </Badge>
        {contrato.estado === 'BORRADOR' && lineasSinPin.length > 0 && (
          <span className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1">
            {lineasSinPin.length} línea(s) sin pin en mapa — confirmá ubicación antes de activar
          </span>
        )}
        {contrato.estado === 'BORRADOR' && puedeActivar && (
          <Button
            variant="primary"
            size="sm"
            disabled={loading !== null}
            onClick={() =>
              accion(
                `/api/alquiler/contratos/${contrato.id}/activar`,
                'Contrato activado',
                '¿Activar el contrato? Las unidades pasarán a EN_ALQUILER.',
              )
            }
          >
            <Play size={14} /> Activar
          </Button>
        )}
        {contrato.estado === 'BORRADOR' && puedeCerrar && (
          <Button
            variant="outline"
            size="sm"
            disabled={loading !== null}
            onClick={() =>
              accion(
                `/api/alquiler/contratos/${contrato.id}/cancelar`,
                'Contrato cancelado',
                '¿Cancelar este borrador?',
              )
            }
          >
            <XCircle size={14} /> Cancelar
          </Button>
        )}
        {contrato.estado === 'ACTIVO' && puedeCerrar && (
          <>
            <Button
              variant="outline"
              size="sm"
              disabled={loading !== null}
              onClick={() =>
                accion(
                  `/api/alquiler/contratos/${contrato.id}/suspender`,
                  'Contrato suspendido',
                  '¿Suspender el contrato? No se generarán cuotas nuevas.',
                )
              }
            >
              <Pause size={14} /> Suspender
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={loading !== null}
              onClick={() =>
                accion(
                  `/api/alquiler/contratos/${contrato.id}/finalizar`,
                  'Contrato finalizado',
                  '¿Finalizar y devolver todas las unidades?',
                )
              }
            >
              <PackageX size={14} /> Finalizar
            </Button>
          </>
        )}
        {contrato.estado === 'SUSPENDIDO' && puedeCerrar && (
          <>
            <Button
              variant="outline"
              size="sm"
              disabled={loading !== null}
              onClick={() =>
                accion(
                  `/api/alquiler/contratos/${contrato.id}/suspender?accion=reactivar`,
                  'Contrato reactivado',
                )
              }
            >
              <RotateCcw size={14} /> Reactivar
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={loading !== null}
              onClick={() =>
                accion(
                  `/api/alquiler/contratos/${contrato.id}/finalizar`,
                  'Contrato finalizado',
                  '¿Finalizar y devolver todas las unidades?',
                )
              }
            >
              <PackageX size={14} /> Finalizar
            </Button>
          </>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="md:col-span-2 p-4 space-y-2">
          <h2 className="text-[15px] font-bold text-[#1f242c]">{contrato.numero}</h2>
          <p className="text-[13px]"><span className="text-[#9aa1ab]">Cliente pagador:</span> {contrato.cliente.nombre}</p>
          {contrato.cliente.cuit && <p className="text-[13px] text-[#6b7280]">CUIT {contrato.cliente.cuit}</p>}
          <p className="text-[13px]"><span className="text-[#9aa1ab]">Día facturación:</span> {contrato.diaFacturacion}</p>
          {contrato.fechaInicio && (
            <p className="text-[13px]"><span className="text-[#9aa1ab]">Inicio:</span> {formatFecha(contrato.fechaInicio)}</p>
          )}
          {contrato.fechaFin && (
            <p className="text-[13px]"><span className="text-[#9aa1ab]">Fin:</span> {formatFecha(contrato.fechaFin)}</p>
          )}
          {contrato.observaciones && <p className="text-[13px] text-[#6b7280]">{contrato.observaciones}</p>}
        </Card>
        <Card className="p-4">
          <p className="text-[11px] text-[#9aa1ab] uppercase">Monto mensual total</p>
          <p className="text-2xl font-bold text-[#E8650A]">{formatMonto(montoTotal)}</p>
          <p className="text-[12px] text-[#9aa1ab] mt-1">{contrato.lineas.length} línea(s)</p>
        </Card>
      </div>

      {puedeFacturar && periodosPendientes.length > 0 && ['ACTIVO', 'SUSPENDIDO'].includes(contrato.estado) && (
        <Card className="p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <p className="text-[12px] text-[#6b7280] mb-1">Facturar cuotas del período</p>
              <select
                value={periodoFacturar}
                onChange={(e) => setPeriodoFacturar(e.target.value)}
                className="border border-[#e4e7eb] rounded-[9px] px-3 py-2 text-[13px] bg-white"
              >
                {periodosPendientes.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            <Button variant="primary" size="sm" onClick={facturarPeriodo} disabled={loading !== null}>
              <Receipt size={14} /> {loading === 'facturar' ? 'Facturando…' : 'Generar factura borrador'}
            </Button>
          </div>
          <p className="text-[11px] text-[#9aa1ab] mt-2">
            Crea una factura BORRADOR con todas las cuotas pendientes del período. Emití AFIP desde Facturación.
          </p>
        </Card>
      )}

      <Card>
        <h3 className="text-[14px] font-bold text-[#1f242c] mb-3">Líneas de alquiler</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="border-b border-[#eef0f2] text-left text-[#9aa1ab]">
                <th className="py-2 pr-3">Equipo</th>
                <th className="py-2 pr-3">Beneficiario</th>
                <th className="py-2 pr-3">Ubicación</th>
                <th className="py-2 pr-3">Monto/mes</th>
                <th className="py-2 pr-3">Unidad</th>
                {puedeCerrar && <th className="py-2">Acciones</th>}
              </tr>
            </thead>
            <tbody>
              {contrato.lineas.map((l) => (
                <tr key={l.id} className="border-b border-[#f3f4f6]">
                  <td className="py-3 pr-3">
                    <div className="font-medium">{l.inventarioUnidad.inventario.nombre}</div>
                    {l.inventarioUnidad.numeroSerie && (
                      <div className="text-[11px] text-[#9aa1ab]">S/N {l.inventarioUnidad.numeroSerie}</div>
                    )}
                    {l.equipo && (
                      <Link href={`/servicio-tecnico/equipos/${l.equipo.id}`} className="text-[11px] text-[#E8650A] hover:underline">
                        Ver equipo
                      </Link>
                    )}
                  </td>
                  <td className="py-3 pr-3">
                    {l.beneficiarioNombre ?? '—'}
                    {l.beneficiarioDocumento && (
                      <div className="text-[11px] text-[#9aa1ab]">{l.beneficiarioDocumento}</div>
                    )}
                  </td>
                  <td className="py-3 pr-3">
                    <div>{[l.domicilio, l.localidad, l.provincia].filter(Boolean).join(', ') || '—'}</div>
                    {l.lat != null && l.lng != null ? (
                      <div className="flex items-center gap-1 text-[10px] text-emerald-700 mt-1">
                        <CheckCircle2 size={11} /> En mapa
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-[10px] text-amber-700 mt-1">
                        <AlertCircle size={11} /> Sin pin confirmado
                      </div>
                    )}
                    {contrato.estado === 'BORRADOR' && puedeActivar && (
                      <button
                        type="button"
                        className="text-[10px] text-[#E8650A] hover:underline mt-1 flex items-center gap-0.5"
                        onClick={() => abrirEditUbicacion(l.id)}
                      >
                        <MapPin size={10} /> {lineaEditUbicacion === l.id ? 'Cerrar mapa' : 'Ubicar en mapa'}
                      </button>
                    )}
                  </td>
                  <td className="py-3 pr-3">{formatMonto(l.montoMensual)}</td>
                  <td className="py-3 pr-3">{l.inventarioUnidad.estado}</td>
                  {puedeCerrar && (
                    <td className="py-3">
                      {l.activa !== false && ['ACTIVO', 'SUSPENDIDO'].includes(contrato.estado) && (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={loading !== null}
                          onClick={() =>
                            accion(
                              `/api/alquiler/lineas/${l.id}/devolver`,
                              'Equipo devuelto',
                              '¿Registrar devolución de esta unidad?',
                            )
                          }
                        >
                          Devolver
                        </Button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {lineaEditUbicacion && ubicacionDraft && (
          <div className="mt-4 border border-[#eef0f2] rounded-[10px] p-4 space-y-3">
            <LineaAlquilerUbicacionFields
              value={ubicacionDraft}
              onChange={(patch) => setUbicacionDraft((prev) => (prev ? { ...prev, ...patch } : prev))}
              compact
            />
            <div className="flex gap-2">
              <Button
                variant="primary"
                size="sm"
                disabled={loading !== null}
                onClick={() => guardarUbicacionLinea(lineaEditUbicacion)}
              >
                Guardar ubicación
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setLineaEditUbicacion(null)
                  setUbicacionDraft(null)
                }}
              >
                Cancelar
              </Button>
            </div>
          </div>
        )}
      </Card>

      {contrato.cuotas.length > 0 && (
        <Card>
          <h3 className="text-[14px] font-bold text-[#1f242c] mb-3">Cuotas</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="border-b border-[#eef0f2] text-left text-[#9aa1ab]">
                  <th className="py-2 pr-3">Período</th>
                  <th className="py-2 pr-3">Vencimiento</th>
                  <th className="py-2 pr-3">Monto</th>
                  <th className="py-2 pr-3">Estado</th>
                  <th className="py-2">Factura</th>
                </tr>
              </thead>
              <tbody>
                {contrato.cuotas.map((c) => (
                  <tr key={c.id} className="border-b border-[#f3f4f6]">
                    <td className="py-3 pr-3">{c.periodo}</td>
                    <td className="py-3 pr-3">{formatFecha(c.vencimiento)}</td>
                    <td className="py-3 pr-3">{formatMonto(c.monto)}</td>
                    <td className="py-3 pr-3">
                      <Badge variant={ESTADO_VARIANT[c.estado] ?? 'default'}>
                        {ESTADO_CUOTA_LABEL[c.estado] ?? c.estado}
                      </Badge>
                    </td>
                    <td className="py-3">
                      {c.factura ? (
                        <Link href={`/facturacion?buscar=${encodeURIComponent(c.factura.numero)}`} className="text-[#E8650A] hover:underline">
                          {c.factura.numero}
                        </Link>
                      ) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}
