'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Search, Plus, ChevronRight, Truck, Pencil, Trash2, Download, Upload } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useCan } from '@/components/auth/useCan'
import { ProveedorModal } from '@/components/proveedores/ProveedorModal'
import { formatMonto } from '@/lib/utils'
import { mensajeErrorDesconocido, mensajeErrorRespuesta } from '@/lib/errores'
import { TIPO_COMPRA_PROVEEDOR } from '@/lib/form-options'
import type { Proveedor } from '@/types'

interface ProveedorRow extends Proveedor {
  _count?: { productos: number; contactos: number }
}

const ORIGENES = [
  { value: 'TODOS', label: 'Todos los orígenes' },
  { value: 'NACIONAL', label: 'Nacional' },
  { value: 'IMPORTADO', label: 'Importado' },
]

const TIPOS_COMPRA = [{ value: 'TODOS', label: 'Todos los tipos' }, ...TIPO_COMPRA_PROVEEDOR]

export function ProveedoresManager({ proveedores }: { proveedores: ProveedorRow[] }) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const puedeCrear = useCan('proveedores.create')
  const puedeEditar = useCan('proveedores.update')
  const puedeBaja = useCan('proveedores.deactivate')
  const [search, setSearch] = useState('')
  const [origen, setOrigen] = useState('TODOS')
  const [tipoCompra, setTipoCompra] = useState('TODOS')
  const [modal, setModal] = useState<null | 'nuevo' | string>(null)
  const [importando, setImportando] = useState(false)

  const filtered = proveedores.filter((p) => {
    const s = search.toLowerCase()
    const matchSearch =
      !s ||
      p.razonSocial.toLowerCase().includes(s) ||
      (p.rubro ?? '').toLowerCase().includes(s) ||
      (p.marcas ?? '').toLowerCase().includes(s) ||
      (p.ciudad ?? '').toLowerCase().includes(s)
    const matchOrigen = origen === 'TODOS' || p.origen === origen
    const matchTipo =
      tipoCompra === 'TODOS' ||
      p.tipoCompra === tipoCompra ||
      (tipoCompra !== 'AMBOS' && p.tipoCompra === 'AMBOS')
    return matchSearch && matchOrigen && matchTipo
  })

  async function darDeBaja(p: ProveedorRow) {
    if (!confirm(`¿Dar de baja el proveedor ${p.razonSocial}?`)) return
    const res = await fetch(`/api/proveedores/${p.id}`, { method: 'DELETE' })
    if (res.ok) { toast.success('Proveedor dado de baja'); router.refresh() }
    else toast.error('No se pudo dar de baja')
  }

  async function descargarPlantilla() {
    try {
      const res = await fetch('/api/proveedores/plantilla', { credentials: 'include' })
      if (!res.ok) throw new Error(await mensajeErrorRespuesta(res, 'No se pudo descargar la plantilla'))
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'plantilla-proveedores-ibiomedica.csv'
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      toast.error(mensajeErrorDesconocido(e, 'No se pudo descargar la plantilla'))
    }
  }

  async function importarCsv(file: File) {
    setImportando(true)
    try {
      const fd = new FormData()
      fd.append('archivo', file)
      const res = await fetch('/api/proveedores/import', {
        method: 'POST',
        credentials: 'include',
        body: fd,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error en la importación')
      toast.success(`Importación: ${data.creados} creados, ${data.omitidos} omitidos`)
      if (data.errores?.length) {
        toast.warning(`${data.errores.length} fila(s) con error — revisá el detalle en consola`)
        console.warn('Errores importación proveedores:', data.errores)
      }
      router.refresh()
    } catch (e) {
      toast.error(mensajeErrorDesconocido(e, 'No se pudo importar el archivo'))
    } finally {
      setImportando(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 bg-white border border-[#e4e7eb] rounded-[9px] px-3 py-2 w-[300px]">
          <Search size={16} className="text-[#9aa1ab]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar proveedor, rubro, marca…"
            className="flex-1 text-[12.5px] bg-transparent border-none outline-none text-[#1f242c] placeholder:text-[#9aa1ab]"
          />
        </div>
        <div className="flex items-center gap-2 bg-white border border-[#e4e7eb] rounded-[9px] px-3 py-2">
          <select
            value={origen}
            onChange={(e) => setOrigen(e.target.value)}
            className="text-[12.5px] text-[#3a4150] font-semibold bg-transparent border-none outline-none cursor-pointer"
          >
            {ORIGENES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2 bg-white border border-[#e4e7eb] rounded-[9px] px-3 py-2">
          <select
            value={tipoCompra}
            onChange={(e) => setTipoCompra(e.target.value)}
            className="text-[12.5px] text-[#3a4150] font-semibold bg-transparent border-none outline-none cursor-pointer"
          >
            {TIPOS_COMPRA.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div className="flex-1" />
        {puedeCrear && (
          <>
            <Button variant="outline" size="md" className="gap-2" onClick={descargarPlantilla}>
              <Download size={16} strokeWidth={2.4} />
              Plantilla CSV
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) importarCsv(f)
              }}
            />
            <Button
              variant="outline"
              size="md"
              className="gap-2"
              loading={importando}
              onClick={() => fileRef.current?.click()}
            >
              <Upload size={16} strokeWidth={2.4} />
              Importar CSV
            </Button>
          </>
        )}
        {puedeCrear && (
          <Button onClick={() => setModal('nuevo')} size="md" className="gap-2">
            <Plus size={16} strokeWidth={2.4} /> Nuevo Proveedor
          </Button>
        )}
      </div>

      <Card padding={false} className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                {['Proveedor', 'Rubro / Marcas', 'Origen', 'Tipo compra', 'Cond. pago', 'Productos', 'Acciones'].map((h, i) => (
                  <th key={h} className={`px-5 py-3 text-[10.5px] font-bold text-[#8a909a] tracking-[0.6px] uppercase border-b border-[#eef0f2] ${i === 6 ? 'text-right' : 'text-left'} ${i === 5 ? 'text-center' : ''}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((p, i) => {
                const initials = p.razonSocial.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()
                return (
                  <tr key={p.id} className={i % 2 === 0 ? 'bg-white' : 'bg-[#fafbfc]'}>
                    <td className="px-5 py-[13px] border-b border-[#f4f5f7]">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-[8px] bg-[#FFF1E2] flex items-center justify-center text-[#E8650A] font-extrabold text-[11px] flex-shrink-0">
                          {initials || <Truck size={14} />}
                        </div>
                        <div>
                          <p className="text-[12.5px] font-bold text-[#1f242c]">{p.razonSocial}</p>
                          {p.cuit && <p className="text-[11px] text-[#9aa1ab]">CUIT {p.cuit}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-[13px] text-[12.5px] text-[#6b7280] border-b border-[#f4f5f7]">
                      {p.rubro ?? '—'}
                      {p.marcas && <span className="block text-[11px] text-[#9aa1ab]">{p.marcas}</span>}
                    </td>
                    <td className="px-5 py-[13px] border-b border-[#f4f5f7]">
                      <Badge variant={p.origen === 'IMPORTADO' ? 'info' : 'gray'}>
                        {p.origen === 'IMPORTADO' ? 'Importado' : 'Nacional'}
                      </Badge>
                    </td>
                    <td className="px-5 py-[13px] border-b border-[#f4f5f7]">
                      <Badge variant={p.tipoCompra === 'CONCEPTOS' ? 'warning' : p.tipoCompra === 'REMITO' ? 'info' : 'gray'}>
                        {TIPO_COMPRA_PROVEEDOR.find((t) => t.value === (p.tipoCompra ?? 'AMBOS'))?.label ?? 'Ambos'}
                      </Badge>
                    </td>
                    <td className="px-5 py-[13px] text-[12.5px] text-[#6b7280] border-b border-[#f4f5f7]">
                      {p.condicionPago ?? '—'}
                      {p.minimoCompra != null && <span className="block text-[11px] text-[#9aa1ab]">Mín. {formatMonto(p.minimoCompra)}</span>}
                    </td>
                    <td className="px-5 py-[13px] text-center text-[12.5px] font-bold text-[#3a4150] border-b border-[#f4f5f7]">
                      {p._count?.productos ?? 0}
                    </td>
                    <td className="px-5 py-[13px] text-right border-b border-[#f4f5f7]">
                      <div className="flex items-center justify-end gap-3">
                        {puedeEditar && (
                          <button onClick={() => setModal(p.id)} className="text-[#5b626d] hover:text-[#E8650A]" title="Editar">
                            <Pencil size={15} />
                          </button>
                        )}
                        {puedeBaja && (
                          <button onClick={() => darDeBaja(p)} className="text-[#5b626d] hover:text-red-600" title="Dar de baja">
                            <Trash2 size={15} />
                          </button>
                        )}
                        <Link href={`/proveedores/${p.id}`} className="inline-flex items-center gap-1 text-[#E8650A] text-[12px] font-bold hover:underline">
                          Ver ficha <ChevronRight size={13} strokeWidth={2.4} />
                        </Link>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-[12.5px] text-[#9aa1ab]">
                    No se encontraron proveedores con los filtros aplicados
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {modal && (
        <ProveedorModal
          proveedorId={modal === 'nuevo' ? undefined : modal}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); router.refresh() }}
        />
      )}
    </div>
  )
}
