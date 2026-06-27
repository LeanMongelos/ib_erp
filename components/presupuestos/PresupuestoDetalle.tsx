'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { FileText, Send, CheckCircle, Receipt, Kanban } from 'lucide-react'
import { BotonGenerarOcDesde } from '@/components/compras/BotonGenerarOcDesde'
import { OcsVinculadasLinks } from '@/components/compras/OcsVinculadasLinks'
import { toast } from 'sonner'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { BadgeEstadoPresupuesto } from '@/components/ui/badge'
import { formatFecha } from '@/lib/utils'
import { formatMontoMoneda, etiquetaMoneda } from '@/lib/moneda'
import { mensajeErrorDesconocido, mensajeErrorJson } from '@/lib/errores'

interface PresupuestoDetalleProps {
  presupuesto: {
    id: string
    numero: string
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
    cliente: { nombre: string; cuit?: string | null; direccion?: string | null }
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
  }
}

export function PresupuestoDetalle({ presupuesto: p }: PresupuestoDetalleProps) {
  const router = useRouter()
  const [loading, setLoading] = useState('')
  const moneda = p.moneda ?? 'ARS'

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

  async function aprobarYFacturar() {
    if (p.factura) {
      router.push('/facturacion')
      return
    }

    setLoading('facturar')
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
      toast.success('Presupuesto aprobado — los datos se cargaron en facturación')
      const q = p.otId ? `&otId=${p.otId}` : ''
      router.push(`/facturacion/nueva?presupuestoId=${p.id}${q}`)
    } catch (e: unknown) {
      toast.error(mensajeErrorDesconocido(e, 'No se pudo continuar a facturación'))
    } finally {
      setLoading('')
    }
  }

  const puedeFacturar = !p.factura && ['BORRADOR', 'ENVIADO', 'APROBADO'].includes(p.estado)
  const listoConvertir = !p.factura && ['ENVIADO', 'APROBADO'].includes(p.estado)

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[20px] font-extrabold text-[#1f242c]">{p.numero}</h2>
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

      {listoConvertir && (
        <div className="bg-gradient-to-r from-[#FFF7ED] to-[#FFEDD5] border-2 border-[#E8650A] rounded-[12px] px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shadow-sm">
          <div>
            <p className="text-[14px] font-extrabold text-[#9A3412]">Convertir a factura</p>
            <p className="text-[12.5px] text-[#C2410C] mt-1">
              Presupuesto {p.estado === 'APROBADO' ? 'aprobado' : 'enviado'} — abrí facturación con cliente, ítems y montos ya cargados.
            </p>
          </div>
          <Button
            variant="primary"
            size="md"
            className="shrink-0 text-[13.5px] px-5"
            onClick={aprobarYFacturar}
            loading={loading === 'facturar'}
          >
            <Receipt size={18} />
            Convertir a factura
          </Button>
        </div>
      )}

      {puedeFacturar && !listoConvertir && (
        <div className="bg-[#FFF7ED] border border-[#FDBA74] rounded-[10px] px-4 py-3 flex items-center justify-between gap-4">
          <div>
            <p className="text-[13px] font-bold text-[#9A3412]">Listo para facturar</p>
            <p className="text-[12px] text-[#C2410C] mt-0.5">
              Al aprobar, se abre facturación con cliente, ítems y montos ya cargados.
            </p>
          </div>
          <Button onClick={aprobarYFacturar} loading={loading === 'facturar'}>
            <Receipt size={16} />
            Aprobar y facturar
          </Button>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => window.open(`/api/presupuestos/${p.id}/pdf`, '_blank')}>
          <FileText size={16} /> Ver PDF
        </Button>
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
