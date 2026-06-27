'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { X, Loader2, Package, Cpu, Layers } from 'lucide-react'
import { formatFecha } from '@/lib/utils'
import { formatMontoMoneda } from '@/lib/moneda'
import { labelTipoArticulo, TIPOS_KIT } from '@/lib/inventario-constants'
import { mensajeErrorDesconocido } from '@/lib/errores'

interface Props {
  itemFacturaId: string | null
  onClose: () => void
}

function labelKitTipo(value: string) {
  return TIPOS_KIT.find((t) => t.value === value)?.label ?? value
}

function Fila({ label, value }: { label: string; value: React.ReactNode }) {
  if (value == null || value === '' || value === '—') return null
  return (
    <div className="grid grid-cols-[120px_1fr] gap-2 text-[12px] py-1 border-b border-[#f4f5f7] last:border-0">
      <span className="text-[#8a909a] font-semibold">{label}</span>
      <span className="text-[#1f242c]">{value}</span>
    </div>
  )
}

export function HistorialProductoDetalleModal({ itemFacturaId, onClose }: Props) {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!itemFacturaId) return
    let cancel = false
    setLoading(true)
    setError(null)
    fetch(`/api/facturas/items/${itemFacturaId}/detalle`, { credentials: 'include' })
      .then(async (r) => {
        const json = await r.json()
        if (!r.ok) throw new Error(json.error ?? 'No se pudo cargar el detalle')
        return json
      })
      .then((d) => { if (!cancel) setData(d) })
      .catch((e) => { if (!cancel) setError(mensajeErrorDesconocido(e, 'Error al cargar')) })
      .finally(() => { if (!cancel) setLoading(false) })
    return () => { cancel = true }
  }, [itemFacturaId])

  if (!itemFacturaId) return null

  const item = data?.item
  const inv = data?.inventario
  const eq = data?.equipo
  const esEquipo = inv?.tipoArticulo === 'EQUIPO' || Boolean(eq)

  return (
    <div
      className="fixed inset-0 z-[130] flex items-center justify-center bg-black/50 p-4"
      data-modal-overlay
    >
      <div className="bg-white rounded-[12px] w-full max-w-lg max-h-[88vh] shadow-xl flex flex-col overflow-hidden">
        <div className="flex items-start justify-between px-5 py-4 border-b border-[#e4e7eb] shrink-0">
          <div className="min-w-0 pr-3">
            <p className="text-[10px] font-bold text-[#8a909a] uppercase tracking-wide">
              {esEquipo ? 'Equipo vendido' : 'Producto vendido'}
            </p>
            <h3 className="text-[15px] font-bold text-[#1f242c] mt-0.5 leading-snug">
              {item?.descripcion ?? 'Detalle'}
            </h3>
            {item?.factura && (
              <p className="text-[11px] text-[#9aa1ab] mt-1">
                Factura {item.factura.numero} · {formatFecha(item.factura.fechaEmision)}
              </p>
            )}
          </div>
          <button type="button" onClick={onClose} className="text-[#9aa1ab] hover:text-[#3a4150] p-1 shrink-0">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading && (
            <div className="flex items-center gap-2 text-[12px] text-[#9aa1ab] py-8 justify-center">
              <Loader2 size={16} className="animate-spin" /> Cargando detalle…
            </div>
          )}
          {error && <p className="text-[12px] text-red-600">{error}</p>}

          {!loading && item && (
            <div className="space-y-5">
              <section>
                <p className="text-[10px] font-bold text-[#8a909a] uppercase mb-2 flex items-center gap-1">
                  <Package size={11} /> Venta
                </p>
                <div className="bg-[#fafbfc] rounded-[8px] px-3 py-2">
                  <Fila label="Cantidad" value={item.cantidad} />
                  <Fila label="Precio unit." value={formatMontoMoneda(item.precioUnit, item.factura.moneda)} />
                  <Fila label="Subtotal" value={formatMontoMoneda(item.subtotal, item.factura.moneda)} />
                  <Fila label="SKU / Código" value={item.codigo} />
                  <Fila label="N° serie (factura)" value={item.numeroSerie} />
                  <Fila
                    label="Próx. preventivo"
                    value={item.proximoPreventivo ? formatFecha(item.proximoPreventivo) : null}
                  />
                  <Fila
                    label="Instalación"
                    value={item.sucursalInstalacion
                      ? `${item.sucursalInstalacion.nombre}${item.sucursalInstalacion.ciudad ? ` · ${item.sucursalInstalacion.ciudad}` : ''}`
                      : null}
                  />
                  {item.descripcionLarga && (
                    <p className="text-[11.5px] text-[#3a4150] mt-2 whitespace-pre-wrap">{item.descripcionLarga}</p>
                  )}
                </div>
              </section>

              {inv && (
                <section>
                  <p className="text-[10px] font-bold text-[#8a909a] uppercase mb-2 flex items-center gap-1">
                    <Layers size={11} /> Catálogo inventario
                  </p>
                  <div className="bg-[#fafbfc] rounded-[8px] px-3 py-2">
                    <Fila label="Tipo" value={labelTipoArticulo(inv.tipoArticulo)} />
                    <Fila label="SKU" value={inv.sku} />
                    <Fila label="Marca / Modelo" value={[inv.marca, inv.modelo].filter(Boolean).join(' · ') || null} />
                    <Fila label="Categoría" value={inv.categoria} />
                    <Fila label="Lista de precios" value={inv.precioUnit != null ? formatMontoMoneda(inv.precioUnit, inv.moneda) : null} />
                    <Fila label="Stock actual" value={inv.stock} />
                    {inv.descripcion && (
                      <p className="text-[11.5px] text-[#3a4150] mt-2">{inv.descripcion}</p>
                    )}
                  </div>
                </section>
              )}

              {eq && (
                <section>
                  <p className="text-[10px] font-bold text-[#8a909a] uppercase mb-2 flex items-center gap-1">
                    <Cpu size={11} /> Equipo en cliente
                  </p>
                  <div className="bg-[#FFF8F2] border border-[#FFE4CC] rounded-[8px] px-3 py-2">
                    <Fila label="N° serie" value={eq.numeroSerie ?? '—'} />
                    <Fila label="Estado" value={eq.estado} />
                    <Fila label="Marca / Modelo" value={[eq.marca, eq.modelo].filter(Boolean).join(' · ') || null} />
                    <Fila label="Modelo exacto" value={eq.modeloExacto} />
                    <Fila label="Cód. interno" value={eq.codigoInterno} />
                    <Fila label="Firmware" value={eq.firmwareVersion} />
                    <Fila label="Software" value={eq.softwareVersion} />
                    <Fila label="Garantía hasta" value={eq.garantiaHasta ? formatFecha(eq.garantiaHasta) : null} />
                    <Fila label="Instalado" value={eq.fechaInstalacion ? formatFecha(eq.fechaInstalacion) : null} />
                    <Fila label="Ubicación" value={eq.pisoSala || eq.direccionUbicacion} />
                    <Fila
                      label="Sucursal"
                      value={eq.sucursal
                        ? `${eq.sucursal.nombre}${eq.sucursal.ciudad ? ` · ${eq.sucursal.ciudad}` : ''}`
                        : null}
                    />
                    <Fila label="Responsable" value={eq.contactoResponsable} />
                    {eq.notasTecnicas && (
                      <p className="text-[11.5px] text-[#3a4150] mt-2 whitespace-pre-wrap">{eq.notasTecnicas}</p>
                    )}
                  </div>

                  {eq.accesorios?.length > 0 && (
                    <div className="mt-3">
                      <p className="text-[10px] font-bold text-[#8a909a] uppercase mb-1.5">Accesorios instalados</p>
                      <ul className="space-y-1.5">
                        {eq.accesorios.map((a: any) => (
                          <li key={a.id} className="text-[11.5px] border border-[#f0f1f4] rounded-[6px] px-2.5 py-1.5 bg-white">
                            <span className="font-semibold text-[#1f242c]">{a.nombre}</span>
                            <span className="text-[#9aa1ab]"> · {a.cantidad} u</span>
                            {a.obligatorio && <span className="text-[10px] text-[#E8650A] font-bold ml-1">oblig.</span>}
                            {a.inventario?.sku && (
                              <span className="block text-[10px] text-[#9aa1ab] font-mono">SKU {a.inventario.sku}</span>
                            )}
                            {a.notas && <p className="text-[10px] text-[#6b7280] mt-0.5">{a.notas}</p>}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {eq.componentes?.length > 0 && (
                    <div className="mt-3">
                      <p className="text-[10px] font-bold text-[#8a909a] uppercase mb-1.5">Componentes / consumibles</p>
                      <ul className="space-y-1.5">
                        {eq.componentes.map((c: any) => (
                          <li key={c.id} className="text-[11.5px] border border-[#f0f1f4] rounded-[6px] px-2.5 py-1.5 bg-white">
                            <span className="font-semibold text-[#1f242c]">{c.descripcion}</span>
                            <span className="text-[#9aa1ab]"> · {c.tipo}</span>
                            {c.numeroSerie && (
                              <span className="block text-[10px] font-mono text-[#6b7280]">Serie {c.numeroSerie}</span>
                            )}
                            {c.venceEn && (
                              <span className="block text-[10px] text-[#9aa1ab]">Vence {formatFecha(c.venceEn)}</span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <Link
                    href={`/servicio-tecnico/equipos/${eq.id}`}
                    className="inline-block mt-3 text-[11px] font-bold text-[#E8650A] hover:underline"
                  >
                    Ver historia clínica del equipo →
                  </Link>
                </section>
              )}

              {!eq && inv?.kit?.length > 0 && (
                <section>
                  <p className="text-[10px] font-bold text-[#8a909a] uppercase mb-2">
                    Kit incluido (catálogo)
                  </p>
                  <ul className="space-y-1.5">
                    {inv.kit.map((k: any) => (
                      <li key={k.id} className="text-[11.5px] border border-[#f0f1f4] rounded-[6px] px-2.5 py-1.5 bg-white">
                        <span className="font-semibold text-[#1f242c]">{k.nombre}</span>
                        <span className="text-[#9aa1ab]"> · {labelKitTipo(k.tipoItem)} · {k.cantidad} u</span>
                        {k.obligatorio && <span className="text-[10px] text-[#E8650A] font-bold ml-1">oblig.</span>}
                        {k.hijo?.sku && (
                          <span className="block text-[10px] text-[#9aa1ab] font-mono">SKU {k.hijo.sku}</span>
                        )}
                        {k.mesesVencimiento && (
                          <span className="block text-[10px] text-[#9aa1ab]">Vencimiento ~{k.mesesVencimiento} meses</span>
                        )}
                        {k.notas && <p className="text-[10px] text-[#6b7280] mt-0.5">{k.notas}</p>}
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
