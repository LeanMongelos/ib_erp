'use client'

import { useMemo, useRef, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import {
  AlertTriangle, Download, Package, Plus, RefreshCw, Search, Upload, Pencil, SlidersHorizontal, ArrowLeftRight,
} from 'lucide-react'
import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { Combobox } from '@/components/ui/combobox'
import { CATEGORIAS_INVENTARIO } from '@/lib/form-options'
import { useCan } from '@/components/auth/useCan'
import { formatMontoMoneda } from '@/lib/moneda'
import { mensajeErrorDesconocido, mensajeErrorRespuesta } from '@/lib/errores'
import { ProductoFotoField, subirFotoInventario } from '@/components/inventario/ProductoFotoField'
import { TIPOS_ARTICULO, TIPOS_KIT, MODOS_TRAZABILIDAD } from '@/lib/inventario-constants'
import { InventarioUnidadesPanel } from '@/components/inventario/InventarioUnidadesPanel'
import { TransferirStockModal } from '@/components/inventario/TransferirStockModal'
import { StockPorDepositoPanel } from '@/components/inventario/StockPorDepositoPanel'
import { validarCodigoInterno } from '@/lib/inventario/codigo-interno'

export interface KitItemForm {
  nombre: string
  tipoItem: 'ACCESORIO_ESPECIFICO' | 'ACCESORIO_GENERICO' | 'BATERIA' | 'COMPONENTE' | 'REPUESTO_INCLUIDO'
  tipoComponente?: 'BATERIA' | 'FILTRO' | 'CALIBRACION' | 'SENSOR' | 'OTRO' | ''
  inventarioHijoId?: string
  obligatorio: boolean
  cantidad: number
  mesesVencimiento?: number
  notas?: string
}

export interface ItemInventario {
  id: string
  nombre: string
  descripcion: string | null
  sku: string | null
  tipoArticulo: string
  marca: string | null
  modelo: string | null
  esSerializado: boolean
  requierePreventivo: boolean
  intervaloPreventivoDias: number | null
  modoTrazabilidad?: string
  stock: number
  stockMinimo: number
  stockMaximo: number | null
  puntoPedido: number | null
  precioUnit: number | null
  moneda: string
  categoria: string | null
  fotoUrl?: string | null
  kitComoEquipo?: KitItemForm[]
  alicuotaIva?: { id: string; porcentaje: number; nombre: string } | null
}

type FormData = {
  nombre: string
  sku: string
  descripcion: string
  categoria: string
  tipoArticulo: string
  marca: string
  modelo: string
  esSerializado: boolean
  requierePreventivo: boolean
  intervaloPreventivoDias: string
  modoTrazabilidad: string
  stock: string
  stockMinimo: string
  stockMaximo: string
  puntoPedido: string
  precioUnit: string
  moneda: string
  kitItems: KitItemForm[]
}

const kitVacio = (): KitItemForm => ({
  nombre: '',
  tipoItem: 'ACCESORIO_ESPECIFICO',
  obligatorio: false,
  cantidad: 1,
})

const formVacio = (): FormData => ({
  nombre: '',
  sku: '',
  descripcion: '',
  categoria: '',
  tipoArticulo: 'REPUESTO',
  marca: '',
  modelo: '',
  esSerializado: false,
  requierePreventivo: false,
  intervaloPreventivoDias: '180',
  modoTrazabilidad: 'NINGUNA',
  stock: '0',
  stockMinimo: '5',
  stockMaximo: '',
  puntoPedido: '',
  precioUnit: '',
  moneda: 'ARS',
  kitItems: [],
})

function itemAForm(item: ItemInventario): FormData {
  return {
    nombre: item.nombre,
    sku: item.sku ?? '',
    descripcion: item.descripcion ?? '',
    categoria: item.categoria ?? '',
    tipoArticulo: item.tipoArticulo ?? 'REPUESTO',
    marca: item.marca ?? '',
    modelo: item.modelo ?? '',
    esSerializado: item.esSerializado ?? false,
    requierePreventivo: item.requierePreventivo ?? false,
    intervaloPreventivoDias: item.intervaloPreventivoDias != null ? String(item.intervaloPreventivoDias) : '180',
    modoTrazabilidad: item.modoTrazabilidad ?? (item.tipoArticulo === 'EQUIPO' && item.esSerializado ? 'SERIE' : 'NINGUNA'),
    stock: String(item.stock),
    stockMinimo: String(item.stockMinimo),
    stockMaximo: item.stockMaximo != null ? String(item.stockMaximo) : '',
    puntoPedido: item.puntoPedido != null ? String(item.puntoPedido) : '',
    precioUnit: item.precioUnit != null ? String(item.precioUnit) : '',
    moneda: item.moneda ?? 'ARS',
    kitItems: (item.kitComoEquipo ?? []).map((k) => ({
      nombre: k.nombre,
      tipoItem: k.tipoItem as KitItemForm['tipoItem'],
      tipoComponente: (k.tipoComponente as KitItemForm['tipoComponente']) ?? '',
      inventarioHijoId: k.inventarioHijoId,
      obligatorio: k.obligatorio,
      cantidad: k.cantidad,
      mesesVencimiento: k.mesesVencimiento,
      notas: k.notas,
    })),
  }
}

interface Props {
  items: ItemInventario[]
  faltantesCount: number
}

export function InventarioManager({ items: inicial, faltantesCount }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const puedeCrear = useCan('inventario.create')
  const puedeEditar = useCan('inventario.update')
  const puedeAjustar = useCan('inventario.adjust_stock')
  const puedeTransferir = useCan('inventario.transfer')
  const puedeVerStockDeposito = useCan('inventario.read')

  const [vista, setVista] = useState<'catalogo' | 'stock-deposito'>('catalogo')
  const [items, setItems] = useState(inicial)
  const [busqueda, setBusqueda] = useState('')
  const [modalAlta, setModalAlta] = useState(false)
  const [editando, setEditando] = useState<ItemInventario | null>(null)
  const [ajustando, setAjustando] = useState<ItemInventario | null>(null)
  const [transfiriendo, setTransfiriendo] = useState<ItemInventario | null>(null)
  const [depositos, setDepositos] = useState<Array<{ id: string; nombre: string }>>([])
  const [importando, setImportando] = useState(false)
  const [form, setForm] = useState<FormData>(formVacio())
  const [loading, setLoading] = useState(false)
  const [ajusteCant, setAjusteCant] = useState('1')
  const [ajusteTipo, setAjusteTipo] = useState<'ENTRADA' | 'SALIDA' | 'AJUSTE'>('ENTRADA')
  const [fotoUrl, setFotoUrl] = useState<string | null>(null)
  const [fotoPendiente, setFotoPendiente] = useState<File | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const csvFileRef = useRef<HTMLInputElement>(null)

  const [categoriasOpciones, setCategoriasOpciones] = useState(CATEGORIAS_INVENTARIO)

  useEffect(() => {
    const q = searchParams.get('q')?.trim()
    if (q) setBusqueda(q)
  }, [searchParams])

  const soloBajo = searchParams.get('bajo') === '1'

  useEffect(() => {
    fetch('/api/config/catalogos?tipo=categorias', { credentials: 'include' })
      .then((r) => r.json())
      .then((rows: { nombre: string }[]) => {
        if (Array.isArray(rows) && rows.length) {
          setCategoriasOpciones(rows.map((c) => ({ value: c.nombre, label: c.nombre })))
        }
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!puedeVerStockDeposito) return
    fetch('/api/config/catalogos?tipo=depositos', { credentials: 'include' })
      .then((r) => r.json())
      .then((rows: { id: string; nombre: string }[]) => {
        if (Array.isArray(rows)) setDepositos(rows)
      })
      .catch(() => {})
  }, [puedeVerStockDeposito])

  const filtrados = useMemo(() => {
    let list = items
    if (soloBajo) {
      list = list.filter((i) => i.stock <= i.stockMinimo)
    }
    const q = busqueda.trim().toLowerCase()
    if (!q) return list
    return list.filter(
      (i) =>
        i.nombre.toLowerCase().includes(q) ||
        (i.sku?.toLowerCase().includes(q) ?? false) ||
        (i.categoria?.toLowerCase().includes(q) ?? false),
    )
  }, [items, busqueda, soloBajo])

  const stockBajo = items.filter((i) => i.stock <= i.stockMinimo)

  async function recargar() {
    const res = await fetch('/api/inventario', { credentials: 'include' })
    if (!res.ok) throw new Error(await mensajeErrorRespuesta(res, 'Error al cargar inventario'))
    const data = await res.json()
    if (!Array.isArray(data)) throw new Error('Respuesta inválida')
    setItems(data)
    router.refresh()
  }

  function parseForm(editable = false) {
    const stock = Number(form.stock)
    const stockMinimo = Number(form.stockMinimo)
    const stockMaximo = form.stockMaximo.trim() ? Number(form.stockMaximo) : null
    const puntoPedido = form.puntoPedido.trim() ? Number(form.puntoPedido) : null
    const precioUnit = form.precioUnit.trim() ? Number(form.precioUnit) : null
    const intervalo = form.intervaloPreventivoDias.trim() ? Number(form.intervaloPreventivoDias) : null
    if (!form.nombre.trim()) throw new Error('El nombre es obligatorio')
    if (Number.isNaN(stock) || stock < 0) throw new Error('Stock inválido')
    const esEquipo = form.tipoArticulo === 'EQUIPO'

    let sku: string | undefined
    if (!editable) {
      const codigo = validarCodigoInterno(form.sku)
      if (!codigo.ok) throw new Error(codigo.error)
      sku = codigo.codigo
    } else if (form.sku.trim()) {
      const codigo = validarCodigoInterno(form.sku)
      if (!codigo.ok) throw new Error(codigo.error)
      sku = codigo.codigo
    }

    return {
      nombre: form.nombre.trim(),
      sku,
      descripcion: form.descripcion.trim() || undefined,
      categoria: form.categoria.trim() || undefined,
      tipoArticulo: form.tipoArticulo,
      marca: form.marca.trim() || null,
      modelo: form.modelo.trim() || null,
      esSerializado: esEquipo ? form.esSerializado : false,
      requierePreventivo: esEquipo ? form.requierePreventivo : false,
      intervaloPreventivoDias: esEquipo ? intervalo : null,
      modoTrazabilidad: esEquipo ? form.modoTrazabilidad : 'NINGUNA',
      stock: editable ? undefined : stock,
      stockMinimo,
      stockMaximo,
      puntoPedido,
      precioUnit,
      moneda: form.moneda || 'ARS',
      kitItems: esEquipo
        ? form.kitItems.filter((k) => k.nombre.trim()).map((k) => ({
            ...k,
            nombre: k.nombre.trim(),
            mesesVencimiento: k.mesesVencimiento || null,
            tipoComponente: k.tipoComponente || null,
            inventarioHijoId: k.inventarioHijoId || null,
          }))
        : [],
    }
  }

  async function guardarAlta() {
    setLoading(true)
    try {
      const payload = parseForm(false)
      const res = await fetch('/api/inventario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error(await mensajeErrorRespuesta(res, 'No se pudo crear el producto'))
      const creado = (await res.json()) as { id: string }
      if (fotoPendiente) {
        await subirFotoInventario(creado.id, fotoPendiente)
      }
      toast.success('Producto agregado al inventario')
      setModalAlta(false)
      setForm(formVacio())
      setFotoUrl(null)
      setFotoPendiente(null)
      await recargar()
    } catch (e) {
      toast.error(mensajeErrorDesconocido(e, 'No se pudo crear el producto'))
    } finally {
      setLoading(false)
    }
  }

  async function guardarEdicion() {
    if (!editando) return
    setLoading(true)
    try {
      const payload = parseForm(true)
      const res = await fetch(`/api/inventario/${editando.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error(await mensajeErrorRespuesta(res, 'No se pudo actualizar'))
      toast.success('Producto actualizado')
      setEditando(null)
      await recargar()
    } catch (e) {
      toast.error(mensajeErrorDesconocido(e, 'No se pudo actualizar'))
    } finally {
      setLoading(false)
    }
  }

  async function guardarAjuste() {
    if (!ajustando) return
    const cantidad = Number(ajusteCant)
    if (!Number.isInteger(cantidad) || cantidad <= 0) {
      toast.error('Cantidad inválida')
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/inventario/${ajustando.id}/ajustar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ cantidad, tipo: ajusteTipo }),
      })
      if (!res.ok) throw new Error(await mensajeErrorRespuesta(res, 'No se pudo ajustar el stock'))
      toast.success('Stock actualizado')
      setAjustando(null)
      await recargar()
    } catch (e) {
      toast.error(mensajeErrorDesconocido(e, 'No se pudo ajustar el stock'))
    } finally {
      setLoading(false)
    }
  }

  async function descargarPlantilla() {
    try {
      const res = await fetch('/api/inventario/plantilla', { credentials: 'include' })
      if (!res.ok) throw new Error(await mensajeErrorRespuesta(res, 'No se pudo descargar la plantilla'))
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'plantilla-inventario-ibiomedica.xlsx'
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      toast.error(mensajeErrorDesconocido(e, 'No se pudo descargar la plantilla'))
    }
  }

  async function descargarPlantillaCsv() {
    try {
      const res = await fetch('/api/inventario/plantilla?formato=csv', { credentials: 'include' })
      if (!res.ok) throw new Error(await mensajeErrorRespuesta(res, 'No se pudo descargar la plantilla'))
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'plantilla-inventario-ibiomedica.csv'
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      toast.error(mensajeErrorDesconocido(e, 'No se pudo descargar la plantilla'))
    }
  }

  async function importarArchivo(file: File, esCsv: boolean) {
    setImportando(true)
    try {
      const fd = new FormData()
      fd.append('archivo', file)
      const res = await fetch('/api/inventario/import', {
        method: 'POST',
        credentials: 'include',
        body: fd,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error en la importación')
      const omitidos = data.omitidos ? `, ${data.omitidos} omitidos` : ''
      toast.success(`Importación: ${data.creados} creados, ${data.actualizados ?? 0} actualizados${omitidos}`)
      if (data.errores?.length) {
        toast.warning(`${data.errores.length} fila(s) con error — revisá el detalle en consola`)
        console.warn('Errores importación inventario:', data.errores)
      }
      await recargar()
    } catch (e) {
      toast.error(mensajeErrorDesconocido(e, `No se pudo importar el ${esCsv ? 'CSV' : 'Excel'}`))
    } finally {
      setImportando(false)
      if (esCsv && csvFileRef.current) csvFileRef.current.value = ''
      if (!esCsv && fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {puedeVerStockDeposito && (
        <div className="flex flex-wrap gap-2 border-b border-[#e4e7eb] pb-2">
          <button
            type="button"
            onClick={() => setVista('catalogo')}
            className={`px-3 py-2 rounded-[8px] text-[12px] font-semibold transition-colors ${
              vista === 'catalogo' ? 'bg-[#E8650A] text-white' : 'bg-white text-[#3a4150] border border-[#e4e7eb]'
            }`}
          >
            Catálogo de productos
          </button>
          <button
            type="button"
            onClick={() => setVista('stock-deposito')}
            className={`px-3 py-2 rounded-[8px] text-[12px] font-semibold transition-colors ${
              vista === 'stock-deposito' ? 'bg-[#E8650A] text-white' : 'bg-white text-[#3a4150] border border-[#e4e7eb]'
            }`}
          >
            Stock por depósito
          </button>
        </div>
      )}

      {vista === 'stock-deposito' ? (
        <StockPorDepositoPanel depositos={depositos} />
      ) : (
        <>
      {faltantesCount > 0 && (
        <div className="flex items-center justify-between gap-3 bg-orange-50 border border-orange-200 rounded-[10px] px-4 py-3">
          <p className="text-[12.5px] font-semibold text-orange-800">
            {faltantesCount} ítem{faltantesCount !== 1 ? 's' : ''} requieren reposición.
          </p>
          <Link href="/compras">
            <Button variant="outline" size="sm">Generar OC en Compras</Button>
          </Link>
        </div>
      )}

      {stockBajo.length > 0 && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-[10px] px-4 py-3">
          <AlertTriangle size={18} className="text-red-500 shrink-0" />
          <p className="text-[12.5px] font-semibold text-red-700">
            {stockBajo.length} producto{stockBajo.length !== 1 ? 's' : ''} con stock bajo.
          </p>
        </div>
      )}

      <Card className="bg-[#FFFBF5] border-[#FFE4CC]">
        <p className="text-[12.5px] text-[#7c4a1a] leading-relaxed">
          Catálogo unificado: repuestos, accesorios, baterías y <strong>equipos serializados</strong>.
          Un equipo incluye su kit (accesorios específicos/genéricos, baterías, componentes).
          Al <strong>emitir la factura</strong> se crea el equipo en el cliente, el plan preventivo y la OT de servicio técnico.
        </p>
      </Card>

      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="flex items-center gap-2 bg-white border border-[#e4e7eb] rounded-[9px] px-3 py-2 w-full max-w-xs">
          <Search size={15} className="text-[#9aa1ab]" />
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar producto o código interno…"
            className="flex-1 text-[13px] outline-none bg-transparent"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => recargar().catch(() => toast.error('Error al actualizar'))}>
            <RefreshCw size={14} /> Actualizar
          </Button>
          <Button variant="outline" size="sm" onClick={descargarPlantilla}>
            <Download size={14} /> Plantilla Excel
          </Button>
          <Button variant="outline" size="sm" onClick={descargarPlantillaCsv}>
            <Download size={14} /> Plantilla CSV
          </Button>
          {puedeCrear && (
            <>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) importarArchivo(f, false)
                }}
              />
              <input
                ref={csvFileRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) importarArchivo(f, true)
                }}
              />
              <Button variant="outline" size="sm" loading={importando} onClick={() => fileRef.current?.click()}>
                <Upload size={14} /> Importar Excel
              </Button>
              <Button variant="outline" size="sm" loading={importando} onClick={() => csvFileRef.current?.click()}>
                <Upload size={14} /> Importar CSV
              </Button>
              <Button variant="primary" size="sm" onClick={() => { setForm(formVacio()); setFotoUrl(null); setFotoPendiente(null); setModalAlta(true) }}>
                <Plus size={14} /> Nuevo producto
              </Button>
            </>
          )}
        </div>
      </div>

      <Card padding={false}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                {['', 'Producto', 'Tipo', 'Código interno', 'Stock', 'Preventivo', 'Precio', 'Estado', ''].map((h) => (
                  <th key={h || 'acc'} className="px-5 py-3 text-left text-[10.5px] font-bold text-[#8a909a] tracking-[0.6px] uppercase border-b border-[#eef0f2]">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtrados.map((item, i) => {
                const bajo = item.stock <= item.stockMinimo
                return (
                  <tr key={item.id} className={i % 2 === 0 ? 'bg-white' : 'bg-[#fafbfc]'}>
                    <td className="px-3 py-[13px] border-b border-[#f4f5f7] w-[52px]">
                      {item.fotoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.fotoUrl} alt="" className="w-10 h-10 rounded-[6px] object-contain border border-[#eef0f2] bg-white" />
                      ) : (
                        <div className="w-10 h-10 rounded-[6px] bg-[#f4f5f7] flex items-center justify-center">
                          <Package size={16} className="text-[#c4c9d1]" />
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-[13px] border-b border-[#f4f5f7]">
                      <p className="text-[12.5px] font-bold text-[#1f242c]">{item.nombre}</p>
                      {item.descripcion && <p className="text-[11px] text-[#9aa1ab] mt-0.5 line-clamp-1">{item.descripcion}</p>}
                    </td>
                    <td className="px-5 py-[13px] text-[12px] border-b border-[#f4f5f7]">
                      <span className="font-semibold text-[#3a4150]">
                        {TIPOS_ARTICULO.find((t) => t.value === item.tipoArticulo)?.label ?? item.tipoArticulo}
                      </span>
                      {item.marca && <p className="text-[10px] text-[#9aa1ab]">{item.marca} {item.modelo}</p>}
                    </td>
                    <td className="px-5 py-[13px] text-[12px] font-mono text-[#6b7280] border-b border-[#f4f5f7]">{item.sku ?? '—'}</td>
                    <td className={`px-5 py-[13px] text-[12.5px] font-bold border-b border-[#f4f5f7] ${bajo ? 'text-red-600' : 'text-[#1f242c]'}`}>
                      {item.stock}
                    </td>
                    <td className="px-5 py-[13px] text-[11px] text-[#6b7280] border-b border-[#f4f5f7]">
                      {item.tipoArticulo === 'EQUIPO' && item.requierePreventivo
                        ? `${item.intervaloPreventivoDias ?? 180} d`
                        : '—'}
                      {(item.kitComoEquipo?.length ?? 0) > 0 && (
                        <p className="text-[10px] text-[#9aa1ab]">{item.kitComoEquipo!.length} kit</p>
                      )}
                    </td>
                    <td className="px-5 py-[13px] text-[12.5px] border-b border-[#f4f5f7]">
                      {item.precioUnit != null ? formatMontoMoneda(item.precioUnit, item.moneda ?? 'ARS') : '—'}
                    </td>
                    <td className="px-5 py-[13px] border-b border-[#f4f5f7]">
                      <span className={`inline-flex text-[11px] font-bold px-2.5 py-0.5 rounded-full ${bajo ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                        {bajo ? 'Stock bajo' : 'Normal'}
                      </span>
                    </td>
                    <td className="px-5 py-[13px] border-b border-[#f4f5f7]">
                      <div className="flex gap-1">
                        {puedeEditar && (
                          <button type="button" onClick={() => { setEditando(item); setForm(itemAForm(item)); setFotoUrl(item.fotoUrl ?? null); setFotoPendiente(null) }} className="p-1.5 rounded hover:bg-gray-100 text-[#6b7280]" title="Editar">
                            <Pencil size={14} />
                          </button>
                        )}
                        {puedeAjustar && (
                          <button type="button" onClick={() => setAjustando(item)} className="p-1.5 rounded hover:bg-gray-100 text-[#6b7280]" title="Ajustar stock">
                            <SlidersHorizontal size={14} />
                          </button>
                        )}
                        {puedeTransferir && depositos.length >= 2 && (
                          <button
                            type="button"
                            onClick={() => setTransfiriendo(item)}
                            className="p-1.5 rounded hover:bg-gray-100 text-[#6b7280]"
                            title="Transferir entre depósitos"
                          >
                            <ArrowLeftRight size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
              {filtrados.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-5 py-10 text-center text-[12.5px] text-[#9aa1ab]">
                    <Package size={24} className="mx-auto mb-2 opacity-40" />
                    {items.length === 0 ? 'Sin productos — agregá uno o importá desde Excel' : 'Sin resultados para la búsqueda'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {(modalAlta || editando) && (
        <ModalForm
          categoriasOpciones={categoriasOpciones}
          titulo={editando ? 'Editar producto' : 'Nuevo producto'}
          esAlta={!editando}
          form={form}
          setForm={setForm}
          loading={loading}
          ocultarStock={!!editando}
          inventarioId={editando?.id}
          fotoUrl={fotoUrl}
          onFotoChange={setFotoUrl}
          onArchivoPendiente={setFotoPendiente}
          puedeEditarUnidades={editando ? puedeEditar : puedeCrear}
          onClose={() => { setModalAlta(false); setEditando(null); setFotoUrl(null); setFotoPendiente(null) }}
          onSave={editando ? guardarEdicion : guardarAlta}
        />
      )}

      {ajustando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" data-modal-overlay>
          <div className="bg-white rounded-[14px] w-full max-w-sm shadow-xl p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-[14px] font-bold mb-1">Ajustar stock</h3>
            <p className="text-[12px] text-[#6b7280] mb-4">{ajustando.nombre} · actual: {ajustando.stock}</p>
            <div className="flex flex-col gap-3">
              <select value={ajusteTipo} onChange={(e) => setAjusteTipo(e.target.value as typeof ajusteTipo)} className="border border-[#e4e7eb] rounded-[9px] px-3 py-2 text-[13px]">
                <option value="ENTRADA">Entrada (+)</option>
                <option value="SALIDA">Salida (−)</option>
                <option value="AJUSTE">Ajuste (+)</option>
              </select>
              <input value={ajusteCant} onChange={(e) => setAjusteCant(e.target.value)} type="number" min={1} className="border border-[#e4e7eb] rounded-[9px] px-3 py-2 text-[13px]" />
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="secondary" onClick={() => setAjustando(null)}>Cancelar</Button>
              <Button variant="primary" loading={loading} onClick={guardarAjuste}>Aplicar</Button>
            </div>
          </div>
        </div>
      )}

      {transfiriendo && (
        <TransferirStockModal
          item={transfiriendo}
          depositos={depositos}
          onClose={() => setTransfiriendo(null)}
          onSuccess={() => recargar().catch(() => toast.error('Error al actualizar'))}
        />
      )}
        </>
      )}
    </div>
  )
}

function ModalForm({
  titulo,
  esAlta = false,
  form,
  setForm,
  loading,
  ocultarStock,
  categoriasOpciones,
  inventarioId,
  fotoUrl,
  onFotoChange,
  onArchivoPendiente,
  puedeEditarUnidades,
  onClose,
  onSave,
}: {
  titulo: string
  esAlta?: boolean
  form: FormData
  setForm: (f: FormData) => void
  loading: boolean
  ocultarStock?: boolean
  categoriasOpciones: { value: string; label: string }[]
  inventarioId?: string
  fotoUrl: string | null
  onFotoChange: (url: string | null) => void
  onArchivoPendiente: (file: File | null) => void
  puedeEditarUnidades: boolean
  onClose: () => void
  onSave: () => void
}) {
  const esEquipo = form.tipoArticulo === 'EQUIPO'
  const muestraUnidades = esEquipo || form.modoTrazabilidad !== 'NINGUNA'
  const [tab, setTab] = useState<'general' | 'stock' | 'unidades' | 'preventivo' | 'kit'>('general')

  const tabs = [
    { id: 'general' as const, label: 'General' },
    { id: 'stock' as const, label: 'Stock y precio' },
    ...(muestraUnidades ? [{ id: 'unidades' as const, label: 'SN/Lote' }] : []),
    ...(esEquipo ? [{ id: 'preventivo' as const, label: 'Preventivo' }] : []),
    ...(esEquipo ? [{ id: 'kit' as const, label: 'Kit' }] : []),
  ]

  const field = (key: keyof Omit<FormData, 'kitItems' | 'esSerializado' | 'requierePreventivo' | 'modoTrazabilidad'>, label: string, opts?: { type?: string; required?: boolean; span?: boolean; autoComplete?: string }) => (
    <div className={`flex flex-col gap-1.5 ${opts?.span ? 'sm:col-span-2' : ''}`}>
      <label className="text-[11.5px] font-semibold text-[#5b626d] uppercase">{label}</label>
      <input
        type={opts?.type ?? 'text'}
        required={opts?.required}
        value={String(form[key] ?? '')}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        autoComplete={opts?.autoComplete ?? 'off'}
        className="border border-[#e4e7eb] rounded-[9px] px-3 py-2 text-[13px]"
      />
    </div>
  )

  function actualizarKit(idx: number, patch: Partial<KitItemForm>) {
    setForm({
      ...form,
      kitItems: form.kitItems.map((k, i) => (i === idx ? { ...k, ...patch } : k)),
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" data-modal-overlay>
      <div className="bg-white rounded-[14px] w-full max-w-2xl shadow-xl max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-[#eef0f2]">
          <h3 className="text-[14px] font-bold">{titulo}</h3>
          <p className="text-[11.5px] text-[#6b7280] mt-1">Tipo «Equipo» habilita kit clínico y flujo automático de preventivo al facturar.</p>
          <div className="flex flex-wrap gap-1 mt-3">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`px-3 py-1 text-[11.5px] font-bold rounded-full border ${
                  tab === t.id
                    ? 'bg-[#FFF4EC] border-[#E8650A] text-[#E8650A]'
                    : 'border-[#e4e7eb] text-[#6b7280] hover:border-[#d1d5db]'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <div className="p-5 flex flex-col gap-5">
          {tab === 'general' && (
          <section>
            <h4 className="text-[12px] font-bold text-[#E8650A] mb-3 uppercase tracking-wide">Identificación</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <Select
                  label="Tipo de artículo *"
                  value={form.tipoArticulo}
                  onChange={(e) => {
                    const t = e.target.value
                    setForm({
                      ...form,
                      tipoArticulo: t,
                      esSerializado: t === 'EQUIPO' ? true : form.esSerializado,
                      requierePreventivo: t === 'EQUIPO' ? true : form.requierePreventivo,
                      modoTrazabilidad: t === 'EQUIPO' ? 'SERIE' : 'NINGUNA',
                    })
                  }}
                  options={[...TIPOS_ARTICULO]}
                />
              </div>
              {esEquipo && (
                <div className="sm:col-span-2">
                  <Select
                    label="Trazabilidad por unidad"
                    value={form.modoTrazabilidad}
                    onChange={(e) => setForm({ ...form, modoTrazabilidad: e.target.value })}
                    options={[...MODOS_TRAZABILIDAD]}
                  />
                </div>
              )}
              {field('nombre', 'Nombre *', { required: true, span: true, autoComplete: 'off' })}
              <div className="flex flex-col gap-1.5">
                <label className="text-[11.5px] font-semibold text-[#5b626d] uppercase">
                  Código interno{esAlta ? ' *' : ''}
                </label>
                <input
                  type="text"
                  required={esAlta}
                  value={form.sku}
                  onChange={(e) => {
                    const v = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8)
                    setForm({ ...form, sku: v })
                  }}
                  maxLength={8}
                  autoComplete="off"
                  placeholder="HOE098"
                  className="border border-[#e4e7eb] rounded-[9px] px-3 py-2 text-[13px] font-mono uppercase"
                />
                <p className="text-[10.5px] text-[#9aa1ab] leading-snug">
                  3–4 letras + 3–4 números (mín. HOE098 · máx. ABCD1234). Identificador único en stock.
                </p>
              </div>
              {field('marca', 'Marca', { autoComplete: 'off' })}
              {field('modelo', 'Modelo', { autoComplete: 'off' })}
              <div className="sm:col-span-2">
                <Combobox
                  label="Categoría"
                  value={form.categoria}
                  onChange={(v) => setForm({ ...form, categoria: v })}
                  options={categoriasOpciones}
                  placeholder="Monitoreo, Repuestos…"
                  allowCustom
                />
              </div>
              {field('descripcion', 'Descripción', { span: true })}
            </div>
            <div className="mt-4">
              <ProductoFotoField
                inventarioId={inventarioId}
                fotoUrl={fotoUrl}
                onFotoChange={onFotoChange}
                onArchivoPendiente={onArchivoPendiente}
                disabled={loading}
              />
            </div>
          </section>
          )}

          {tab === 'stock' && (
          <section>
            <h4 className="text-[12px] font-bold text-[#E8650A] mb-3 uppercase tracking-wide">Stock y precio</h4>
            {form.modoTrazabilidad !== 'NINGUNA' && (
              <p className="text-[11px] text-[#6b7280] mb-3">
                Con trazabilidad activa, el stock se calcula desde las unidades SN/Lote en estado «En stock».
              </p>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {!ocultarStock && form.modoTrazabilidad === 'NINGUNA' && field('stock', 'Stock inicial', { type: 'number' })}
              {!ocultarStock && form.modoTrazabilidad !== 'NINGUNA' && (
                <p className="sm:col-span-2 text-[11px] text-[#9aa1ab]">El stock inicial se define cargando unidades en la pestaña SN/Lote.</p>
              )}
              {field('stockMinimo', 'Stock mínimo', { type: 'number' })}
              {field('stockMaximo', 'Stock máximo', { type: 'number' })}
              {field('puntoPedido', 'Punto de pedido', { type: 'number' })}
              {field('precioUnit', 'Precio unitario referencia', { type: 'number' })}
              <Select
                label="Moneda del precio"
                value={form.moneda}
                onChange={(e) => setForm({ ...form, moneda: e.target.value })}
                options={[
                  { value: 'ARS', label: 'ARS — Peso argentino' },
                  { value: 'USD', label: 'USD — Dólar' },
                ]}
              />
            </div>
          </section>
          )}

          {tab === 'unidades' && muestraUnidades && (
            inventarioId ? (
              <InventarioUnidadesPanel
                inventarioId={inventarioId}
                modoTrazabilidad={form.modoTrazabilidad}
                puedeEditar={puedeEditarUnidades}
              />
            ) : (
              <p className="text-[12px] text-[#6b7280] py-4">
                Guardá el producto primero para cargar unidades con serie o lote.
              </p>
            )
          )}

          {tab === 'preventivo' && esEquipo && (
            <>
              <section>
                <h4 className="text-[12px] font-bold text-[#E8650A] mb-3 uppercase tracking-wide">Preventivo (post-venta)</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="flex items-center gap-2 text-[13px] sm:col-span-2">
                    <input type="checkbox" checked={form.esSerializado} onChange={(e) => setForm({ ...form, esSerializado: e.target.checked })} />
                    Requiere número de serie al vender
                  </label>
                  <label className="flex items-center gap-2 text-[13px] sm:col-span-2">
                    <input type="checkbox" checked={form.requierePreventivo} onChange={(e) => setForm({ ...form, requierePreventivo: e.target.checked })} />
                    Generar plan preventivo y OT al emitir factura
                  </label>
                  {field('intervaloPreventivoDias', 'Intervalo preventivo (días)', { type: 'number' })}
                </div>
              </section>
            </>
          )}

          {tab === 'kit' && esEquipo && (
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-[12px] font-bold text-[#E8650A] uppercase tracking-wide">Kit del equipo</h4>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, kitItems: [...form.kitItems, kitVacio()] })}
                    className="text-[11.5px] font-bold text-[#E8650A] hover:underline"
                  >
                    + Agregar ítem al kit
                  </button>
                </div>
                <p className="text-[11px] text-[#6b7280] mb-3">
                  Accesorios específicos/genéricos, baterías y componentes que servicio técnico verá en la ficha del equipo al venderlo.
                </p>
                {form.kitItems.length === 0 && (
                  <p className="text-[12px] text-[#9aa1ab] py-4 text-center border border-dashed rounded-[9px]">Sin ítems en el kit — agregá baterías y accesorios</p>
                )}
                <div className="flex flex-col gap-3">
                  {form.kitItems.map((k, idx) => (
                    <div key={idx} className="border border-[#eef0f2] rounded-[9px] p-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input
                        value={k.nombre}
                        onChange={(e) => actualizarKit(idx, { nombre: e.target.value })}
                        placeholder="Nombre (ej. Batería Li-Ion 12V)"
                        className="sm:col-span-2 border border-[#e4e7eb] rounded-[8px] px-2 py-1.5 text-[12px]"
                      />
                      <select
                        value={k.tipoItem}
                        onChange={(e) => actualizarKit(idx, { tipoItem: e.target.value as KitItemForm['tipoItem'] })}
                        className="border border-[#e4e7eb] rounded-[8px] px-2 py-1.5 text-[12px]"
                      >
                        {TIPOS_KIT.map((t) => (
                          <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min={1}
                        value={k.cantidad}
                        onChange={(e) => actualizarKit(idx, { cantidad: Number(e.target.value) || 1 })}
                        className="border border-[#e4e7eb] rounded-[8px] px-2 py-1.5 text-[12px]"
                        placeholder="Cant."
                      />
                      {(k.tipoItem === 'BATERIA' || k.tipoItem === 'COMPONENTE') && (
                        <input
                          type="number"
                          min={1}
                          value={k.mesesVencimiento ?? ''}
                          onChange={(e) => actualizarKit(idx, { mesesVencimiento: Number(e.target.value) || undefined })}
                          placeholder="Meses hasta vencimiento"
                          className="border border-[#e4e7eb] rounded-[8px] px-2 py-1.5 text-[12px]"
                        />
                      )}
                      <label className="flex items-center gap-2 text-[11px]">
                        <input type="checkbox" checked={k.obligatorio} onChange={(e) => actualizarKit(idx, { obligatorio: e.target.checked })} />
                        Obligatorio en el equipo
                      </label>
                      <button
                        type="button"
                        onClick={() => setForm({ ...form, kitItems: form.kitItems.filter((_, i) => i !== idx) })}
                        className="text-[11px] text-red-500 hover:underline sm:col-span-2 text-left"
                      >
                        Quitar del kit
                      </button>
                    </div>
                  ))}
                </div>
              </section>
          )}
        </div>
        <div className="px-5 py-4 border-t border-[#eef0f2] flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={loading}>Cancelar</Button>
          <Button variant="primary" loading={loading} onClick={onSave}>Guardar</Button>
        </div>
      </div>
    </div>
  )
}
