'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { X, ExternalLink, MapPin, Package, User, FileText, Wrench } from 'lucide-react'
import { formatFecha, formatMonto } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

const ESTADO_EQUIPO: Record<string, string> = {
  ACTIVO: 'Activo',
  EN_REPARACION: 'En reparación',
  BAJA: 'Baja',
}

const TIPO_COMPONENTE: Record<string, string> = {
  BATERIA: 'Batería',
  FILTRO: 'Filtro',
  CALIBRACION: 'Calibración',
  SENSOR: 'Sensor',
  OTRO: 'Otro',
}

export type EquipoFichaData = {
  equipo: {
    id: string
    nombre: string
    marca?: string | null
    modelo?: string | null
    modeloExacto?: string | null
    numeroSerie?: string | null
    codigoInterno?: string | null
    firmwareVersion?: string | null
    softwareVersion?: string | null
    garantiaHasta?: string | null
    estado: string
    fechaInstalacion?: string | null
    servicioInstalacion?: string | null
    pisoSala?: string | null
    contactoResponsable?: string | null
    direccionUbicacion?: string | null
    notasTecnicas?: string | null
    referenciaCompra?: string | null
    cliente: {
      id: string
      nombre: string
      tipo?: string
      cuit?: string | null
      ciudad?: string | null
      direccion?: string | null
      telefono?: string | null
      email?: string | null
      contacto?: string | null
      condicionPago?: string | null
    }
    proveedorOrigen?: { id: string; razonSocial: string; ciudad?: string | null } | null
    instaladoPor?: { id: string; nombre: string } | null
    itemFacturaOrigen?: {
      descripcion: string
      numeroSerie?: string | null
      inventario?: { nombre: string; sku?: string | null } | null
      factura: {
        id: string
        numero: string
        fechaEmision: string
        condicionPago?: string | null
        total: number
        cliente: { id: string; nombre: string; cuit?: string | null; ciudad?: string | null; telefono?: string | null }
        emisor?: { razonSocial: string; cuit?: string | null } | null
      }
    } | null
    componentes?: Array<{
      id: string
      tipo: string
      descripcion: string
      numeroSerie?: string | null
      venceEn?: string | null
      instaladoEn?: string | null
    }>
    accesorios?: Array<{
      id: string
      nombre: string
      cantidad: number
      obligatorio: boolean
      inventario?: { sku?: string | null } | null
    }>
    planes?: Array<{
      id: string
      descripcion: string
      proximoServicio?: string | null
      intervaloDias: number
      estado: string
    }>
  }
}

function FichaRow({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) {
  if (!value?.trim()) return null
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-bold uppercase tracking-wide text-[#8a909a]">{label}</span>
      <span className={`text-[12.5px] text-[#1f242c] ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  )
}

function FichaSection({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <h3 className="text-[13px] font-bold text-[#1f242c]">{title}</h3>
      </div>
      <div className="flex flex-col gap-3">{children}</div>
    </Card>
  )
}

export function EquipoFichaContent({ data, compact }: { data: EquipoFichaData; compact?: boolean }) {
  const eq = data.equipo
  const venta = eq.itemFacturaOrigen?.factura
  const ubicacion = [eq.servicioInstalacion, eq.pisoSala, eq.direccionUbicacion].filter(Boolean).join(' · ')

  return (
    <div className={`flex flex-col gap-3 ${compact ? '' : 'pb-2'}`}>
      <div className="rounded-[10px] bg-[#EFF6FF] border border-[#93C5FD] px-4 py-3">
        <p className="text-[11px] font-bold uppercase text-[#1D4ED8] tracking-wide">Ficha del equipo</p>
        <h2 className="text-[16px] font-extrabold text-[#16181d] mt-1">{eq.nombre}</h2>
        <p className="text-[12px] text-[#4B5563] mt-1">
          {[eq.marca, eq.modeloExacto || eq.modelo].filter(Boolean).join(' · ') || 'Sin marca/modelo'}
          {eq.numeroSerie ? (
            <> · N° serie <span className="font-mono font-semibold">{eq.numeroSerie}</span></>
          ) : null}
        </p>
        <div className="flex flex-wrap gap-2 mt-2">
          <span className="inline-block px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-white border border-[#e4e7eb]">
            {ESTADO_EQUIPO[eq.estado] ?? eq.estado}
          </span>
          {eq.codigoInterno && (
            <span className="inline-block px-2 py-0.5 rounded-full text-[10.5px] font-mono bg-white border border-[#e4e7eb] text-[#6b7280]">
              {eq.codigoInterno}
            </span>
          )}
        </div>
      </div>

      <FichaSection title="Cliente" icon={<User size={15} className="text-[#E8650A]" />}>
        <FichaRow label="Institución" value={eq.cliente.nombre} />
        <FichaRow label="CUIT" value={eq.cliente.cuit} mono />
        <FichaRow label="Contacto comercial" value={eq.cliente.contacto} />
        <FichaRow label="Teléfono" value={eq.cliente.telefono} />
        <FichaRow label="Email" value={eq.cliente.email} />
        <FichaRow label="Dirección sede" value={[eq.cliente.direccion, eq.cliente.ciudad].filter(Boolean).join(', ') || null} />
        <FichaRow label="Condición de pago habitual" value={eq.cliente.condicionPago} />
        <Link href={`/crm/${eq.cliente.id}`} className="text-[12px] text-[#E8650A] font-semibold hover:underline inline-flex items-center gap-1">
          Ver ficha del cliente <ExternalLink size={12} />
        </Link>
      </FichaSection>

      <FichaSection title="Ubicación e instalación" icon={<MapPin size={15} className="text-[#E8650A]" />}>
        <FichaRow label="Área / servicio" value={eq.servicioInstalacion} />
        <FichaRow label="Piso / sala" value={eq.pisoSala} />
        <FichaRow label="Ubicación en sitio" value={eq.direccionUbicacion} />
        {ubicacion && !compact && (
          <p className="text-[12px] text-[#6B7280] bg-[#fafbfc] rounded-lg px-3 py-2 border border-[#eef0f2]">{ubicacion}</p>
        )}
        <FichaRow label="Responsable en sitio" value={eq.contactoResponsable} />
        <FichaRow label="Fecha de instalación" value={eq.fechaInstalacion ? formatFecha(eq.fechaInstalacion) : null} />
        <FichaRow label="Instalado por" value={eq.instaladoPor?.nombre} />
      </FichaSection>

      <FichaSection title="Origen y venta" icon={<FileText size={15} className="text-[#E8650A]" />}>
        {venta ? (
          <>
            <FichaRow label="Factura de venta" value={venta.numero} mono />
            <FichaRow label="Fecha de emisión" value={formatFecha(venta.fechaEmision)} />
            <FichaRow label="Comprador (cliente facturado)" value={venta.cliente.nombre} />
            <FichaRow label="Emisor fiscal" value={venta.emisor?.razonSocial} />
            <FichaRow label="Condición de pago" value={venta.condicionPago} />
            <FichaRow label="Total facturado" value={formatMonto(venta.total)} />
            <FichaRow label="Ítem vendido" value={eq.itemFacturaOrigen?.descripcion} />
            {eq.itemFacturaOrigen?.inventario?.sku && (
              <FichaRow label="SKU catálogo" value={eq.itemFacturaOrigen.inventario.sku} mono />
            )}
            <Link href={`/facturacion?highlight=${venta.id}`} className="text-[12px] text-[#E8650A] font-semibold hover:underline inline-flex items-center gap-1">
              Ver factura en ERP <ExternalLink size={12} />
            </Link>
          </>
        ) : (
          <>
            <FichaRow label="Referencia de compra" value={eq.referenciaCompra} mono />
            <FichaRow label="Proveedor de origen" value={eq.proveedorOrigen?.razonSocial} />
            {eq.proveedorOrigen?.ciudad && <FichaRow label="Ciudad proveedor" value={eq.proveedorOrigen.ciudad} />}
            {!eq.referenciaCompra && !eq.proveedorOrigen && (
              <p className="text-[12px] text-[#9aa1ab]">Sin venta vinculada en el ERP — datos cargados manualmente.</p>
            )}
          </>
        )}
      </FichaSection>

      <FichaSection title="Datos técnicos" icon={<Wrench size={15} className="text-[#E8650A]" />}>
        <div className="grid grid-cols-2 gap-3">
          <FichaRow label="Firmware" value={eq.firmwareVersion} />
          <FichaRow label="Software" value={eq.softwareVersion} />
          <FichaRow label="Garantía hasta" value={eq.garantiaHasta ? formatFecha(eq.garantiaHasta) : null} />
        </div>
        {eq.notasTecnicas && (
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wide text-[#8a909a]">Notas técnicas</span>
            <p className="text-[12.5px] text-[#4B5563] mt-1 whitespace-pre-wrap">{eq.notasTecnicas}</p>
          </div>
        )}
      </FichaSection>

      {(eq.componentes?.length ?? 0) > 0 && (
        <FichaSection title="Componentes y vencimientos" icon={<Package size={15} className="text-[#E8650A]" />}>
          <div className="overflow-x-auto -mx-1">
            <table className="w-full text-[11.5px]">
              <thead>
                <tr className="text-[10px] uppercase text-[#8a909a]">
                  <th className="text-left pb-1.5 pr-2">Tipo</th>
                  <th className="text-left pb-1.5 pr-2">Descripción</th>
                  <th className="text-left pb-1.5 pr-2">N° serie</th>
                  <th className="text-right pb-1.5">Vence</th>
                </tr>
              </thead>
              <tbody>
                {eq.componentes!.map((c) => {
                  const vencido = c.venceEn && new Date(c.venceEn) < new Date()
                  return (
                    <tr key={c.id} className="border-t border-[#f4f5f7]">
                      <td className="py-1.5 pr-2">{TIPO_COMPONENTE[c.tipo] ?? c.tipo}</td>
                      <td className="py-1.5 pr-2 font-semibold">{c.descripcion}</td>
                      <td className="py-1.5 pr-2 font-mono text-[11px]">{c.numeroSerie ?? '—'}</td>
                      <td className={`py-1.5 text-right ${vencido ? 'text-red-600 font-bold' : ''}`}>
                        {c.venceEn ? formatFecha(c.venceEn) : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </FichaSection>
      )}

      {(eq.accesorios?.length ?? 0) > 0 && (
        <FichaSection title="Kit de accesorios" icon={<Package size={15} className="text-[#E8650A]" />}>
          <ul className="text-[12px] space-y-1.5">
            {eq.accesorios!.map((a) => (
              <li key={a.id} className="flex justify-between gap-2">
                <span>
                  {a.nombre}
                  {a.inventario?.sku ? <span className="text-[#9aa1ab] font-mono text-[10.5px] ml-1">({a.inventario.sku})</span> : null}
                  {a.obligatorio && <span className="text-[10px] text-[#C2410C] ml-1">· obligatorio</span>}
                </span>
                <span className="text-[#6b7280] shrink-0">×{a.cantidad}</span>
              </li>
            ))}
          </ul>
        </FichaSection>
      )}

      {!compact && (
        <Link
          href={`/servicio-tecnico/equipos/${eq.id}`}
          className="text-center text-[12.5px] text-[#E8650A] font-semibold hover:underline py-2"
        >
          Abrir historia clínica completa →
        </Link>
      )}
    </div>
  )
}

function useEquipoFicha(equipoId: string | null) {
  const [data, setData] = useState<EquipoFichaData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!equipoId) {
      setData(null)
      setError(null)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    fetch(`/api/equipos/${equipoId}`, { credentials: 'include' })
      .then(async (r) => {
        if (!r.ok) throw new Error('No se pudo cargar la ficha del equipo')
        return r.json()
      })
      .then((json) => {
        if (!cancelled) setData(json)
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Error al cargar')
          setData(null)
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [equipoId])

  return { data, loading, error }
}

export function EquipoFichaInline({ equipoId }: { equipoId: string | null }) {
  const { data, loading, error } = useEquipoFicha(equipoId)
  if (!equipoId) return null
  if (loading) return <p className="text-[12px] text-[#9aa1ab] py-2">Cargando ficha del equipo…</p>
  if (error) return <p className="text-[12px] text-red-600 py-2">{error}</p>
  if (!data) return null
  return <EquipoFichaContent data={data} compact />
}

export function EquipoFichaDrawer({
  equipoId,
  open,
  onClose,
  subtitle,
}: {
  equipoId: string | null
  open: boolean
  onClose: () => void
  subtitle?: string
}) {
  const { data, loading, error } = useEquipoFicha(open ? equipoId : null)

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/35" onClick={onClose} aria-hidden />
      <aside
        className="relative w-full max-w-md bg-[#F4F6F9] shadow-2xl flex flex-col max-h-full animate-in slide-in-from-right duration-200"
        role="dialog"
        aria-label="Ficha técnica del equipo"
      >
        <div className="flex items-start justify-between gap-3 px-5 py-4 bg-white border-b border-[#eef0f2] shrink-0">
          <div>
            <p className="text-[11px] font-bold uppercase text-[#E8650A] tracking-wide">Preparación técnica</p>
            <h2 className="text-[15px] font-extrabold text-[#1f242c] mt-0.5">Ficha del equipo</h2>
            {subtitle && <p className="text-[12px] text-[#6b7280] mt-1">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[#f4f5f7] text-[#6b7280]"
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {loading && <p className="text-[12.5px] text-[#9aa1ab]">Cargando datos del ERP…</p>}
          {error && <p className="text-[12.5px] text-red-600">{error}</p>}
          {data && <EquipoFichaContent data={data} />}
        </div>
        <div className="px-5 py-3 bg-white border-t border-[#eef0f2] shrink-0 flex gap-2 justify-end">
          {data && (
            <Link href={`/servicio-tecnico/equipos/${data.equipo.id}`}>
              <Button variant="outline" size="sm">Historia clínica</Button>
            </Link>
          )}
          <Button variant="secondary" size="sm" onClick={onClose}>Cerrar</Button>
        </div>
      </aside>
    </div>
  )
}
