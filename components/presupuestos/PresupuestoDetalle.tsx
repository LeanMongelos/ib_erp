'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { FileText, Send, CheckCircle, Receipt, Kanban, Truck, Save, Copy, GitBranch, Pencil } from 'lucide-react'
import { BotonGenerarOcDesde } from '@/components/compras/BotonGenerarOcDesde'
import { OcsVinculadasLinks } from '@/components/compras/OcsVinculadasLinks'
import { toast } from 'sonner'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { BadgeEstadoPresupuesto } from '@/components/ui/badge'
import { formatFecha } from '@/lib/utils'
import { formatMontoMoneda, etiquetaMoneda } from '@/lib/moneda'
import { mensajeErrorDesconocido, mensajeErrorJson } from '@/lib/errores'
import { Select } from '@/components/ui/select'
import { VIGENCIA_DIAS, VIGENCIA_DIAS_OT, GARANTIA, GARANTIA_MESES_OT } from '@/lib/form-options'
import { ClienteCombobox } from '@/components/clientes/ClienteCombobox'
import { presupuestoEditable, presupuestoPuedeRevisar } from '@/lib/presupuestos/revision-reglas'

interface PresupuestoDetalleProps {
  presupuesto: {
    id: string
    numero: string
    version?: number
    estado: string
    otId?: string | null
    ot?: { id: string; numero: string } | null
    fechaEmision: string
    fechaVencimiento?: string | null
    subtotal: number
    iva: number
    total: number
    moneda?: string
    cotizacionUsd?: number | null
    formaPago?: string | null
    plazoEntrega?: string | null
    garantia?: string | null
    condicionPago?: string | null
    tasaFinanciacionPct?: number
    interesFinanciacion?: number
    observaciones?: string | null
    vigenciaDias: number
    cliente: { id: string; nombre: string; cuit?: string | null; direccion?: string | null }
    emisor?: { razonSocial: string; cuit: string } | null
    vendedor?: { nombre: string } | null
    items: {
      descripcion: string
      cantidad: number
      precioUnit: number
      subtotal: number
      numeroSerie?: string | null
      proximoPreventivo?: string | null
      inventario?: { tipoArticulo?: string | null } | null
    }[]
    factura?: { id: string; numero: string } | null
    negociosEmbudo?: Array<{ id: string; numero: number; etapa: string; vendedor: string }>
    ordenesCompra?: { id: string; numero: string; estado: string }[]
    ordenVenta?: {
      id: string
      remitos: { id: string; numero: string; estado: string }[]
    } | null
  }
  versiones?: Array<{
    id: string
    numero: string
    version: number
    estado: string
    total: number
    moneda?: string
    cliente: { nombre: string }
    creadoEn: string
  }>
  clientesCopia?: Array<{
    id: string
    nombre: string
    condicionIva?: string | null
    alicuotaIva?: { porcentaje: number } | null
  }>
}

export function PresupuestoDetalle({
  presupuesto: p,
  versiones = [],
  clientesCopia = [],
}: PresupuestoDetalleProps) {
  const router = useRouter()
  const [loading, setLoading] = useState('')
  const [vigenciaDias, setVigenciaDias] = useState(String(p.vigenciaDias))
  const [garantia, setGarantia] = useState(p.garantia ?? '')
  const [copiarAbierto, setCopiarAbierto] = useState(false)
  const [clienteCopiaId, setClienteCopiaId] = useState('')
  const moneda = p.moneda ?? 'ARS'

  const yaRemitido = (p.ordenVenta?.remitos?.length ?? 0) > 0
  const puedeEditarCondiciones =
    !p.factura && !yaRemitido && p.estado !== 'CONVERTIDO'
  const puedeEditarForm = presupuestoEditable(p.estado, Boolean(p.factura))
  const puedeRevisar = presupuestoPuedeRevisar(p.estado, Boolean(p.factura))
  const vigenciaGarantiaModificada =
    Number(vigenciaDias) !== p.vigenciaDias || garantia !== (p.garantia ?? '')

  async function guardarVigenciaGarantia() {
    setLoading('vigencia')
    try {
      const res = await fetch(`/api/presupuestos/${p.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vigenciaDias: Number(vigenciaDias),
          garantia: garantia.trim() || undefined,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(mensajeErrorJson(data, 'No se pudo guardar vigencia/garantía'))
      toast.success('Vigencia y garantía actualizadas')
      router.refresh()
    } catch (e: unknown) {
      toast.error(mensajeErrorDesconocido(e, 'No se pudo guardar vigencia/garantía'))
    } finally {
      setLoading('')
    }
  }

  async function crearRevision(clienteId?: string) {
    setLoading(clienteId ? 'copiar' : 'revision')
    try {
      const res = await fetch(`/api/presupuestos/${p.id}/revision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(clienteId ? { clienteId } : {}),
          motivo: clienteId ? 'Copia para otro cliente' : 'Nueva revisión comercial',
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(mensajeErrorJson(data, 'No se pudo crear la revisión'))
      toast.success(clienteId ? 'Presupuesto copiado para el nuevo cliente' : 'Nueva revisión creada')
      router.push(`/presupuestos/${data.id}/editar`)
    } catch (e: unknown) {
      toast.error(mensajeErrorDesconocido(e, 'No se pudo crear la revisión'))
    } finally {
      setLoading('')
      setCopiarAbierto(false)
    }
  }

  async function cambiarEstado(estado: string, perm: string) {
    setLoading(perm)
    try {
      const res = await fetch(`/api/presupuestos/${p.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(mensajeErrorJson(data, 'No se pudo actualizar el presupuesto'))
      toast.success(estado === 'ENVIADO' ? 'Presupuesto enviado al cliente' : 'Actualizado')
      router.refresh()
    } catch (e: unknown) {
      toast.error(mensajeErrorDesconocido(e, 'No se pudo actualizar el presupuesto'))
    } finally {
      setLoading('')
    }
  }

  async function aprobarYGenerarRemito() {
    if (p.factura) {
      router.push('/facturacion')
      return
    }

    setLoading('remito')
    try {
      if (p.estado !== 'APROBADO') {
        const res = await fetch(`/api/presupuestos/${p.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ estado: 'APROBADO' }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(mensajeErrorJson(data, 'No se pudo aprobar el presupuesto'))
      }
      const resRemito = await fetch(`/api/presupuestos/${p.id}/remito`, {
        method: 'POST',
        credentials: 'include',
      })
      const remito = await resRemito.json().catch(() => ({}))
      if (!resRemito.ok) throw new Error(mensajeErrorJson(remito, 'No se pudo crear el remito'))
      toast.success('Orden de venta y remito creados — asigná las series')
      router.push(`/remitos/${remito.id}`)
    } catch (e: unknown) {
      toast.error(mensajeErrorDesconocido(e, 'No se pudo continuar al remito'))
    } finally {
      setLoading('')
    }
  }

  const puedeRemitir = !p.factura && ['BORRADOR', 'ENVIADO', 'APROBADO'].includes(p.estado)
  const listoConvertir = !p.factura && ['ENVIADO', 'APROBADO'].includes(p.estado)

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[20px] font-extrabold text-[#1f242c]">
            {p.numero}
            {(p.version ?? 1) > 1 && (
              <span className="ml-2 text-[12px] font-bold text-[#6b7280]">v{p.version}</span>
            )}
          </h2>
          <p className="text-[12.5px] text-[#6b7280] mt-0.5">{p.cliente.nombre}</p>
          {p.ot && (
            <button
              type="button"
              onClick={() => router.push(`/servicio-tecnico/${p.ot!.id}`)}
              className="text-[12px] text-[#E8650A] font-semibold hover:underline mt-1 block"
            >
              Vinculado a OT {p.ot.numero}
            </button>
          )}
          {p.negociosEmbudo && p.negociosEmbudo[0] && (
            <Link
              href="/crm/embudo"
              className="text-[12px] text-[#E8650A] font-semibold hover:underline mt-1 inline-flex items-center gap-1"
            >
              <Kanban size={12} />
              Negocio embudo #{p.negociosEmbudo[0].numero} · {p.negociosEmbudo[0].etapa}
            </Link>
          )}
          <OcsVinculadasLinks ordenes={p.ordenesCompra ?? []} />
        </div>
        <BadgeEstadoPresupuesto estado={p.estado} />
      </div>

      {puedeEditarCondiciones && (
        <Card className="border-[#FDE68A] bg-[#FFFBEB]">
          <h3 className="text-[12px] font-bold text-[#92400E] uppercase mb-3">
            Vigencia y condiciones comerciales
          </h3>
          <p className="text-[12px] text-[#78350F] mb-3">
            Ajustá vigencia, garantía y plazos antes de enviar o remitir. Si ya fue aprobado, usá «Nueva revisión».
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold text-[#8a909a] uppercase block mb-1">
                Vigencia del presupuesto
              </label>
              <Select
                value={vigenciaDias}
                onChange={(e) => setVigenciaDias(e.target.value)}
                options={p.otId ? VIGENCIA_DIAS_OT : VIGENCIA_DIAS}
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-[#8a909a] uppercase block mb-1">
                Garantía
              </label>
              <Select
                value={garantia}
                onChange={(e) => setGarantia(e.target.value)}
                options={[
                  { value: '', label: 'Sin especificar' },
                  ...(p.otId ? GARANTIA_MESES_OT : GARANTIA),
                ]}
              />
            </div>
          </div>
          {vigenciaGarantiaModificada && (
            <Button
              variant="secondary"
              size="sm"
              className="mt-3"
              onClick={guardarVigenciaGarantia}
              loading={loading === 'vigencia'}
            >
              <Save size={14} /> Guardar cambios
            </Button>
          )}
        </Card>
      )}

      {versiones.length > 1 && (
        <Card padding={false}>
          <div className="px-5 py-3 border-b border-[#eef0f2]">
            <h3 className="text-[12px] font-bold text-[#8a909a] uppercase">Historial de versiones</h3>
          </div>
          <div className="divide-y divide-[#f4f5f7]">
            {versiones.map((v) => (
              <Link
                key={v.id}
                href={`/presupuestos/${v.id}`}
                className={`flex items-center justify-between px-5 py-3 hover:bg-[#fafbfc] ${
                  v.id === p.id ? 'bg-[#FFF7ED]' : ''
                }`}
              >
                <div>
                  <p className="text-[13px] font-semibold text-[#1f242c]">
                    {v.numero} · v{v.version}
                  </p>
                  <p className="text-[11.5px] text-[#6b7280]">{v.cliente.nombre}</p>
                </div>
                <div className="text-right">
                  <BadgeEstadoPresupuesto estado={v.estado} />
                  <p className="text-[11.5px] text-[#6b7280] mt-1">
                    {formatMontoMoneda(v.total, v.moneda ?? 'ARS')}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </Card>
      )}

      {listoConvertir && (
        <div className="bg-gradient-to-r from-[#FFF7ED] to-[#FFEDD5] border-2 border-[#E8650A] rounded-[12px] px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shadow-sm">
          <div>
            <p className="text-[14px] font-extrabold text-[#9A3412]">Generar remito de venta</p>
            <p className="text-[12.5px] text-[#C2410C] mt-1">
              Presupuesto {p.estado === 'APROBADO' ? 'aprobado' : 'enviado'} — creá la orden de venta, asigná series en el remito y luego facturá.
            </p>
          </div>
          <Button
            variant="primary"
            size="md"
            className="shrink-0 text-[13.5px] px-5"
            onClick={aprobarYGenerarRemito}
            loading={loading === 'remito'}
          >
            <Truck size={18} />
            Generar remito
          </Button>
        </div>
      )}

      {puedeRemitir && !listoConvertir && (
        <div className="bg-[#FFF7ED] border border-[#FDBA74] rounded-[10px] px-4 py-3 flex items-center justify-between gap-4">
          <div>
            <p className="text-[13px] font-bold text-[#9A3412]">Listo para remitir</p>
            <p className="text-[12px] text-[#C2410C] mt-0.5">
              Al aprobar, se crea la orden de venta y el remito para asignar números de serie.
            </p>
          </div>
          <Button onClick={aprobarYGenerarRemito} loading={loading === 'remito'}>
            <Truck size={16} />
            Aprobar y remitir
          </Button>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => window.open(`/api/presupuestos/${p.id}/pdf`, '_blank')}>
          <FileText size={16} /> Ver PDF
        </Button>
        {puedeEditarForm && (
          <Button variant="secondary" onClick={() => router.push(`/presupuestos/${p.id}/editar`)}>
            <Pencil size={16} /> Editar
          </Button>
        )}
        {puedeRevisar && (
          <Button
            variant="outline"
            onClick={() => crearRevision()}
            loading={loading === 'revision'}
          >
            <GitBranch size={16} /> Nueva revisión
          </Button>
        )}
        {puedeRevisar && clientesCopia.length > 0 && (
          <Button variant="outline" onClick={() => setCopiarAbierto((v) => !v)}>
            <Copy size={16} /> Copiar a otro cliente
          </Button>
        )}
        <BotonGenerarOcDesde
          origen="presupuesto"
          origenId={p.id}
          variant="outline"
          size="md"
          disabled={p.items.length === 0}
          disabledTitle="El presupuesto no tiene ítems"
        />
        {p.estado === 'BORRADOR' && (
          <Button variant="secondary" onClick={() => cambiarEstado('ENVIADO', 'enviar')} loading={loading === 'enviar'}>
            <Send size={16} /> Enviar al cliente
          </Button>
        )}
        {p.estado === 'ENVIADO' && (
          <Button variant="secondary" onClick={() => cambiarEstado('APROBADO', 'aprobar')} loading={loading === 'aprobar'}>
            <CheckCircle size={16} /> Solo aprobar
          </Button>
        )}
        {p.factura && (
          <Button variant="outline" onClick={() => router.push('/facturacion')}>
            Ver factura {p.factura.numero}
          </Button>
        )}
      </div>

      {copiarAbierto && (
        <Card className="border-[#BFDBFE] bg-[#EFF6FF]">
          <h3 className="text-[13px] font-bold text-[#1E40AF] mb-2">Copiar presupuesto a otro cliente</h3>
          <p className="text-[12px] text-[#3B82F6] mb-3">
            Se crea una nueva versión en borrador con los mismos ítems y condiciones, lista para ajustar precios o plazos.
          </p>
          <ClienteCombobox
            value={clienteCopiaId}
            onChange={setClienteCopiaId}
            initialOptions={clientesCopia.filter((c) => c.id !== p.cliente.id)}
          />
          <div className="flex gap-2 mt-3">
            <Button
              variant="primary"
              size="sm"
              disabled={!clienteCopiaId}
              loading={loading === 'copiar'}
              onClick={() => crearRevision(clienteCopiaId)}
            >
              Crear copia
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setCopiarAbierto(false)}>
              Cancelar
            </Button>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <h3 className="text-[12px] font-bold text-[#8a909a] uppercase mb-3">Cliente</h3>
          <p className="text-[13px] font-semibold">{p.cliente.nombre}</p>
          {p.cliente.cuit && <p className="text-[12px] text-[#6b7280]">CUIT: {p.cliente.cuit}</p>}
          {p.cliente.direccion && <p className="text-[12px] text-[#6b7280]">{p.cliente.direccion}</p>}
        </Card>
        <Card>
          <h3 className="text-[12px] font-bold text-[#8a909a] uppercase mb-3">Condiciones</h3>
          <p className="text-[12px] text-[#6b7280]">Emisión: {formatFecha(p.fechaEmision)}</p>
          <p className="text-[12px] text-[#6b7280]">Vence: {p.fechaVencimiento ? formatFecha(p.fechaVencimiento) : '—'}</p>
          <p className="text-[12px] text-[#6b7280]">Vigencia: {p.vigenciaDias} días</p>
          {p.formaPago && <p className="text-[12px] text-[#6b7280]">Forma de pago: {p.formaPago}</p>}
          {p.condicionPago && <p className="text-[12px] text-[#6b7280]">Plazos: {p.condicionPago}</p>}
          {(p.tasaFinanciacionPct ?? 0) > 0 && (
            <p className="text-[12px] text-[#6b7280]">
              Financiación: {p.tasaFinanciacionPct}% mensual
              {(p.interesFinanciacion ?? 0) > 0 && ` · Interés ${formatMontoMoneda(p.interesFinanciacion!, moneda)}`}
            </p>
          )}
          {p.plazoEntrega && <p className="text-[12px] text-[#6b7280]">Entrega: {p.plazoEntrega}</p>}
          {p.garantia && <p className="text-[12px] text-[#6b7280]">Garantía: {p.garantia}</p>}
          {p.emisor && <p className="text-[12px] text-[#6b7280] mt-1">Emisor: {p.emisor.razonSocial}</p>}
          <p className="text-[12px] text-[#6b7280] mt-1">Moneda: {etiquetaMoneda(moneda)}</p>
          {moneda === 'USD' && p.cotizacionUsd && (
            <p className="text-[12px] text-[#6b7280]">Cotización USD: {p.cotizacionUsd.toLocaleString('es-AR')}</p>
          )}
        </Card>
      </div>

      <Card padding={false}>
        <table className="w-full">
          <thead>
            <tr>
              {['Descripción', 'Cant.', 'Precio', 'Serie / Preventivo', 'Subtotal'].map((h, i) => (
                <th key={h} className={`px-5 py-3 text-[10.5px] font-bold text-[#8a909a] uppercase border-b border-[#eef0f2] ${i > 0 && i < 4 ? 'text-right' : 'text-left'}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {p.items.map((item, i) => (
              <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-[#fafbfc]'}>
                <td className="px-5 py-[13px] text-[12.5px] border-b border-[#f4f5f7]">
                  {item.descripcion}
                  {item.inventario?.tipoArticulo === 'EQUIPO' && (
                    <p className="text-[10px] text-[#E8650A] font-semibold mt-0.5">Equipo</p>
                  )}
                </td>
                <td className="px-5 py-[13px] text-[12.5px] text-right border-b border-[#f4f5f7]">{item.cantidad}</td>
                <td className="px-5 py-[13px] text-[12.5px] text-right border-b border-[#f4f5f7]">{formatMontoMoneda(item.precioUnit, moneda)}</td>
                <td className="px-5 py-[13px] text-[11.5px] text-right border-b border-[#f4f5f7] text-[#6b7280]">
                  {item.inventario?.tipoArticulo === 'EQUIPO' ? (
                    <div className="flex flex-col items-end gap-0.5">
                      {item.numeroSerie && <span>Serie {item.numeroSerie}</span>}
                      {item.proximoPreventivo && (
                        <span>Preventivo {formatFecha(item.proximoPreventivo)}</span>
                      )}
                      {!item.numeroSerie && !item.proximoPreventivo && '—'}
                    </div>
                  ) : '—'}
                </td>
                <td className="px-5 py-[13px] text-[12.5px] font-bold text-right border-b border-[#f4f5f7]">{formatMontoMoneda(item.subtotal, moneda)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-5 py-4 flex flex-col items-end gap-1">
          <p className="text-[12.5px] text-[#6b7280]">Subtotal: {formatMontoMoneda(p.subtotal, moneda)}</p>
          <p className="text-[12.5px] text-[#6b7280]">IVA: {formatMontoMoneda(p.iva, moneda)}</p>
          {(p.interesFinanciacion ?? 0) > 0 && (
            <p className="text-[12.5px] text-[#6b7280]">
              Interés financiación: {formatMontoMoneda(p.interesFinanciacion!, moneda)}
            </p>
          )}
          <p className="text-[16px] font-extrabold text-[#E8650A]">Total: {formatMontoMoneda(p.total, moneda)}</p>
          {moneda === 'USD' && p.cotizacionUsd && (
            <p className="text-[11px] text-[#9aa1ab]">
              ≈ {formatMontoMoneda(p.total * p.cotizacionUsd, 'ARS')} ARS (cot. {p.cotizacionUsd.toLocaleString('es-AR')})
            </p>
          )}
        </div>
      </Card>

      {p.observaciones && (
        <Card>
          <h3 className="text-[12px] font-bold text-[#8a909a] uppercase mb-2">Observaciones</h3>
          <p className="text-[12.5px] text-[#3a4150]">{p.observaciones}</p>
        </Card>
      )}
    </div>
  )
}
