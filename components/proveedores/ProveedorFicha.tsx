'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Mail, Phone, Globe, MapPin, Pencil, Package, TrendingUp, Truck, Clock } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useCan } from '@/components/auth/useCan'
import { ProveedorModal } from '@/components/proveedores/ProveedorModal'
import { formatFecha, formatMonto } from '@/lib/utils'
import type { MetricasProveedor } from '@/lib/proveedores-metrics'
import type { Proveedor } from '@/types'

const TABS = ['Condiciones', 'Lista de precios', 'Contactos', 'Desempeño'] as const
type Tab = typeof TABS[number]

export function ProveedorFicha({
  proveedor,
  metricas,
}: {
  proveedor: Proveedor
  metricas: MetricasProveedor
}) {
  const router = useRouter()
  const puedeEditar = useCan('proveedores.update')
  const [tab, setTab] = useState<Tab>('Condiciones')
  const [editando, setEditando] = useState(false)

  const initials = proveedor.razonSocial.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()
  const productos = proveedor.productos ?? []
  const condiciones = proveedor.condiciones ?? []
  const contactos = proveedor.contactos ?? []

  function montoMoneda(v: number, moneda: string) {
    return moneda === 'ARS' ? formatMonto(v) : `${moneda} ${v.toLocaleString('es-AR')}`
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-[54px] h-[54px] rounded-[12px] bg-[#FFF1E2] flex items-center justify-center text-[#E8650A] font-extrabold text-[16px]">
            {initials || <Truck size={22} />}
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-[18px] font-extrabold text-[#16181d] tracking-tight">{proveedor.razonSocial}</h2>
              <Badge variant={proveedor.origen === 'IMPORTADO' ? 'info' : 'gray'}>
                {proveedor.origen === 'IMPORTADO' ? 'Importado' : 'Nacional'}
              </Badge>
            </div>
            <div className="flex items-center gap-2.5 mt-1.5 text-[12.5px] text-[#7c828c] flex-wrap">
              {proveedor.rubro && <span>{proveedor.rubro}</span>}
              {proveedor.cuit && <span>· CUIT {proveedor.cuit}</span>}
              {proveedor.ciudad && <span className="flex items-center gap-1"><MapPin size={13} /> {proveedor.ciudad}</span>}
              {proveedor.marcas && <span>· {proveedor.marcas}</span>}
            </div>
          </div>
        </div>
        {puedeEditar && (
          <Button variant="secondary" onClick={() => setEditando(true)}>
            <Pencil size={15} /> Editar
          </Button>
        )}
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Kpi icon={<Package size={16} className="text-[#E8650A]" />} label="Productos provistos" value={String(metricas.cantidadProductos)} hint={`${metricas.registrosPrecio} registros de precio`} />
        <Kpi icon={<TrendingUp size={16} className="text-[#E8650A]" />} label="Costo promedio" value={formatMonto(metricas.costoPromedio)} />
        <Kpi icon={<Clock size={16} className="text-[#E8650A]" />} label="Plazo de entrega promedio" value={metricas.leadTimePromedioDias != null ? `${metricas.leadTimePromedioDias} días` : '—'} />
        <Kpi
          icon={<Truck size={16} className="text-[#E8650A]" />}
          label="Mejor financiación"
          value={metricas.mejorFinanciacion ? metricas.mejorFinanciacion.descripcion : '—'}
          hint={metricas.mejorFinanciacion ? `+${metricas.mejorFinanciacion.recargoPct}% · ${metricas.mejorFinanciacion.plazoDias}d` : undefined}
        />
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: '1.9fr 1fr' }}>
        <Card padding={false} className="overflow-hidden flex flex-col">
          <div className="flex gap-0.5 px-2 py-1 border-b border-[#f0f1f4] overflow-x-auto">
            {TABS.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-3.5 py-[11px] text-[12.5px] font-semibold transition-colors whitespace-nowrap ${
                  tab === t ? 'text-[#E8650A] border-b-[2.5px] border-[#E8650A]' : 'text-[#9aa1ab] hover:text-[#3a4150]'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="overflow-auto flex-1">
            {tab === 'Condiciones' && (
              <table className="w-full">
                <thead>
                  <tr>
                    {['Descripción', 'Plazo', 'Recargo', 'Descuento'].map((h) => (
                      <th key={h} className="px-5 py-[11px] text-left text-[10.5px] font-bold text-[#8a909a] tracking-[0.6px] uppercase border-b border-[#f0f1f4]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {condiciones.map((c, i) => (
                    <tr key={c.id} className={i % 2 === 0 ? 'bg-white' : 'bg-[#fafbfc]'}>
                      <td className="px-5 py-3 text-[12.5px] font-bold text-[#1f242c] border-b border-[#f4f5f7]">{c.descripcion}</td>
                      <td className="px-5 py-3 text-[12.5px] text-[#6b7280] border-b border-[#f4f5f7]">{c.plazoDias} días</td>
                      <td className="px-5 py-3 text-[12.5px] text-[#6b7280] border-b border-[#f4f5f7]">+{c.recargoPct}%</td>
                      <td className="px-5 py-3 text-[12.5px] text-green-700 border-b border-[#f4f5f7]">-{c.descuentoPct}%</td>
                    </tr>
                  ))}
                  {condiciones.length === 0 && (
                    <tr><td colSpan={4} className="px-5 py-8 text-center text-[12.5px] text-[#9aa1ab]">Sin condiciones de financiación cargadas</td></tr>
                  )}
                </tbody>
              </table>
            )}

            {tab === 'Lista de precios' && (
              <table className="w-full">
                <thead>
                  <tr>
                    {['Producto', 'Costo', 'Plazo de entrega', 'Vigente desde'].map((h) => (
                      <th key={h} className="px-5 py-[11px] text-left text-[10.5px] font-bold text-[#8a909a] tracking-[0.6px] uppercase border-b border-[#f0f1f4]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {productos.map((p, i) => (
                    <tr key={p.id} className={i % 2 === 0 ? 'bg-white' : 'bg-[#fafbfc]'}>
                      <td className="px-5 py-3 text-[12.5px] font-bold text-[#1f242c] border-b border-[#f4f5f7]">
                        {p.nombreProducto}
                        {p.inventario && <span className="block text-[11px] text-[#9aa1ab] font-normal">SKU {p.inventario.sku ?? '—'}</span>}
                      </td>
                      <td className="px-5 py-3 text-[12.5px] font-bold text-[#3a4150] border-b border-[#f4f5f7]">{montoMoneda(p.costo, p.moneda)}</td>
                      <td className="px-5 py-3 text-[12.5px] text-[#6b7280] border-b border-[#f4f5f7]">{p.leadTimeDias != null ? `${p.leadTimeDias} días` : '—'}</td>
                      <td className="px-5 py-3 text-[12.5px] text-[#6b7280] border-b border-[#f4f5f7]">{formatFecha(p.vigenteDesde)}</td>
                    </tr>
                  ))}
                  {productos.length === 0 && (
                    <tr><td colSpan={4} className="px-5 py-8 text-center text-[12.5px] text-[#9aa1ab]">Sin productos en la lista de precios</td></tr>
                  )}
                </tbody>
              </table>
            )}

            {tab === 'Contactos' && (
              <div className="p-5 grid grid-cols-2 gap-3">
                {contactos.map((c) => (
                  <Card key={c.id}>
                    <div className="flex items-center justify-between">
                      <p className="text-[13px] font-bold text-[#1f242c]">{c.nombre}</p>
                      {c.principal && <Badge className="bg-[#FFF1E2] text-[#C2540A]">Principal</Badge>}
                    </div>
                    {c.cargo && <p className="text-[11.5px] text-[#9aa1ab] mb-1.5">{c.cargo}</p>}
                    <div className="flex flex-col gap-1 text-[12px] text-[#6b7280]">
                      {c.email && <span className="flex items-center gap-1.5"><Mail size={13} /> {c.email}</span>}
                      {c.telefono && <span className="flex items-center gap-1.5"><Phone size={13} /> {c.telefono}</span>}
                      {c.whatsapp && <span className="flex items-center gap-1.5"><Phone size={13} /> WA {c.whatsapp}</span>}
                    </div>
                  </Card>
                ))}
                {contactos.length === 0 && (
                  <p className="col-span-2 py-8 text-center text-[12.5px] text-[#9aa1ab]">Sin contactos cargados</p>
                )}
              </div>
            )}

            {tab === 'Desempeño' && (
              <div className="p-5 flex flex-col gap-5">
                <section>
                  <h4 className="text-[11px] font-bold text-[#8a909a] uppercase tracking-wide mb-2.5">Variación de precios</h4>
                  {metricas.variacionesPrecio.length === 0 ? (
                    <p className="text-[12.5px] text-[#9aa1ab]">Se necesita más de un registro de precio por producto para medir la variación.</p>
                  ) : (
                    <div className="flex flex-col gap-1.5">
                      {metricas.variacionesPrecio.map((v, i) => (
                        <div key={i} className="flex items-center justify-between text-[12.5px] py-1.5 border-b border-[#f4f5f7] last:border-0">
                          <span className="text-[#3a4150] truncate max-w-[240px]">{v.producto}</span>
                          <span className={`font-bold ${v.variacionPct > 0 ? 'text-[#C2261B]' : 'text-green-700'}`}>
                            {v.variacionPct > 0 ? '+' : ''}{v.variacionPct}%
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                <div className="flex items-start gap-2.5 bg-blue-50 border border-blue-200 rounded-[10px] px-3.5 py-3">
                  <Truck size={16} className="text-blue-500 flex-shrink-0 mt-0.5" />
                  <p className="text-[12px] font-medium text-blue-800">
                    Volumen comprado, cumplimiento de plazos de entrega y cuenta corriente a pagar se calcularán cuando esté disponible el módulo de Compras / Órdenes de Compra (Fase 6).
                  </p>
                </div>
              </div>
            )}
          </div>
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <h3 className="text-[13px] font-bold text-[#1f242c] mb-3.5">Datos de contacto</h3>
            <div className="flex flex-col gap-2.5 text-[12.5px] text-[#6b7280]">
              {proveedor.email && <span className="flex items-center gap-2"><Mail size={15} className="text-[#9aa1ab]" /> {proveedor.email}</span>}
              {proveedor.telefono && <span className="flex items-center gap-2"><Phone size={15} className="text-[#9aa1ab]" /> {proveedor.telefono}</span>}
              {proveedor.sitioWeb && <span className="flex items-center gap-2"><Globe size={15} className="text-[#9aa1ab]" /> {proveedor.sitioWeb}</span>}
              {proveedor.direccion && <span className="flex items-center gap-2"><MapPin size={15} className="text-[#9aa1ab]" /> {proveedor.direccion}</span>}
            </div>
          </Card>

          <Card>
            <h3 className="text-[13px] font-bold text-[#1f242c] mb-3.5">Condiciones por defecto</h3>
            <div className="flex flex-col gap-3 text-[12.5px]">
              <Fila label="Condición de pago" value={proveedor.condicionPago ?? '—'} />
              <Fila label="Moneda" value={proveedor.moneda} />
              <Fila label="% Financiación" value={proveedor.financiacionPct != null ? `${proveedor.financiacionPct}%` : '—'} />
              <Fila label="Plazo de entrega" value={proveedor.plazoEntregaDias != null ? `${proveedor.plazoEntregaDias} días` : '—'} />
              <Fila label="Mínimo de compra" value={proveedor.minimoCompra != null ? formatMonto(proveedor.minimoCompra) : '—'} />
            </div>
          </Card>

          {proveedor.notas && (
            <Card>
              <h3 className="text-[13px] font-bold text-[#1f242c] mb-2">Notas</h3>
              <p className="text-[12.5px] text-[#6b7280] whitespace-pre-wrap">{proveedor.notas}</p>
            </Card>
          )}
        </div>
      </div>

      {editando && (
        <ProveedorModal
          proveedorId={proveedor.id}
          onClose={() => setEditando(false)}
          onSaved={() => { setEditando(false); router.refresh() }}
        />
      )}
    </div>
  )
}

function Kpi({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: string; hint?: string }) {
  return (
    <Card>
      <div className="flex items-center gap-2 mb-2">
        <div className="w-7 h-7 rounded-[8px] bg-[#FFF1E2] flex items-center justify-center">{icon}</div>
        <span className="text-[11px] font-semibold text-[#8a909a] uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-[16px] font-extrabold text-[#16181d] leading-tight">{value}</p>
      {hint && <p className="text-[11.5px] mt-0.5 text-[#9aa1ab]">{hint}</p>}
    </Card>
  )
}

function Fila({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[#7c828c]">{label}</span>
      <span className="text-[#1f242c] font-semibold">{value}</span>
    </div>
  )
}
