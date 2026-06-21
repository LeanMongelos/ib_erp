'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { X, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Combobox } from '@/components/ui/combobox'
import type { Proveedor } from '@/types'
import { CONDICION_IVA, MONEDA, ORIGEN_PROVEEDOR, CONDICION_PAGO } from '@/lib/form-options'
import { mensajeErrorDesconocido, mensajeErrorJson } from '@/lib/errores'

interface ContactoRow { nombre: string; cargo: string; email: string; telefono: string; whatsapp: string; principal: boolean }
interface CondicionRow { descripcion: string; plazoDias: string; recargoPct: string; descuentoPct: string }
interface ProductoRow { nombreProducto: string; costo: string; moneda: string; leadTimeDias: string; garantiaMeses: string }

const emptyBase = {
  razonSocial: '', cuit: '', condicionIva: '', rubro: '', origen: 'NACIONAL', moneda: 'ARS',
  email: '', telefono: '', sitioWeb: '', direccion: '', ciudad: '', marcas: '',
  condicionPago: '', financiacionPct: '', plazoEntregaDias: '', minimoCompra: '', notas: '',
}

export function ProveedorModal({
  proveedorId, onClose, onSaved,
}: {
  proveedorId?: string
  onClose: () => void
  onSaved: () => void
}) {
  const esEdicion = Boolean(proveedorId)
  const [base, setBase] = useState({ ...emptyBase })
  const [contactos, setContactos] = useState<ContactoRow[]>([])
  const [condiciones, setCondiciones] = useState<CondicionRow[]>([])
  const [productos, setProductos] = useState<ProductoRow[]>([])
  const [loading, setLoading] = useState(false)
  const [cargando, setCargando] = useState(esEdicion)

  useEffect(() => {
    if (!proveedorId) return
    let cancel = false
    ;(async () => {
      try {
        const res = await fetch(`/api/proveedores/${proveedorId}`)
        const p: Proveedor = await res.json()
        if (cancel || !res.ok) return
        setBase({
          razonSocial: p.razonSocial ?? '', cuit: p.cuit ?? '', condicionIva: p.condicionIva ?? '',
          rubro: p.rubro ?? '', origen: p.origen ?? 'NACIONAL', moneda: p.moneda ?? 'ARS',
          email: p.email ?? '', telefono: p.telefono ?? '', sitioWeb: p.sitioWeb ?? '',
          direccion: p.direccion ?? '', ciudad: p.ciudad ?? '', marcas: p.marcas ?? '',
          condicionPago: p.condicionPago ?? '',
          financiacionPct: p.financiacionPct != null ? String(p.financiacionPct) : '',
          plazoEntregaDias: p.plazoEntregaDias != null ? String(p.plazoEntregaDias) : '',
          minimoCompra: p.minimoCompra != null ? String(p.minimoCompra) : '',
          notas: p.notas ?? '',
        })
        setContactos((p.contactos ?? []).map((c) => ({
          nombre: c.nombre, cargo: c.cargo ?? '', email: c.email ?? '', telefono: c.telefono ?? '', whatsapp: c.whatsapp ?? '', principal: c.principal,
        })))
        setCondiciones((p.condiciones ?? []).map((c) => ({
          descripcion: c.descripcion, plazoDias: String(c.plazoDias), recargoPct: String(c.recargoPct), descuentoPct: String(c.descuentoPct),
        })))
        setProductos((p.productos ?? []).map((pr) => ({
          nombreProducto: pr.nombreProducto, costo: String(pr.costo), moneda: pr.moneda,
          leadTimeDias: pr.leadTimeDias != null ? String(pr.leadTimeDias) : '',
          garantiaMeses: pr.garantiaMeses != null ? String(pr.garantiaMeses) : '',
        })))
      } finally {
        if (!cancel) setCargando(false)
      }
    })()
    return () => { cancel = true }
  }, [proveedorId])

  const setB = (k: keyof typeof emptyBase, v: string) => setBase((f) => ({ ...f, [k]: v }))

  function numOrUndef(v: string): number | undefined {
    return v.trim() === '' ? undefined : Number(v)
  }

  async function guardar() {
    if (!base.razonSocial.trim()) { toast.error('La razón social es obligatoria'); return }
    setLoading(true)
    try {
      const payload: Record<string, unknown> = {
        razonSocial: base.razonSocial,
        cuit: base.cuit || undefined,
        condicionIva: base.condicionIva || undefined,
        rubro: base.rubro || undefined,
        origen: base.origen,
        moneda: base.moneda || 'ARS',
        email: base.email,
        telefono: base.telefono || undefined,
        sitioWeb: base.sitioWeb || undefined,
        direccion: base.direccion || undefined,
        ciudad: base.ciudad || undefined,
        marcas: base.marcas || undefined,
        condicionPago: base.condicionPago || undefined,
        financiacionPct: numOrUndef(base.financiacionPct) ?? null,
        plazoEntregaDias: numOrUndef(base.plazoEntregaDias) ?? null,
        minimoCompra: numOrUndef(base.minimoCompra) ?? null,
        notas: base.notas || undefined,
        contactos: contactos
          .filter((c) => c.nombre.trim())
          .map((c) => ({ nombre: c.nombre, cargo: c.cargo || undefined, email: c.email, telefono: c.telefono || undefined, whatsapp: c.whatsapp || undefined, principal: c.principal })),
        condiciones: condiciones
          .filter((c) => c.descripcion.trim())
          .map((c) => ({ descripcion: c.descripcion, plazoDias: Number(c.plazoDias || 0), recargoPct: Number(c.recargoPct || 0), descuentoPct: Number(c.descuentoPct || 0) })),
        productos: productos
          .filter((p) => p.nombreProducto.trim())
          .map((p) => ({ nombreProducto: p.nombreProducto, costo: Number(p.costo || 0), moneda: p.moneda || 'ARS', leadTimeDias: numOrUndef(p.leadTimeDias) ?? null, garantiaMeses: numOrUndef(p.garantiaMeses) ?? null })),
      }
      const res = esEdicion
        ? await fetch(`/api/proveedores/${proveedorId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        : await fetch('/api/proveedores', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(mensajeErrorJson(data, 'No se pudo guardar el proveedor'))
      toast.success(esEdicion ? 'Proveedor actualizado' : 'Proveedor creado')
      onSaved()
    } catch (e: unknown) {
      toast.error(mensajeErrorDesconocido(e, 'No se pudo guardar el proveedor'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-[14px] w-full max-w-2xl shadow-xl max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#eef0f2] sticky top-0 bg-white z-10">
          <h3 className="text-[14px] font-bold text-[#16181d]">{esEdicion ? 'Editar proveedor' : 'Nuevo proveedor'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        {cargando ? (
          <div className="p-10 text-center text-[12.5px] text-[#9aa1ab]">Cargando…</div>
        ) : (
          <div className="p-5 flex flex-col gap-5">
            {/* Datos generales */}
            <section className="grid grid-cols-2 gap-3.5">
              <div className="col-span-2"><Input label="Razón social" value={base.razonSocial} onChange={(e) => setB('razonSocial', e.target.value)} autoComplete="organization" /></div>
              <Input label="CUIT" value={base.cuit} onChange={(e) => setB('cuit', e.target.value)} placeholder="30-12345678-9" autoComplete="off" />
              <Combobox label="Condición IVA" value={base.condicionIva} onChange={(v) => setB('condicionIva', v)} options={CONDICION_IVA} placeholder="Seleccionar…" allowCustom />
              <Input label="Rubro" value={base.rubro} onChange={(e) => setB('rubro', e.target.value)} autoComplete="off" />
              <Select label="Origen" value={base.origen} onChange={(e) => setB('origen', e.target.value)} options={[...ORIGEN_PROVEEDOR]} />
              <Input label="Marcas / líneas" value={base.marcas} onChange={(e) => setB('marcas', e.target.value)} placeholder="HAEMONETICS, ..." autoComplete="off" />
              <Input label="Email" type="email" value={base.email} onChange={(e) => setB('email', e.target.value)} autoComplete="email" />
              <Input label="Teléfono" value={base.telefono} onChange={(e) => setB('telefono', e.target.value)} autoComplete="tel" />
              <Input label="Sitio web" value={base.sitioWeb} onChange={(e) => setB('sitioWeb', e.target.value)} autoComplete="url" />
              <Input label="Ciudad" value={base.ciudad} onChange={(e) => setB('ciudad', e.target.value)} autoComplete="address-level2" />
              <div className="col-span-2"><Input label="Dirección" value={base.direccion} onChange={(e) => setB('direccion', e.target.value)} autoComplete="street-address" /></div>
            </section>

            {/* Condiciones comerciales por defecto */}
            <section className="grid grid-cols-2 gap-3.5">
              <div className="col-span-2"><p className="text-[11px] font-bold text-[#8a909a] uppercase tracking-wide">Condiciones comerciales</p></div>
              <Combobox label="Condición de pago" value={base.condicionPago} onChange={(v) => setB('condicionPago', v)} options={CONDICION_PAGO} placeholder="30 días" allowCustom />
              <Select label="Moneda" value={base.moneda} onChange={(e) => setB('moneda', e.target.value)} options={[...MONEDA]} />
              <Input label="% Financiación" type="number" value={base.financiacionPct} onChange={(e) => setB('financiacionPct', e.target.value)} placeholder="0" />
              <Input label="Plazo de entrega (días)" type="number" value={base.plazoEntregaDias} onChange={(e) => setB('plazoEntregaDias', e.target.value)} />
              <Input label="Mínimo de compra" type="number" value={base.minimoCompra} onChange={(e) => setB('minimoCompra', e.target.value)} />
            </section>

            {/* Contactos */}
            <EditableList
              titulo="Contactos"
              onAdd={() => setContactos((s) => [...s, { nombre: '', cargo: '', email: '', telefono: '', whatsapp: '', principal: false }])}
            >
              {contactos.map((c, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-center">
                  <input className={cellCls} placeholder="Nombre" value={c.nombre} onChange={(e) => setContactos((s) => s.map((x, j) => j === i ? { ...x, nombre: e.target.value } : x))} />
                  <input className={cellCls} placeholder="Cargo" value={c.cargo} onChange={(e) => setContactos((s) => s.map((x, j) => j === i ? { ...x, cargo: e.target.value } : x))} />
                  <input className={cellCls + ' col-span-3'} placeholder="Email" value={c.email} onChange={(e) => setContactos((s) => s.map((x, j) => j === i ? { ...x, email: e.target.value } : x))} />
                  <input className={cellCls + ' col-span-3'} placeholder="Teléfono" value={c.telefono} onChange={(e) => setContactos((s) => s.map((x, j) => j === i ? { ...x, telefono: e.target.value } : x))} />
                  <button onClick={() => setContactos((s) => s.filter((_, j) => j !== i))} className="text-[#9aa1ab] hover:text-red-600 justify-self-center"><Trash2 size={14} /></button>
                </div>
              ))}
            </EditableList>

            {/* Condiciones de financiación */}
            <EditableList
              titulo="Financiación por plazo"
              onAdd={() => setCondiciones((s) => [...s, { descripcion: '', plazoDias: '0', recargoPct: '0', descuentoPct: '0' }])}
            >
              {condiciones.map((c, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-center">
                  <input className={cellCls + ' col-span-4'} placeholder="Descripción (30 días)" value={c.descripcion} onChange={(e) => setCondiciones((s) => s.map((x, j) => j === i ? { ...x, descripcion: e.target.value } : x))} />
                  <input className={cellCls + ' col-span-2'} type="number" placeholder="Plazo (d)" value={c.plazoDias} onChange={(e) => setCondiciones((s) => s.map((x, j) => j === i ? { ...x, plazoDias: e.target.value } : x))} />
                  <input className={cellCls + ' col-span-2'} type="number" placeholder="Recargo %" value={c.recargoPct} onChange={(e) => setCondiciones((s) => s.map((x, j) => j === i ? { ...x, recargoPct: e.target.value } : x))} />
                  <input className={cellCls + ' col-span-3'} type="number" placeholder="Descuento %" value={c.descuentoPct} onChange={(e) => setCondiciones((s) => s.map((x, j) => j === i ? { ...x, descuentoPct: e.target.value } : x))} />
                  <button onClick={() => setCondiciones((s) => s.filter((_, j) => j !== i))} className="text-[#9aa1ab] hover:text-red-600 justify-self-center"><Trash2 size={14} /></button>
                </div>
              ))}
            </EditableList>

            {/* Lista de precios */}
            <EditableList
              titulo="Lista de precios (productos)"
              onAdd={() => setProductos((s) => [...s, { nombreProducto: '', costo: '0', moneda: base.moneda || 'ARS', leadTimeDias: '', garantiaMeses: '' }])}
            >
              {productos.map((p, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-center">
                  <input className={cellCls + ' col-span-4'} placeholder="Producto" value={p.nombreProducto} onChange={(e) => setProductos((s) => s.map((x, j) => j === i ? { ...x, nombreProducto: e.target.value } : x))} />
                  <input className={cellCls + ' col-span-2'} type="number" placeholder="Costo" value={p.costo} onChange={(e) => setProductos((s) => s.map((x, j) => j === i ? { ...x, costo: e.target.value } : x))} />
                  <input className={cellCls + ' col-span-2'} placeholder="Moneda" value={p.moneda} onChange={(e) => setProductos((s) => s.map((x, j) => j === i ? { ...x, moneda: e.target.value } : x))} />
                  <input className={cellCls + ' col-span-3'} type="number" placeholder="Plazo entrega (días)" value={p.leadTimeDias} onChange={(e) => setProductos((s) => s.map((x, j) => j === i ? { ...x, leadTimeDias: e.target.value } : x))} />
                  <button onClick={() => setProductos((s) => s.filter((_, j) => j !== i))} className="text-[#9aa1ab] hover:text-red-600 justify-self-center"><Trash2 size={14} /></button>
                </div>
              ))}
            </EditableList>

            <div className="flex flex-col gap-1.5">
              <label className="text-[11.5px] font-semibold text-[#5b626d] tracking-wide uppercase">Notas</label>
              <textarea value={base.notas} onChange={(e) => setB('notas', e.target.value)} rows={2} className="w-full bg-white border border-[#e4e7eb] rounded-[9px] px-3 py-2.5 text-[13.5px] text-[#1f242c] focus:outline-none focus:ring-2 focus:ring-[#E8650A]/40 focus:border-[#E8650A]" />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="secondary" onClick={onClose} disabled={loading}>Cancelar</Button>
              <Button variant="primary" onClick={guardar} loading={loading}>{esEdicion ? 'Guardar' : 'Crear proveedor'}</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const cellCls = 'col-span-2 bg-white border border-[#e4e7eb] rounded-[8px] px-2.5 py-2 text-[12.5px] text-[#1f242c] focus:outline-none focus:ring-2 focus:ring-[#E8650A]/30 focus:border-[#E8650A]'

function EditableList({ titulo, onAdd, children }: { titulo: string; onAdd: () => void; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-bold text-[#8a909a] uppercase tracking-wide">{titulo}</p>
        <button onClick={onAdd} className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-[#E8650A] hover:underline">
          <Plus size={13} /> Agregar
        </button>
      </div>
      {children}
    </section>
  )
}
