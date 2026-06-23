'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  MapPin, Phone, Mail, Wrench, Pencil, X, TrendingUp, Clock, AlertTriangle, CircleDollarSign,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Combobox } from '@/components/ui/combobox'
import { Badge } from '@/components/ui/badge'
import { CONDICION_IVA, CONDICION_PAGO } from '@/lib/form-options'
import { BadgeEstadoOT, BadgeEstadoFactura } from '@/components/ui/badge'
import { useCan } from '@/components/auth/useCan'
import { mensajeErrorDesconocido, mensajeErrorJson } from '@/lib/errores'
import { formatFecha, formatMonto } from '@/lib/utils'
import {
  LABEL_SEGMENTO,
  type MetricasCliente,
  type SegmentoCliente,
  type SemaforoPago,
} from '@/lib/clientes-metrics'
import type { Cliente, Equipo, Factura, ContactoCliente } from '@/types'
import { ClienteSucursalesPanel } from '@/components/crm/ClienteSucursalesPanel'
import { ClientePreciosPanel } from '@/components/crm/ClientePreciosPanel'

function BadgeEquipo({ estado }: { estado: string }) {
  const map: Record<string, { bg: string; text: string; label: string }> = {
    ACTIVO:        { bg: 'bg-green-100', text: 'text-green-700', label: 'Activo' },
    EN_REPARACION: { bg: 'bg-orange-100', text: 'text-orange-700', label: 'En reparación' },
    BAJA:          { bg: 'bg-gray-100', text: 'text-gray-500', label: 'Baja' },
  }
  const s = map[estado] ?? map.BAJA
  return (
    <span className={`inline-flex text-[11px] font-bold px-2.5 py-0.5 rounded-full ${s.bg} ${s.text}`}>
      {s.label}
    </span>
  )
}

const SEGMENTO_STYLE: Record<SegmentoCliente, string> = {
  VIP:        'bg-[#FFF1E2] text-[#C2540A]',
  RECURRENTE: 'bg-green-100 text-green-700',
  NUEVO:      'bg-blue-100 text-blue-700',
  EN_RIESGO:  'bg-amber-100 text-amber-700',
  MOROSO:     'bg-red-100 text-red-700',
  INACTIVO:   'bg-gray-100 text-gray-500',
}

const SEMAFORO: Record<SemaforoPago, { dot: string; label: string; text: string }> = {
  VERDE:    { dot: 'bg-green-500',  label: 'Buen pagador', text: 'text-green-700' },
  AMARILLO: { dot: 'bg-amber-500',  label: 'Demora leve',  text: 'text-amber-700' },
  ROJO:     { dot: 'bg-red-500',    label: 'Moroso',       text: 'text-red-700' },
}

interface ClienteCompleto extends Cliente {
  equipos: Equipo[]
  ots: any[]
  facturas: Factura[]
  contactos?: ContactoCliente[]
  _count?: { equipos: number; ots: number }
}

const TABS = ['Comportamiento', 'Datos generales', 'Equipos', 'Historial OTs', 'Facturas'] as const
type Tab = typeof TABS[number]

export function ClienteFicha({
  cliente,
  metricas,
}: {
  cliente: ClienteCompleto
  metricas: MetricasCliente
}) {
  const router = useRouter()
  const puedeEditar = useCan('clientes.update')
  const [tab, setTab] = useState<Tab>('Comportamiento')
  const [editando, setEditando] = useState(false)

  const initials = cliente.nombre.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()
  const segStyle = SEGMENTO_STYLE[metricas.segmento]
  const semaforo = SEMAFORO[metricas.semaforoPago]

  return (
    <div className="flex flex-col gap-4">
      {/* Header card */}
      <Card className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-[54px] h-[54px] rounded-[12px] bg-[#FFF1E2] flex items-center justify-center text-[#E8650A] font-extrabold text-[18px]">
            {initials}
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-[18px] font-extrabold text-[#16181d] tracking-tight">{cliente.nombre}</h2>
              <span className={`inline-flex text-[11px] font-bold px-2.5 py-0.5 rounded-full ${segStyle}`}>
                {LABEL_SEGMENTO[metricas.segmento]}
              </span>
            </div>
            <div className="flex items-center gap-2.5 mt-1.5">
              <span className="inline-flex text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-[#FDECE0] text-[#C2540A]">
                {cliente.tipo.charAt(0) + cliente.tipo.slice(1).toLowerCase()}
              </span>
              {cliente.ciudad && (
                <span className="text-[12.5px] text-[#7c828c] flex items-center gap-1">
                  <MapPin size={13} /> {cliente.ciudad}
                </span>
              )}
              {cliente.cuit && (
                <span className="text-[12.5px] text-[#7c828c]">· CUIT {cliente.cuit}</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {puedeEditar && (
            <Button variant="secondary" onClick={() => setEditando(true)}>
              <Pencil size={15} /> Editar ficha
            </Button>
          )}
          <Button onClick={() => router.push(`/servicio-tecnico/nueva?clienteId=${cliente.id}`)}>
            <Wrench size={16} strokeWidth={2.2} />
            Nueva OT
          </Button>
        </div>
      </Card>

      {/* KPIs de comportamiento */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          icon={<CircleDollarSign size={16} className="text-[#E8650A]" />}
          label="Valor histórico (LTV)"
          value={formatMonto(metricas.totalComprado)}
          hint={`${metricas.cantidadCompras} compras`}
        />
        <KpiCard
          icon={<TrendingUp size={16} className="text-[#E8650A]" />}
          label="Ticket promedio"
          value={formatMonto(metricas.ticketPromedio)}
        />
        <KpiCard
          icon={<Clock size={16} className="text-[#E8650A]" />}
          label="Última compra"
          value={metricas.ultimaCompra ? formatFecha(metricas.ultimaCompra) : '—'}
          hint={metricas.diasDesdeUltimaCompra !== null ? `hace ${metricas.diasDesdeUltimaCompra} días` : undefined}
        />
        <KpiCard
          icon={<span className={`w-2.5 h-2.5 rounded-full ${semaforo.dot}`} />}
          label="Comportamiento de pago"
          value={`Score ${metricas.scorePago}`}
          hint={semaforo.label}
          hintClass={semaforo.text}
        />
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: '1.9fr 1fr' }}>
        {/* Panel izquierdo — Tabs */}
        <Card padding={false} className="overflow-hidden flex flex-col">
          <div className="flex gap-0.5 px-2 py-1 border-b border-[#f0f1f4] overflow-x-auto">
            {TABS.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-3.5 py-[11px] text-[12.5px] font-semibold transition-colors whitespace-nowrap ${
                  tab === t
                    ? 'text-[#E8650A] border-b-[2.5px] border-[#E8650A]'
                    : 'text-[#9aa1ab] hover:text-[#3a4150]'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="overflow-auto flex-1">
            {tab === 'Comportamiento' && (
              <div className="p-5 flex flex-col gap-5">
                {/* Recurrencia */}
                <section>
                  <h4 className="text-[11px] font-bold text-[#8a909a] uppercase tracking-wide mb-2.5">Recurrencia</h4>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-[12.5px]">
                    <Dato label="Frecuencia media" value={metricas.frecuenciaMediaDias !== null ? `${metricas.frecuenciaMediaDias} días` : 'Sin datos'} />
                    <Dato label="Próxima compra estimada" value={metricas.proximaCompraEstimada ? formatFecha(metricas.proximaCompraEstimada) : 'Sin datos'} />
                    <Dato label="Primera compra" value={metricas.primeraCompra ? formatFecha(metricas.primeraCompra) : '—'} />
                    <Dato
                      label="Estado"
                      value={metricas.enRiesgo ? 'En riesgo / dormido' : 'Activo'}
                      valueClass={metricas.enRiesgo ? 'text-amber-700 font-bold' : 'text-green-700 font-bold'}
                    />
                  </div>
                </section>

                {/* Pago y cuenta corriente */}
                <section>
                  <h4 className="text-[11px] font-bold text-[#8a909a] uppercase tracking-wide mb-2.5">Comportamiento de pago</h4>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-[12.5px]">
                    <Dato label="Saldo actual" value={formatMonto(metricas.saldoActual)} valueClass={metricas.saldoActual > 0 ? 'text-[#C2261B] font-bold' : 'text-green-700 font-bold'} />
                    <Dato label="Deuda vencida" value={formatMonto(metricas.deudaVencida)} valueClass={metricas.deudaVencida > 0 ? 'text-[#C2261B] font-bold' : ''} />
                    <Dato label="DSO aprox." value={`${metricas.dsoAprox} días`} />
                    <Dato label="Límite de crédito" value={metricas.limiteCredito !== null ? formatMonto(metricas.limiteCredito) : 'Sin definir'} />
                    {metricas.creditoDisponible !== null && (
                      <Dato label="Crédito disponible" value={formatMonto(metricas.creditoDisponible)} valueClass={metricas.creditoDisponible < 0 ? 'text-[#C2261B] font-bold' : ''} />
                    )}
                  </div>
                  {/* Aging */}
                  <div className="mt-3.5">
                    <p className="text-[11px] font-semibold text-[#8a909a] mb-1.5">Antigüedad de deuda (aging)</p>
                    <div className="grid grid-cols-4 gap-2">
                      {[
                        { l: '0-30', v: metricas.aging.bucket0_30 },
                        { l: '31-60', v: metricas.aging.bucket31_60 },
                        { l: '61-90', v: metricas.aging.bucket61_90 },
                        { l: '+90', v: metricas.aging.bucket90 },
                      ].map((b) => (
                        <div key={b.l} className="bg-[#f7f8fa] rounded-[8px] px-2.5 py-2 text-center">
                          <p className="text-[10px] text-[#9aa1ab] font-semibold">{b.l} días</p>
                          <p className={`text-[12px] font-bold ${b.v > 0 ? 'text-[#C2261B]' : 'text-[#3a4150]'}`}>{formatMonto(b.v)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>

                {/* RFM */}
                <section>
                  <h4 className="text-[11px] font-bold text-[#8a909a] uppercase tracking-wide mb-2.5">Segmentación RFM</h4>
                  <div className="flex items-center gap-3">
                    {[
                      { l: 'Recencia', v: metricas.rfm.recencia },
                      { l: 'Frecuencia', v: metricas.rfm.frecuencia },
                      { l: 'Monto', v: metricas.rfm.monto },
                    ].map((r) => (
                      <div key={r.l} className="flex-1 bg-[#f7f8fa] rounded-[8px] px-3 py-2 text-center">
                        <p className="text-[10px] text-[#9aa1ab] font-semibold">{r.l}</p>
                        <p className="text-[16px] font-extrabold text-[#16181d]">{r.v}<span className="text-[10px] text-[#9aa1ab]">/5</span></p>
                      </div>
                    ))}
                    <div className="flex-1 bg-[#FFF1E2] rounded-[8px] px-3 py-2 text-center">
                      <p className="text-[10px] text-[#C2540A] font-semibold">Score RFM</p>
                      <p className="text-[16px] font-extrabold text-[#C2540A]">{metricas.rfm.score}<span className="text-[10px]">/15</span></p>
                    </div>
                  </div>
                </section>

                {/* Top productos */}
                <section>
                  <h4 className="text-[11px] font-bold text-[#8a909a] uppercase tracking-wide mb-2.5">Productos más comprados</h4>
                  {metricas.topProductos.length === 0 ? (
                    <p className="text-[12.5px] text-[#9aa1ab]">Sin datos de productos facturados.</p>
                  ) : (
                    <div className="flex flex-col gap-1.5">
                      {metricas.topProductos.map((p, i) => (
                        <div key={i} className="flex items-center justify-between text-[12.5px] py-1.5 border-b border-[#f4f5f7] last:border-0">
                          <span className="text-[#3a4150] truncate max-w-[260px]">{i + 1}. {p.descripcion}</span>
                          <span className="text-[#1f242c] font-bold">{formatMonto(p.monto)} <span className="text-[#9aa1ab] font-normal">· {p.cantidad}u</span></span>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            )}

            {tab === 'Datos generales' && (
              <div className="p-5 flex flex-col gap-5">
                <div className="grid grid-cols-2 gap-4 text-[12.5px]">
                {[
                  { label: 'Teléfono',       value: cliente.telefono },
                  { label: 'Email',          value: cliente.email },
                  { label: 'Contacto',       value: cliente.contacto },
                  { label: 'Dirección fiscal', value: cliente.direccion },
                  { label: 'Ciudad',         value: cliente.ciudad },
                  { label: 'CUIT',           value: cliente.cuit },
                  { label: 'Condición IVA',  value: cliente.condicionIva },
                  { label: 'Condición de pago', value: cliente.condicionPago },
                  { label: 'Sitio web',      value: cliente.sitioWeb },
                  { label: 'Límite de crédito', value: cliente.limiteCredito != null ? formatMonto(cliente.limiteCredito) : null },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <p className="text-[10.5px] font-bold text-[#8a909a] uppercase tracking-wide mb-1">{label}</p>
                    <p className="text-[#1f242c]">{value ?? '—'}</p>
                  </div>
                ))}
                {cliente.notas && (
                  <div className="col-span-2">
                    <p className="text-[10.5px] font-bold text-[#8a909a] uppercase tracking-wide mb-1">Notas</p>
                    <p className="text-[#1f242c] whitespace-pre-wrap">{cliente.notas}</p>
                  </div>
                )}
                </div>
                <ClientePreciosPanel
                  clienteId={cliente.id}
                  listaPreciosId={(cliente as ClienteCompleto & { listaPreciosId?: string | null }).listaPreciosId}
                  esMayorista={(cliente as ClienteCompleto & { esMayorista?: boolean }).esMayorista}
                  monedaPreferida={(cliente as ClienteCompleto & { monedaPreferida?: string | null }).monedaPreferida}
                  puedeEditar={puedeEditar}
                  onSaved={() => router.refresh()}
                />
                <ClienteSucursalesPanel clienteId={cliente.id} puedeEditar={puedeEditar} />
              </div>
            )}

            {tab === 'Equipos' && (
              <table className="w-full">
                <thead>
                  <tr>
                    {['Equipo', 'Modelo', 'N° Serie', 'Garantía', 'Estado', 'Historia'].map((h) => (
                      <th key={h} className="px-5 py-[11px] text-left text-[10.5px] font-bold text-[#8a909a] tracking-[0.6px] uppercase border-b border-[#f0f1f4]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {cliente.equipos.map((e, i) => (
                    <tr key={e.id} className={i % 2 === 0 ? 'bg-white' : 'bg-[#fafbfc]'}>
                      <td className="px-5 py-3 text-[12.5px] font-bold text-[#1f242c] border-b border-[#f4f5f7]">{e.nombre}</td>
                      <td className="px-5 py-3 text-[12.5px] text-[#6b7280] border-b border-[#f4f5f7]">{e.modelo ?? '—'}</td>
                      <td className="px-5 py-3 text-[12px] text-[#6b7280] font-mono border-b border-[#f4f5f7]">{e.numeroSerie ?? '—'}</td>
                      <td className={`px-5 py-3 text-[12.5px] font-semibold border-b border-[#f4f5f7] ${e.garantiaHasta && new Date(e.garantiaHasta) > new Date() ? 'text-green-600' : 'text-[#9aa1ab]'}`}>
                        {e.garantiaHasta ? formatFecha(e.garantiaHasta) : 'Sin garantía'}
                      </td>
                      <td className="px-5 py-3 border-b border-[#f4f5f7]"><BadgeEquipo estado={e.estado} /></td>
                      <td className="px-5 py-3 border-b border-[#f4f5f7]">
                        <Link href={`/servicio-tecnico/equipos/${e.id}`} className="text-[12px] text-[#E8650A] font-semibold hover:underline">
                          Ver ficha
                        </Link>
                      </td>
                    </tr>
                  ))}
                  {cliente.equipos.length === 0 && (
                    <tr><td colSpan={6} className="px-5 py-8 text-center text-[12.5px] text-[#9aa1ab]">Sin equipos registrados</td></tr>
                  )}
                </tbody>
              </table>
            )}

            {tab === 'Historial OTs' && (
              <table className="w-full">
                <thead>
                  <tr>
                    {['N° OT', 'Descripción', 'Técnico', 'Apertura', 'Estado'].map((h) => (
                      <th key={h} className="px-5 py-[11px] text-left text-[10.5px] font-bold text-[#8a909a] tracking-[0.6px] uppercase border-b border-[#f0f1f4]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {cliente.ots.map((ot: any, i: number) => (
                    <tr key={ot.id} className={i % 2 === 0 ? 'bg-white' : 'bg-[#fafbfc]'}>
                      <td className="px-5 py-3 border-b border-[#f4f5f7]">
                        <Link href={`/servicio-tecnico/${ot.id}`} className="text-[12.5px] font-bold text-[#E8650A] hover:underline">{ot.numero}</Link>
                      </td>
                      <td className="px-5 py-3 text-[12.5px] text-[#3a4150] border-b border-[#f4f5f7] max-w-[200px] truncate">{ot.descripcion}</td>
                      <td className="px-5 py-3 text-[12.5px] text-[#6b7280] border-b border-[#f4f5f7]">{ot.tecnico?.nombre ?? '—'}</td>
                      <td className="px-5 py-3 text-[12.5px] text-[#6b7280] border-b border-[#f4f5f7]">{formatFecha(ot.fechaApertura)}</td>
                      <td className="px-5 py-3 border-b border-[#f4f5f7]"><BadgeEstadoOT estado={ot.estado} /></td>
                    </tr>
                  ))}
                  {cliente.ots.length === 0 && (
                    <tr><td colSpan={5} className="px-5 py-8 text-center text-[12.5px] text-[#9aa1ab]">Sin historial de OTs</td></tr>
                  )}
                </tbody>
              </table>
            )}

            {tab === 'Facturas' && (
              <table className="w-full">
                <thead>
                  <tr>
                    {['N° Factura', 'Tipo', 'Emisión', 'Total', 'Estado'].map((h) => (
                      <th key={h} className="px-5 py-[11px] text-left text-[10.5px] font-bold text-[#8a909a] tracking-[0.6px] uppercase border-b border-[#f0f1f4]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {cliente.facturas.map((f, i) => (
                    <tr key={f.id} className={i % 2 === 0 ? 'bg-white' : 'bg-[#fafbfc]'}>
                      <td className="px-5 py-3 text-[12.5px] font-bold text-[#E8650A] border-b border-[#f4f5f7]">{f.numero}</td>
                      <td className="px-5 py-3 text-[12.5px] text-[#3a4150] border-b border-[#f4f5f7]">Tipo {f.tipo}</td>
                      <td className="px-5 py-3 text-[12.5px] text-[#6b7280] border-b border-[#f4f5f7]">{formatFecha(f.fechaEmision)}</td>
                      <td className="px-5 py-3 text-[12.5px] font-bold text-[#1f242c] border-b border-[#f4f5f7]">{formatMonto(f.total)}</td>
                      <td className="px-5 py-3 border-b border-[#f4f5f7]"><BadgeEstadoFactura estado={f.estado} /></td>
                    </tr>
                  ))}
                  {cliente.facturas.length === 0 && (
                    <tr><td colSpan={5} className="px-5 py-8 text-center text-[12.5px] text-[#9aa1ab]">Sin facturas</td></tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </Card>

        {/* Panel derecho */}
        <div className="flex flex-col gap-4">
          <Card>
            <h3 className="text-[13px] font-bold text-[#1f242c] mb-4">Resumen</h3>
            <div className="flex flex-col gap-4">
              {[
                { label: 'Total equipos',   value: cliente._count?.equipos ?? 0 },
                { label: 'OTs registradas', value: cliente._count?.ots ?? 0 },
              ].map(({ label, value }) => (
                <div key={label}>
                  <div className="flex items-center justify-between">
                    <span className="text-[12.5px] text-[#7c828c] font-medium">{label}</span>
                    <span className="text-[20px] font-extrabold text-[#16181d]">{value}</span>
                  </div>
                  <div className="h-px bg-[#f0f1f4] mt-4" />
                </div>
              ))}
              <div className="flex items-center justify-between">
                <span className="text-[12.5px] text-[#7c828c] font-medium">Saldo pendiente</span>
                <span className={`text-[20px] font-extrabold ${metricas.saldoActual > 0 ? 'text-[#C2261B]' : 'text-[#15803D]'}`}>
                  {formatMonto(metricas.saldoActual)}
                </span>
              </div>
            </div>
          </Card>

          <Card className="flex-1">
            <h3 className="text-[13px] font-bold text-[#1f242c] mb-3.5">Contactos</h3>
            <div className="flex items-center gap-3 mb-3.5">
              <div className="w-10 h-10 rounded-full bg-[#eef1f5] flex items-center justify-center text-[#6b7280] font-bold text-[14px]">
                {(cliente.contacto ?? 'U').charAt(0)}
              </div>
              <div>
                <p className="text-[13px] font-bold text-[#1f242c]">{cliente.contacto ?? 'Sin contacto'}</p>
              </div>
            </div>
            <div className="flex flex-col gap-2.5 text-[12.5px] text-[#6b7280]">
              {cliente.email && (
                <div className="flex items-center gap-2">
                  <Mail size={15} className="text-[#9aa1ab]" />
                  {cliente.email}
                </div>
              )}
              {cliente.telefono && (
                <div className="flex items-center gap-2">
                  <Phone size={15} className="text-[#9aa1ab]" />
                  {cliente.telefono}
                </div>
              )}
            </div>
            {cliente.contactos && cliente.contactos.length > 0 && (
              <div className="mt-4 pt-3.5 border-t border-[#f0f1f4] flex flex-col gap-3">
                {cliente.contactos.map((c) => (
                  <div key={c.id} className="text-[12.5px]">
                    <p className="font-bold text-[#1f242c]">{c.nombre} {c.cargo && <span className="text-[#9aa1ab] font-normal">· {c.cargo}</span>}</p>
                    <p className="text-[#6b7280]">{[c.email, c.telefono].filter(Boolean).join(' · ') || '—'}</p>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {metricas.enRiesgo && (
            <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-[10px] px-3.5 py-3">
              <AlertTriangle size={16} className="text-amber-500 flex-shrink-0 mt-0.5" />
              <p className="text-[12px] font-semibold text-amber-800">
                Cliente en riesgo: superó 1.5× su frecuencia habitual sin comprar. Candidato a campaña de re-contacto.
              </p>
            </div>
          )}
        </div>
      </div>

      {editando && (
        <ClienteEditModal
          cliente={cliente}
          onClose={() => setEditando(false)}
          onSaved={() => { setEditando(false); router.refresh() }}
        />
      )}
    </div>
  )
}

function KpiCard({ icon, label, value, hint, hintClass }: {
  icon: React.ReactNode; label: string; value: string; hint?: string; hintClass?: string
}) {
  return (
    <Card>
      <div className="flex items-center gap-2 mb-2">
        <div className="w-7 h-7 rounded-[8px] bg-[#FFF1E2] flex items-center justify-center">{icon}</div>
        <span className="text-[11px] font-semibold text-[#8a909a] uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-[18px] font-extrabold text-[#16181d] leading-tight">{value}</p>
      {hint && <p className={`text-[11.5px] mt-0.5 ${hintClass ?? 'text-[#9aa1ab]'}`}>{hint}</p>}
    </Card>
  )
}

function Dato({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div>
      <p className="text-[10.5px] font-bold text-[#8a909a] uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-[#1f242c] ${valueClass ?? ''}`}>{value}</p>
    </div>
  )
}

function ClienteEditModal({
  cliente, onClose, onSaved,
}: {
  cliente: ClienteCompleto
  onClose: () => void
  onSaved: () => void
}) {
  const [alicuotas, setAlicuotas] = useState<Array<{ id: string; nombre: string; porcentaje: number }>>([])
  const [form, setForm] = useState({
    cuit:          cliente.cuit ?? '',
    direccion:     cliente.direccion ?? '',
    ciudad:        cliente.ciudad ?? '',
    telefono:      cliente.telefono ?? '',
    email:         cliente.email ?? '',
    contacto:      cliente.contacto ?? '',
    condicionIva:  cliente.condicionIva ?? '',
    condicionPago: cliente.condicionPago ?? '',
    alicuotaIvaId: (cliente as ClienteCompleto & { alicuotaIvaId?: string | null }).alicuotaIvaId ?? '',
    limiteCredito: cliente.limiteCredito != null ? String(cliente.limiteCredito) : '',
    sitioWeb:      cliente.sitioWeb ?? '',
    notas:         cliente.notas ?? '',
  })
  const [loading, setLoading] = useState(false)
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }))

  useEffect(() => {
    fetch('/api/alicuotas-iva')
      .then((r) => r.json())
      .then(setAlicuotas)
      .catch(() => {})
  }, [])

  async function guardar() {
    setLoading(true)
    try {
      const payload: Record<string, unknown> = {
        cuit: form.cuit || undefined,
        direccion: form.direccion || undefined,
        ciudad: form.ciudad || undefined,
        telefono: form.telefono || undefined,
        email: form.email,
        contacto: form.contacto || undefined,
        condicionIva: form.condicionIva || undefined,
        condicionPago: form.condicionPago || undefined,
        alicuotaIvaId: form.alicuotaIvaId || null,
        limiteCredito: form.limiteCredito === '' ? null : Number(form.limiteCredito),
        sitioWeb: form.sitioWeb || undefined,
        notas: form.notas || undefined,
      }
      const res = await fetch(`/api/clientes/${cliente.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(mensajeErrorJson(data, 'No se pudo guardar el cliente'))
      toast.success('Cliente actualizado')
      onSaved()
    } catch (e: unknown) {
      toast.error(mensajeErrorDesconocido(e, 'No se pudo guardar el cliente'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-[14px] w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#eef0f2] sticky top-0 bg-white">
          <h3 className="text-[14px] font-bold text-[#16181d]">Editar ficha del cliente</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div className="p-5 grid grid-cols-2 gap-3.5">
          <Input label="CUIT" value={form.cuit} onChange={(e) => set('cuit', e.target.value)} placeholder="30-12345678-9" autoComplete="off" />
          <Select label="Condición IVA" value={form.condicionIva} onChange={(e) => set('condicionIva', e.target.value)} placeholder="Seleccionar…" options={[...CONDICION_IVA]} />
          <div className="flex flex-col gap-1.5">
            <label className="text-[11.5px] font-semibold text-[#5b626d] tracking-wide uppercase">Alícuota IVA default</label>
            <select
              value={form.alicuotaIvaId}
              onChange={(e) => set('alicuotaIvaId', e.target.value)}
              className="bg-white border border-[#e4e7eb] rounded-[9px] px-3 py-2.5 text-[13.5px]"
            >
              <option value="">Automática según condición IVA</option>
              {alicuotas.map((a) => (
                <option key={a.id} value={a.id}>{a.nombre} ({a.porcentaje}%)</option>
              ))}
            </select>
          </div>
          <Combobox label="Condición de pago" value={form.condicionPago} onChange={(v) => set('condicionPago', v)} options={CONDICION_PAGO} placeholder="30 días" allowCustom />
          <Input label="Límite de crédito" type="number" value={form.limiteCredito} onChange={(e) => set('limiteCredito', e.target.value)} placeholder="0" autoComplete="off" />
          <Input label="Contacto" value={form.contacto} onChange={(e) => set('contacto', e.target.value)} autoComplete="name" />
          <Input label="Teléfono" value={form.telefono} onChange={(e) => set('telefono', e.target.value)} autoComplete="tel" />
          <Input label="Email" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} autoComplete="email" />
          <Input label="Sitio web" value={form.sitioWeb} onChange={(e) => set('sitioWeb', e.target.value)} autoComplete="url" />
          <div className="col-span-2"><Input label="Dirección" value={form.direccion} onChange={(e) => set('direccion', e.target.value)} autoComplete="street-address" /></div>
          <Input label="Ciudad" value={form.ciudad} onChange={(e) => set('ciudad', e.target.value)} autoComplete="address-level2" />
          <div className="col-span-2 flex flex-col gap-1.5">
            <label className="text-[11.5px] font-semibold text-[#5b626d] tracking-wide uppercase">Notas</label>
            <textarea
              value={form.notas}
              onChange={(e) => set('notas', e.target.value)}
              rows={3}
              autoComplete="off"
              className="w-full bg-white border border-[#e4e7eb] rounded-[9px] px-3 py-2.5 text-[13.5px] text-[#1f242c] focus:outline-none focus:ring-2 focus:ring-[#E8650A]/40 focus:border-[#E8650A]"
            />
          </div>
          <div className="col-span-2 flex justify-end gap-2 pt-1">
            <Button variant="secondary" onClick={onClose} disabled={loading}>Cancelar</Button>
            <Button variant="primary" onClick={guardar} loading={loading}>Guardar</Button>
          </div>
        </div>
      </div>
    </div>
  )
}
