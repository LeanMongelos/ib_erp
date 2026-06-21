'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import {
  GripVertical, Trash2, Eye, EyeOff, Layers, Save, X, Code, RefreshCw, Upload,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PdfPreviewFrame } from '@/components/plantillas/PdfPreviewFrame'
import { mensajeErrorDesconocido, mensajeErrorRespuesta } from '@/lib/errores'
import type { ColumnaItem, LayoutElement, PlantillaConfig } from '@/lib/plantillas/types'
import { ensureLayout } from '@/lib/plantillas/ensure-layout'
import { A4_ANCHO_MM, A4_ALTO_MM } from '@/lib/plantillas/layout-utils'
import { PALETTE_PLANTILLA, CATEGORIA_LABEL, elementoDesdePalette, type PaletteItem } from '@/lib/plantillas/palette'
import { LAYOUT_PRESUPUESTO_IB } from '@/lib/plantillas/layout-default-presupuesto'
import { datosEjemploPlantilla } from '@/lib/plantillas/sample-datos'
import { resolveBinding } from '@/lib/plantillas/binding-resolver'
import { previewUrlImagen, urlPreviewImagen } from '@/lib/plantillas/media-url'

const PX_PER_MM = 2.15
const CANVAS_W = A4_ANCHO_MM * PX_PER_MM
const CANVAS_H = A4_ALTO_MM * PX_PER_MM

const BINDINGS = [
  'documento.fecha', 'documento.numero', 'documento.titulo', 'documento.leyendaNoFiscal', 'documento.marca',
  'emisor.razonSocial', 'emisor.cuit', 'emisor.domicilio', 'emisor.contacto', 'emisor.logo',
  'cliente.nombre', 'cliente.direccion', 'cliente.cuit', 'cliente.condicionPago', 'cliente.vendedor',
  'totales.subtotal', 'totales.total', 'totales.enLetras',
  'observaciones.vigencia', 'observaciones.formaPago', 'observaciones.plazoEntrega', 'observaciones.garantia',
]

interface PlantillaRow {
  id: string
  nombre: string
  tipo: string
  version: number
  config: Record<string, unknown>
}

interface Props {
  plantilla: PlantillaRow
  onClose: () => void
  onSaved: () => void
  onEditHtml?: () => void
}

function mmToPx(mm: number) {
  return mm * PX_PER_MM
}

function pxToMm(px: number) {
  return px / PX_PER_MM
}

function tipoLabel(type: string) {
  const map: Record<string, string> = {
    text: 'Texto', field: 'Campo', image: 'Imagen', line: 'Línea', rect: 'Rect',
    fiscalRow: 'Fila fiscal', clienteBox: 'Cliente', itemsTable: 'Tabla', totalsBox: 'Totales',
    observacionesBlock: 'Observaciones',
  }
  return map[type] ?? type
}

function ImagenUploadPanel({
  plantillaId,
  content,
  onChange,
}: {
  plantillaId: string
  content?: string
  onChange: (content: string) => void
}) {
  const [subiendo, setSubiendo] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const previewSrc = previewUrlImagen(content) ?? (content?.startsWith('/') ? content : null)

  async function subir(file: File) {
    setSubiendo(true)
    try {
      const fd = new FormData()
      fd.append('archivo', file)
      const res = await fetch(`/api/plantillas/${plantillaId}/imagenes`, { method: 'POST', body: fd })
      if (!res.ok) throw new Error(await mensajeErrorRespuesta(res, 'No se pudo subir la imagen'))
      const data = (await res.json()) as { content: string }
      onChange(data.content)
      toast.success('Imagen subida')
    } catch (e) {
      toast.error(mensajeErrorDesconocido(e, 'No se pudo subir la imagen'))
    } finally {
      setSubiendo(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className="space-y-2 border border-[#e4e7eb] rounded-lg p-2 bg-[#fafbfc]">
      <p className="text-[10px] font-semibold text-[#5b626d] uppercase">Imagen / logo</p>
      {previewSrc && (
        <div className="flex justify-center p-2 bg-white border border-[#eef0f2] rounded-md">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={previewSrc} alt="Vista previa" className="max-h-16 max-w-full object-contain" />
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) void subir(f)
        }}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full"
        loading={subiendo}
        onClick={() => inputRef.current?.click()}
      >
        <Upload size={14} /> Subir imagen
      </Button>
      <p className="text-[9px] text-[#9aa1ab]">PNG, JPG, WEBP o GIF · máx. 2 MB</p>
      <Input
        label="O URL / ruta (avanzado)"
        value={content?.startsWith('storage:') ? '' : (content ?? '')}
        placeholder="/logo.png"
        onChange={(e) => onChange(e.target.value || '/logo.png')}
      />
      <Button type="button" variant="secondary" size="sm" className="w-full" onClick={() => onChange('/logo.png')}>
        Usar logo del sistema
      </Button>
    </div>
  )
}

export function PlantillaEditor({ plantilla, onClose, onSaved, onEditHtml }: Props) {
  const [config, setConfig] = useState<PlantillaConfig>(() =>
    ensureLayout(plantilla.config as unknown as PlantillaConfig),
  )
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [previewKey, setPreviewKey] = useState(0)
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null)
  const [dragging, setDragging] = useState<{ id: string; offsetX: number; offsetY: number } | null>(null)
  const canvasRef = useRef<HTMLDivElement>(null)

  const elementos = config.layout?.elementos ?? []
  const selected = elementos.find((e) => e.id === selectedId) ?? null

  const datosEjemplo = useMemo(() => {
    const t = config.tipo
    if (t === 'FACTURA' || t === 'PRESUPUESTO' || t === 'REMITO') return datosEjemploPlantilla(t)
    return datosEjemploPlantilla('PRESUPUESTO')
  }, [config.tipo])

  const refreshPreview = useCallback(async () => {
    try {
      const res = await fetch('/api/plantillas/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ config }),
      })
      if (!res.ok) throw new Error(await mensajeErrorRespuesta(res, 'Error en vista previa'))
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      setPreviewBlobUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev)
        return url
      })
      setPreviewKey((k) => k + 1)
    } catch (e) {
      toast.error(mensajeErrorDesconocido(e, 'No se pudo generar la vista previa'))
    }
  }, [config])

  useEffect(() => {
    const t = setTimeout(refreshPreview, 600)
    return () => clearTimeout(t)
  }, [refreshPreview])

  useEffect(() => {
    return () => {
      if (previewBlobUrl) URL.revokeObjectURL(previewBlobUrl)
    }
  }, [previewBlobUrl])

  function updateColumnas(columnas: ColumnaItem[]) {
    setConfig((prev) => ({
      ...prev,
      items: { ...prev.items, columnas },
      layout: {
        ...prev.layout!,
        elementos: prev.layout!.elementos.map((e) =>
          e.type === 'itemsTable' ? { ...e, columns: columnas } : e,
        ),
      },
    }))
  }

  const columnasItems = useMemo(() => {
    if (selected?.type === 'itemsTable' && selected.columns?.length) return selected.columns
    return config.items.columnas
  }, [selected, config.items.columnas])

  function updateElement(id: string, patch: Partial<LayoutElement>) {
    setConfig((prev) => ({
      ...prev,
      layout: {
        ...prev.layout!,
        elementos: prev.layout!.elementos.map((e) => (e.id === id ? { ...e, ...patch } : e)),
      },
    }))
  }

  function deleteElement(id: string) {
    setConfig((prev) => ({
      ...prev,
      layout: {
        ...prev.layout!,
        elementos: prev.layout!.elementos.filter((e) => e.id !== id),
      },
    }))
    if (selectedId === id) setSelectedId(null)
  }

  function addFromPalette(item: PaletteItem, xMm = 14, yMm = 20) {
    const el = elementoDesdePalette(item, xMm, yMm)
    setConfig((prev) => ({
      ...prev,
      layout: {
        unidad: 'mm',
        anchoPagina: A4_ANCHO_MM,
        altoPagina: A4_ALTO_MM,
        elementos: [...(prev.layout?.elementos ?? []), el],
      },
    }))
    setSelectedId(el.id)
  }

  function restaurarLayoutIb() {
    setConfig((prev) => ({ ...prev, layout: structuredClone(LAYOUT_PRESUPUESTO_IB) }))
    toast.success('Layout IB restaurado')
  }

  function handleCanvasDrop(e: React.DragEvent) {
    e.preventDefault()
    const raw = e.dataTransfer.getData('application/plantilla-palette')
    if (!raw) return
    const item = JSON.parse(raw) as PaletteItem
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    const xMm = pxToMm(e.clientX - rect.left)
    const yMm = pxToMm(e.clientY - rect.top)
    addFromPalette(item, Math.max(0, xMm - (item.defaults.width ?? 60) / 2), Math.max(0, yMm - 2))
  }

  function onCanvasMouseMove(e: React.MouseEvent) {
    if (!dragging || !canvasRef.current) return
    const rect = canvasRef.current.getBoundingClientRect()
    const xMm = pxToMm(e.clientX - rect.left - dragging.offsetX)
    const yMm = pxToMm(e.clientY - rect.top - dragging.offsetY)
    updateElement(dragging.id, {
      x: Math.max(0, Math.min(A4_ANCHO_MM - 5, xMm)),
      y: Math.max(0, Math.min(A4_ALTO_MM - 5, yMm)),
    })
  }

  function endDrag() {
    setDragging(null)
  }

  async function guardar() {
    setLoading(true)
    try {
      const res = await fetch(`/api/plantillas/${plantilla.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config }),
      })
      if (!res.ok) throw new Error(await mensajeErrorRespuesta(res, 'No se pudo guardar'))
      toast.success('Plantilla guardada')
      onSaved()
    } catch (e) {
      toast.error(mensajeErrorDesconocido(e, 'No se pudo guardar'))
    } finally {
      setLoading(false)
    }
  }

  const palettePorCategoria = useMemo(() => {
    const map = new Map<string, PaletteItem[]>()
    for (const item of PALETTE_PLANTILLA) {
      const list = map.get(item.categoria) ?? []
      list.push(item)
      map.set(item.categoria, list)
    }
    return map
  }, [])

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-[#f4f5f7]">
      <header className="shrink-0 bg-white border-b border-[#e4e7eb] px-4 py-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-bold text-[#1f242c]">Editor visual — {plantilla.nombre}</h2>
          <p className="text-[11.5px] text-[#6b7280]">Arrastrá bloques al lienzo A4 · Seleccioná para mover y editar propiedades</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={restaurarLayoutIb}>
            <RefreshCw size={14} /> Layout IB
          </Button>
          {onEditHtml && (
            <Button variant="outline" size="sm" onClick={onEditHtml}>
              <Code size={14} /> HTML
            </Button>
          )}
          <Button variant="secondary" size="sm" onClick={onClose} disabled={loading}>
            <X size={14} /> Cancelar
          </Button>
          <Button variant="primary" size="sm" onClick={guardar} loading={loading}>
            <Save size={14} /> Guardar
          </Button>
        </div>
      </header>

      <div className="flex-1 min-h-0 flex overflow-hidden">
        {/* Paleta */}
        <aside className="w-[220px] shrink-0 bg-white border-r border-[#e4e7eb] overflow-y-auto p-3">
          <p className="text-[11px] font-bold text-[#92400E] uppercase mb-2 flex items-center gap-1">
            <Layers size={12} /> Elementos
          </p>
          {[...palettePorCategoria.entries()].map(([cat, items]) => (
            <div key={cat} className="mb-3">
              <p className="text-[10px] font-semibold text-[#9aa1ab] uppercase mb-1">{CATEGORIA_LABEL[cat as keyof typeof CATEGORIA_LABEL]}</p>
              <div className="flex flex-col gap-1">
                {items.map((item) => (
                  <button
                    key={item.titulo}
                    type="button"
                    draggable
                    onDragStart={(ev) => ev.dataTransfer.setData('application/plantilla-palette', JSON.stringify(item))}
                    onClick={() => addFromPalette(item)}
                    className="text-left px-2 py-1.5 rounded-lg border border-[#eef0f2] hover:border-[#E8650A]/50 hover:bg-[#FFF8F3] transition-colors"
                  >
                    <p className="text-[11.5px] font-semibold text-[#1f242c]">{item.titulo}</p>
                    <p className="text-[10px] text-[#9aa1ab]">{item.descripcion}</p>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </aside>

        {/* Lienzo */}
        <main className="flex-1 min-w-0 overflow-auto p-6 flex justify-center items-start">
          <div
            ref={canvasRef}
            className="relative bg-white shadow-lg border border-[#d1d5db]"
            style={{ width: CANVAS_W, height: CANVAS_H }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleCanvasDrop}
            onMouseMove={onCanvasMouseMove}
            onMouseUp={endDrag}
            onMouseLeave={endDrag}
            onClick={() => setSelectedId(null)}
          >
            <div className="absolute inset-0 pointer-events-none opacity-30"
              style={{
                backgroundImage: 'linear-gradient(#e5e7eb 1px, transparent 1px), linear-gradient(90deg, #e5e7eb 1px, transparent 1px)',
                backgroundSize: `${mmToPx(10)}px ${mmToPx(10)}px`,
              }}
            />
            {[...elementos]
              .sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0))
              .map((el) => {
                const isSelected = el.id === selectedId
                const previewText =
                  el.type === 'text'
                    ? el.content
                    : el.type === 'image'
                      ? (previewUrlImagen(el.content) ? 'Logo subido' : el.content ?? 'Imagen')
                    : el.type === 'field'
                      ? resolveBinding(el.binding, datosEjemplo, config) || el.binding
                      : tipoLabel(el.type)
                return (
                  <div
                    key={el.id}
                    role="button"
                    tabIndex={0}
                    onClick={(ev) => { ev.stopPropagation(); setSelectedId(el.id) }}
                    onMouseDown={(ev) => {
                      ev.stopPropagation()
                      setSelectedId(el.id)
                      const rect = (ev.currentTarget as HTMLElement).getBoundingClientRect()
                      setDragging({
                        id: el.id,
                        offsetX: ev.clientX - rect.left,
                        offsetY: ev.clientY - rect.top,
                      })
                    }}
                    className={`absolute cursor-move overflow-hidden text-[9px] leading-tight ${
                      el.visible === false ? 'opacity-30' : ''
                    } ${isSelected ? 'ring-2 ring-[#E8650A] ring-offset-1 z-20' : 'z-10 hover:ring-1 hover:ring-[#E8650A]/40'}`}
                    style={{
                      left: mmToPx(el.x),
                      top: mmToPx(el.y),
                      width: mmToPx(el.width),
                      height: mmToPx(el.height),
                      fontSize: el.style?.fontSize ? el.style.fontSize * 1.1 : 9,
                      fontWeight: el.style?.fontWeight === 'bold' ? 700 : 400,
                      color: el.style?.color ?? '#111',
                      backgroundColor: el.style?.backgroundColor ?? (el.type === 'rect' ? '#fff' : 'rgba(255,241,226,0.35)'),
                      textAlign: el.style?.textAlign ?? 'left',
                      border: el.type === 'line'
                        ? 'none'
                        : `${el.style?.borderWidth ?? 1}px solid ${el.style?.borderColor ?? (isSelected ? '#E8650A' : '#cbd5e1')}`,
                      borderBottom: el.type === 'line' ? `2px solid ${el.style?.borderColor ?? '#000'}` : undefined,
                    }}
                  >
                    <span className="absolute top-0 left-0 bg-[#E8650A] text-white text-[7px] px-1 rounded-br opacity-80">
                      {tipoLabel(el.type)}
                    </span>
                    {el.type === 'image' ? (
                      <div className="p-1 pt-3 flex items-center justify-center h-[calc(100%-12px)]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={urlPreviewImagen(el.content)}
                          alt=""
                          className="max-w-full max-h-full object-contain"
                        />
                      </div>
                    ) : (
                      <div className="p-1 pt-3 truncate">{previewText}</div>
                    )}
                    {isSelected && (
                      <GripVertical size={10} className="absolute bottom-0.5 right-0.5 text-[#E8650A]" />
                    )}
                  </div>
                )
              })}
          </div>
        </main>

        {/* Panel derecho */}
        <aside className="w-[300px] shrink-0 bg-white border-l border-[#e4e7eb] flex flex-col min-h-0">
          <div className="p-3 border-b border-[#eef0f2] overflow-y-auto max-h-[45%]">
            <p className="text-[11px] font-bold text-[#92400E] uppercase mb-2">Propiedades</p>
            {!selected ? (
              <p className="text-[11.5px] text-[#9aa1ab]">Seleccioná un elemento del lienzo</p>
            ) : (
              <div className="flex flex-col gap-2">
                <p className="text-[12px] font-semibold">{tipoLabel(selected.type)}</p>
                <div className="grid grid-cols-2 gap-2">
                  <Input label="X (mm)" type="number" value={Math.round(selected.x * 10) / 10}
                    onChange={(e) => updateElement(selected.id, { x: Number(e.target.value) })} />
                  <Input label="Y (mm)" type="number" value={Math.round(selected.y * 10) / 10}
                    onChange={(e) => updateElement(selected.id, { y: Number(e.target.value) })} />
                  <Input label="Ancho" type="number" value={Math.round(selected.width * 10) / 10}
                    onChange={(e) => updateElement(selected.id, { width: Number(e.target.value) })} />
                  <Input label="Alto" type="number" value={Math.round(selected.height * 10) / 10}
                    onChange={(e) => updateElement(selected.id, { height: Number(e.target.value) })} />
                </div>
                {(selected.type === 'field' || selected.type === 'text' || selected.type === 'image') && (
                  <>
                    {selected.type === 'field' && (
                      <>
                        <label className="text-[10px] font-semibold text-[#5b626d] uppercase">Binding</label>
                        <select
                          value={selected.binding ?? ''}
                          onChange={(e) => updateElement(selected.id, { binding: e.target.value })}
                          className="w-full border border-[#e4e7eb] rounded-[9px] px-2 py-2 text-[12px]"
                        >
                          <option value="">—</option>
                          {BINDINGS.map((b) => (
                            <option key={b} value={b}>{b}</option>
                          ))}
                        </select>
                        <Input label="Etiqueta" value={selected.label ?? ''}
                          onChange={(e) => updateElement(selected.id, { label: e.target.value })} />
                      </>
                    )}
                    {(selected.type === 'text') && (
                      <Input label="Texto"
                        value={selected.content ?? ''}
                        onChange={(e) => updateElement(selected.id, { content: e.target.value })} />
                    )}
                    {selected.type === 'image' && (
                      <ImagenUploadPanel
                        plantillaId={plantilla.id}
                        content={selected.content}
                        onChange={(content) => updateElement(selected.id, { content })}
                      />
                    )}
                    {(selected.type === 'field' || selected.type === 'text') && (
                      <>
                        <Input
                          label="Máx. caracteres (0 = sin límite)"
                          type="number"
                          value={selected.style?.maxChars ?? 0}
                          onChange={(e) =>
                            updateElement(selected.id, {
                              style: {
                                ...selected.style,
                                maxChars: Number(e.target.value) || undefined,
                              },
                            })
                          }
                        />
                        <div>
                          <label className="text-[10px] font-semibold text-[#5b626d] uppercase">Desbordamiento</label>
                          <select
                            value={selected.style?.overflow ?? 'wrap'}
                            onChange={(e) =>
                              updateElement(selected.id, {
                                style: {
                                  ...selected.style,
                                  overflow: e.target.value as ColumnaItem['overflow'],
                                },
                              })
                            }
                            className="w-full border border-[#e4e7eb] rounded-[9px] px-2 py-2 text-[12px]"
                          >
                            <option value="wrap">Multilínea (textos largos)</option>
                            <option value="ellipsis">Recortar con …</option>
                            <option value="truncate">Cortar seco</option>
                          </select>
                        </div>
                      </>
                    )}
                  </>
                )}
                {selected.type === 'itemsTable' && (
                  <div className="border-t border-[#eef0f2] pt-2 mt-1 space-y-2">
                    <p className="text-[10px] font-bold text-[#92400E] uppercase">Columnas · límites de texto</p>
                    <p className="text-[10px] text-[#6b7280]">
                      Usá <strong>Multilínea</strong> en Descripción para equipos con textos largos; en Código/Precio conviene recortar.
                    </p>
                    {columnasItems.map((col, idx) => (
                      <div key={col.key} className="p-2 rounded-lg bg-[#f8f9fb] border border-[#e4e7eb] space-y-1.5">
                        <p className="text-[10px] font-bold text-[#1f242c]">{col.label || col.key}</p>
                        <Input
                          label="Ancho %"
                          type="number"
                          value={col.anchoPct}
                          onChange={(e) => {
                            const next = columnasItems.map((c, i) =>
                              i === idx ? { ...c, anchoPct: Number(e.target.value) } : c,
                            )
                            updateColumnas(next)
                          }}
                        />
                        <Input
                          label="Máx. caracteres"
                          type="number"
                          value={col.maxChars ?? 0}
                          onChange={(e) => {
                            const v = Number(e.target.value)
                            const next = columnasItems.map((c, i) =>
                              i === idx ? { ...c, maxChars: v || undefined } : c,
                            )
                            updateColumnas(next)
                          }}
                        />
                        <div>
                          <label className="text-[10px] font-semibold text-[#5b626d] uppercase">Desbordamiento</label>
                          <select
                            value={col.overflow ?? (col.key === 'descripcion' ? 'wrap' : 'truncate')}
                            onChange={(e) => {
                              const next = columnasItems.map((c, i) =>
                                i === idx ? { ...c, overflow: e.target.value as ColumnaItem['overflow'] } : c,
                              )
                              updateColumnas(next)
                            }}
                            className="w-full border border-[#e4e7eb] rounded-[9px] px-2 py-2 text-[11px]"
                          >
                            <option value="wrap">Multilínea</option>
                            <option value="ellipsis">Recortar con …</option>
                            <option value="truncate">Cortar seco</option>
                          </select>
                        </div>
                        <label className="flex items-center gap-2 text-[10px]">
                          <input
                            type="checkbox"
                            checked={col.visible}
                            onChange={(e) => {
                              const next = columnasItems.map((c, i) =>
                                i === idx ? { ...c, visible: e.target.checked } : c,
                              )
                              updateColumnas(next)
                            }}
                          />
                          Visible en PDF
                        </label>
                      </div>
                    ))}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <Input label="Tamaño" type="number"
                    value={selected.style?.fontSize ?? 8}
                    onChange={(e) => updateElement(selected.id, {
                      style: { ...selected.style, fontSize: Number(e.target.value) },
                    })} />
                  <div>
                    <label className="text-[10px] font-semibold text-[#5b626d] uppercase">Color</label>
                    <input type="color" value={selected.style?.color ?? '#000000'}
                      onChange={(e) => updateElement(selected.id, {
                        style: { ...selected.style, color: e.target.value },
                      })}
                      className="w-full h-9 border border-[#e4e7eb] rounded-[9px] cursor-pointer" />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-[#5b626d] uppercase">Alineación</label>
                  <select
                    value={selected.style?.textAlign ?? 'left'}
                    onChange={(e) => updateElement(selected.id, {
                      style: { ...selected.style, textAlign: e.target.value as 'left' | 'center' | 'right' },
                    })}
                    className="w-full border border-[#e4e7eb] rounded-[9px] px-2 py-2 text-[12px]"
                  >
                    <option value="left">Izquierda</option>
                    <option value="center">Centro</option>
                    <option value="right">Derecha</option>
                  </select>
                </div>
                {(selected.type === 'itemsTable' || selected.type === 'rect' || selected.type === 'fiscalRow') && (
                  <div>
                    <label className="text-[10px] font-semibold text-[#5b626d] uppercase">Color fondo / acento</label>
                    <input type="color" value={selected.style?.backgroundColor ?? '#E8650A'}
                      onChange={(e) => updateElement(selected.id, {
                        style: { ...selected.style, backgroundColor: e.target.value },
                      })}
                      className="w-full h-9 border border-[#e4e7eb] rounded-[9px] cursor-pointer" />
                  </div>
                )}
                <div className="flex gap-2 pt-1">
                  <Button variant="outline" size="sm" className="flex-1"
                    onClick={() => updateElement(selected.id, { visible: selected.visible === false })}>
                    {selected.visible === false ? <Eye size={14} /> : <EyeOff size={14} />}
                    {selected.visible === false ? 'Mostrar' : 'Ocultar'}
                  </Button>
                  <Button variant="outline" size="sm" className="text-red-600 flex-1"
                    onClick={() => deleteElement(selected.id)}>
                    <Trash2 size={14} /> Eliminar
                  </Button>
                </div>
              </div>
            )}
          </div>

          <div className="flex-1 min-h-0 flex flex-col p-3">
            <p className="text-[11px] font-bold text-[#92400E] uppercase mb-2">Vista previa PDF</p>
            <div className="flex-1 min-h-0 bg-[#525659] rounded-lg overflow-hidden">
              {previewBlobUrl ? (
                <iframe
                  key={previewKey}
                  src={previewBlobUrl}
                  title="Vista previa plantilla"
                  className="w-full h-full border-0 bg-white"
                />
              ) : (
                <PdfPreviewFrame
                  src={`/api/plantillas/${plantilla.id}/preview?v=${plantilla.version}`}
                  titulo="Vista previa"
                  className="w-full h-full"
                />
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
