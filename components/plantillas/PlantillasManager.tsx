'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { FileText, Star, Maximize2, X, Copy } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useCan } from '@/components/auth/useCan'
import { PdfPreviewFrame } from '@/components/plantillas/PdfPreviewFrame'
import { PlantillaEditor } from '@/components/plantillas/PlantillaEditor'
import { NumeracionComprobantes } from '@/components/plantillas/NumeracionComprobantes'
import { mensajeErrorDesconocido, mensajeErrorRespuesta } from '@/lib/errores'

interface Plantilla {
  id: string
  nombre: string
  tipo: string
  predeterminado: boolean
  version: number
  config: Record<string, unknown>
}

const TIPOS = ['FACTURA', 'PRESUPUESTO', 'REMITO'] as const
type TipoPlantilla = (typeof TIPOS)[number]

const TIPO_LABEL: Record<TipoPlantilla, string> = {
  FACTURA: 'Factura',
  PRESUPUESTO: 'Presupuesto',
  REMITO: 'Remito',
}

function urlPreview(tipo: TipoPlantilla, plantilla?: Plantilla) {
  if (plantilla) return `/api/plantillas/${plantilla.id}/preview?v=${plantilla.version}`
  return `/api/plantillas/preview?tipo=${tipo}`
}

function MiniaturaPDF({
  src,
  titulo,
  onClick,
  enabled,
  delayMs,
}: {
  src: string
  titulo: string
  onClick: () => void
  enabled: boolean
  delayMs: number
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative w-full h-[220px] rounded-[10px] border border-[#e4e7eb] bg-[#f8f9fb] overflow-hidden cursor-pointer group block text-left"
    >
      <PdfPreviewFrame
        src={src}
        titulo={titulo}
        scale={0.26}
        className="w-full h-full"
        enabled={enabled}
        delayMs={delayMs}
      />
      <div className="absolute inset-0 pointer-events-none group-hover:bg-black/5 transition-colors flex items-end justify-center pb-2 opacity-0 group-hover:opacity-100">
        <span className="text-[10px] font-bold text-white bg-black/50 px-2 py-1 rounded-full flex items-center gap-1">
          <Maximize2 size={10} /> Ampliar
        </span>
      </div>
    </button>
  )
}

function ModalVistaPrevia({
  titulo,
  src,
  onClose,
}: {
  titulo: string
  src: string
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" data-modal-overlay>
      <div
        className="bg-white rounded-[14px] w-full max-w-4xl shadow-2xl flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-3 border-b border-[#eef0f2] flex items-center justify-between">
          <h3 className="text-[14px] font-bold text-[#1f242c]">Vista previa — {titulo}</h3>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-[#6b7280]">
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 min-h-0 bg-[#525659] p-3">
          <PdfPreviewFrame src={src} titulo={titulo} className="w-full h-[78vh] rounded-[6px]" />
        </div>
      </div>
    </div>
  )
}

export function PlantillasManager({ puedeEditar: puedeEditarProp }: { puedeEditar?: boolean } = {}) {
  const router = useRouter()
  const puedeEditarHook = useCan('config.manage_billing_templates')
  const puedeEditar = puedeEditarProp ?? puedeEditarHook
  const [plantillas, setPlantillas] = useState<Plantilla[]>([])
  const [loading, setLoading] = useState(true)
  const [editandoHtml, setEditandoHtml] = useState<Plantilla | null>(null)
  const [editorVisual, setEditorVisual] = useState<Plantilla | null>(null)
  const [ampliando, setAmpliando] = useState<{ titulo: string; src: string } | null>(null)
  const [previewKey, setPreviewKey] = useState(0)
  const [accionId, setAccionId] = useState<string | null>(null)
  const listRequestId = useRef(0)

  useEffect(() => {
    const id = ++listRequestId.current
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 20_000)

    fetch('/api/plantillas', { credentials: 'include', signal: controller.signal })
      .then(async (r) => {
        if (!r.ok) throw new Error(await mensajeErrorRespuesta(r, 'Error al cargar plantillas'))
        const data = await r.json()
        if (!Array.isArray(data)) throw new Error('Respuesta inválida del servidor')
        return data as Plantilla[]
      })
      .then((data) => {
        if (listRequestId.current !== id) return
        setPlantillas(data)
      })
      .catch((e) => {
        if (listRequestId.current !== id) return
        if (e instanceof DOMException && e.name === 'AbortError') {
          toast.error('Tiempo agotado al cargar plantillas. Reintentá en unos segundos.')
        } else {
          toast.error(mensajeErrorDesconocido(e, 'Error al cargar plantillas'))
        }
        setPlantillas([])
      })
      .finally(() => {
        if (listRequestId.current !== id) return
        window.clearTimeout(timeout)
        setLoading(false)
      })

    return () => {
      controller.abort()
      window.clearTimeout(timeout)
    }
  }, [])

  async function recargarPlantillas() {
    try {
      const r = await fetch('/api/plantillas')
      if (!r.ok) throw new Error(await mensajeErrorRespuesta(r, 'Error al cargar plantillas'))
      const data = await r.json()
      if (Array.isArray(data)) setPlantillas(data)
    } catch {
      /* mantener lista actual */
    }
    setPreviewKey((k) => k + 1)
    router.refresh()
  }

  async function marcarPredeterminada(p: Plantilla) {
    if (p.predeterminado) return
    setAccionId(p.id)
    try {
      const res = await fetch(`/api/plantillas/${p.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ predeterminado: true }),
      })
      if (!res.ok) throw new Error(await mensajeErrorRespuesta(res, 'No se pudo actualizar'))
      toast.success(`«${p.nombre}» es ahora la plantilla predeterminada para ${p.tipo}`)
      await recargarPlantillas()
    } catch (e) {
      toast.error(mensajeErrorDesconocido(e, 'No se pudo marcar como predeterminada'))
    } finally {
      setAccionId(null)
    }
  }

  async function duplicarRespaldo(p: Plantilla) {
    setAccionId(p.id)
    try {
      const res = await fetch('/api/plantillas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: `${p.nombre} (respaldo)`,
          tipo: p.tipo,
          config: p.config,
          predeterminado: false,
        }),
      })
      if (!res.ok) throw new Error(await mensajeErrorRespuesta(res, 'No se pudo duplicar'))
      toast.success('Copia de respaldo creada. Podés editarla sin afectar la predeterminada.')
      await recargarPlantillas()
    } catch (e) {
      toast.error(mensajeErrorDesconocido(e, 'No se pudo duplicar la plantilla'))
    } finally {
      setAccionId(null)
    }
  }

  const porTipo = useMemo(() => {
    const map: Partial<Record<TipoPlantilla, Plantilla>> = {}
    for (const p of plantillas) {
      const t = p.tipo as TipoPlantilla
      if (TIPOS.includes(t) && (!map[t] || p.predeterminado)) map[t] = p
    }
    return map
  }, [plantillas])

  async function inicializarPlantilla(tipo: TipoPlantilla): Promise<Plantilla | null> {
    setAccionId(`init-${tipo}`)
    try {
      const res = await fetch('/api/plantillas/restaurar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo }),
      })
      if (!res.ok) throw new Error(await mensajeErrorRespuesta(res, 'No se pudo inicializar la plantilla'))
      const creada = (await res.json()) as Plantilla
      await recargarPlantillas()
      return creada
    } catch (e) {
      toast.error(mensajeErrorDesconocido(e, 'No se pudo inicializar la plantilla'))
      return null
    } finally {
      setAccionId(null)
    }
  }

  async function abrirEditor(tipo: TipoPlantilla, existente?: Plantilla) {
    let p = existente ?? porTipo[tipo]
    if (!p) {
      p = (await inicializarPlantilla(tipo)) ?? undefined
    }
    if (p) setEditorVisual(p)
  }

  async function restaurarDefault(tipo: string) {
    const res = await fetch('/api/plantillas/restaurar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo }),
    })
    if (res.ok) {
      toast.success('Plantilla restaurada')
      await recargarPlantillas()
    } else toast.error('No se pudo restaurar')
  }

  function abrirAmpliado(tipo: TipoPlantilla) {
    const p = porTipo[tipo]
    const src = `${urlPreview(tipo, p)}&k=${previewKey}`
    setAmpliando({ titulo: p?.nombre ?? TIPO_LABEL[tipo], src })
  }

  return (
    <div className="flex flex-col gap-5 max-w-5xl">
      <Card className="bg-[#FFFBF5] border-[#FFE4CC]">
        <p className="text-[12.5px] text-[#7c4a1a] leading-relaxed">
          <strong>Predeterminada:</strong> la que se usa al emitir facturas, presupuestos y remitos (badge «Default»).
          {' '}<strong>Respaldo:</strong> queda guardada para probar cambios o volver atrás; no se usa hasta que la marques como predeterminada.
          Duplicá una plantilla para tener una copia de respaldo antes de editar la principal.
        </p>
      </Card>

      <NumeracionComprobantes puedeEditar={puedeEditar} />

      <p className="text-[12.5px] text-[#7c828c]">
        Vista previa en vivo con datos de ejemplo (incluye ítems con descripción corta y larga). Editá el diseño con el editor visual: posición, columnas y máximo de caracteres por campo.
      </p>

      <div>
        <h3 className="text-[13px] font-bold text-[#1f242c] mb-3">Vista previa de documentos</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {TIPOS.map((tipo, idx) => {
            const p = porTipo[tipo]
            const src = `${urlPreview(tipo, p)}&k=${previewKey}`
            return (
              <Card key={tipo} padding={false} className="overflow-hidden">
                <div className="px-4 pt-4 pb-2 flex items-center justify-between gap-2">
                  <div>
                    <p className="text-[12px] font-bold text-[#92400E] uppercase tracking-wide">{TIPO_LABEL[tipo]}</p>
                    <p className="text-[11.5px] text-[#6b7280] truncate">{p?.nombre ?? 'Plantilla de fábrica'}</p>
                  </div>
                  {p?.predeterminado && (
                    <Badge className="bg-[#FFF1E2] text-[#C4540A] shrink-0"><Star size={10} /> Predeterminada</Badge>
                  )}
                </div>
                <div className="px-4 pb-2">
                  <MiniaturaPDF
                    src={src}
                    titulo={TIPO_LABEL[tipo]}
                    onClick={() => abrirAmpliado(tipo)}
                    enabled
                    delayMs={idx * 800}
                  />
                </div>
                <div className="px-4 pb-4 flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => abrirAmpliado(tipo)}>
                    <Maximize2 size={14} /> Ver más grande
                  </Button>
                  {puedeEditar && (
                    <>
                      <Button
                        variant="primary"
                        size="sm"
                        loading={accionId === `init-${tipo}`}
                        onClick={() => abrirEditor(tipo, p)}
                      >
                        Editor visual
                      </Button>
                      {p && (tipo === 'FACTURA' || tipo === 'PRESUPUESTO') ? (
                        <button
                          type="button"
                          onClick={() => setEditandoHtml(p)}
                          className="text-[11.5px] font-semibold text-[#6b7280] px-2 py-1.5 hover:underline"
                        >
                          Editor HTML
                        </button>
                      ) : p ? (
                        <button
                          type="button"
                          onClick={() => setEditandoHtml(p)}
                          className="text-[11.5px] font-semibold text-[#6b7280] px-2 py-1.5 hover:underline"
                        >
                          JSON avanzado
                        </button>
                      ) : (
                        <span className="text-[10.5px] text-[#9aa1ab] self-center">
                          Se creará al abrir el editor
                        </span>
                      )}
                    </>
                  )}
                </div>
              </Card>
            )
          })}
        </div>
      </div>

      {loading ? (
        <p className="text-[12.5px] text-[#9aa1ab]">Cargando plantillas guardadas…</p>
      ) : plantillas.length === 0 ? (
        <Card>
          <h3 className="text-[13px] font-bold text-[#1f242c] mb-2">Sin plantillas guardadas</h3>
          <p className="text-[12px] text-[#6b7280] mb-3">
            Todavía no hay plantillas en la base. Usá «Editor visual» en una tarjeta de arriba o restaurá las de fábrica.
          </p>
          {puedeEditar && (
            <div className="flex flex-wrap gap-2">
              {TIPOS.map((t) => (
                <Button key={t} variant="outline" size="sm" loading={accionId === `init-${t}`} onClick={() => inicializarPlantilla(t)}>
                  Inicializar {TIPO_LABEL[t]}
                </Button>
              ))}
            </div>
          )}
        </Card>
      ) : (
        <Card>
          <h3 className="text-[13px] font-bold text-[#1f242c] mb-1">Plantillas guardadas</h3>
          <p className="text-[11.5px] text-[#6b7280] mb-3">
            Por cada tipo (Factura, Presupuesto, Remito) solo una puede ser predeterminada.
          </p>
          <div className="flex flex-col gap-2">
            {plantillas.map((p) => (
              <div key={p.id} className="flex flex-wrap items-center gap-3 py-2 border-b border-[#f0f1f4] last:border-0">
                <FileText size={16} className="text-[#E8650A] shrink-0" />
                <div className="flex-1 min-w-[140px]">
                  <p className="text-[13px] font-semibold text-[#16181d] truncate">{p.nombre}</p>
                  <p className="text-[11.5px] text-[#6b7280]">{p.tipo} · v{p.version}</p>
                </div>
                {p.predeterminado ? (
                  <Badge className="bg-[#FFF1E2] text-[#C4540A] shrink-0">
                    <Star size={10} /> Predeterminada
                  </Badge>
                ) : (
                  <Badge className="bg-[#f3f4f6] text-[#6b7280] shrink-0">Respaldo</Badge>
                )}
                {puedeEditar && (
                  <div className="flex flex-wrap gap-1.5 ml-auto">
                    {!p.predeterminado && (
                      <Button
                        variant="outline"
                        size="sm"
                        loading={accionId === p.id}
                        onClick={() => marcarPredeterminada(p)}
                      >
                        <Star size={12} /> Usar como predeterminada
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={accionId === p.id}
                      onClick={() => duplicarRespaldo(p)}
                    >
                      <Copy size={12} /> Duplicar respaldo
                    </Button>
                    <Button variant="primary" size="sm" onClick={() => setEditorVisual(p)}>
                      Editor
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {puedeEditar && (
        <Card>
          <h3 className="text-[13px] font-bold text-[#1f242c] mb-3">Restaurar plantillas de fábrica</h3>
          <div className="flex flex-wrap gap-2">
            {TIPOS.map((t) => (
              <Button key={t} variant="outline" size="sm" onClick={() => restaurarDefault(t)}>
                Restaurar {t}
              </Button>
            ))}
          </div>
        </Card>
      )}

      {editorVisual && (
        <PlantillaEditor
          plantilla={editorVisual}
          onClose={() => setEditorVisual(null)}
          onSaved={async () => {
            setEditorVisual(null)
            await recargarPlantillas()
          }}
          onEditHtml={
            editorVisual.tipo === 'FACTURA' || editorVisual.tipo === 'PRESUPUESTO'
              ? () => {
                  setEditandoHtml(editorVisual)
                  setEditorVisual(null)
                }
              : undefined
          }
        />
      )}

      {editandoHtml && (
        <HtmlEditorModal
          plantilla={editandoHtml}
          onClose={() => setEditandoHtml(null)}
          onSaved={async () => {
            setEditandoHtml(null)
            await recargarPlantillas()
          }}
        />
      )}

      {ampliando && (
        <ModalVistaPrevia titulo={ampliando.titulo} src={ampliando.src} onClose={() => setAmpliando(null)} />
      )}
    </div>
  )
}

function HtmlEditorModal({ plantilla, onClose, onSaved }: { plantilla: Plantilla; onClose: () => void; onSaved: () => void }) {
  const esHtml = plantilla.tipo === 'FACTURA' || plantilla.tipo === 'PRESUPUESTO'
  const [html, setHtml] = useState('')
  const [loading, setLoading] = useState(false)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    let cancel = false
    async function cargar() {
      setCargando(true)
      try {
        const cfg = plantilla.config as { html?: string }
        if (cfg.html?.trim()) {
          if (!cancel) setHtml(cfg.html)
          return
        }
        if (esHtml) {
          const r = await fetch(`/api/plantillas/default-html?tipo=${plantilla.tipo}`)
          if (!r.ok) throw new Error('No se pudo cargar la plantilla HTML de fábrica')
          const data = (await r.json()) as { html?: string }
          if (!cancel) setHtml(data.html ?? '')
        } else {
          if (!cancel) setHtml(JSON.stringify(plantilla.config, null, 2))
        }
      } catch (e) {
        toast.error(mensajeErrorDesconocido(e, 'No se pudo cargar la plantilla'))
      } finally {
        if (!cancel) setCargando(false)
      }
    }
    cargar()
    return () => { cancel = true }
  }, [plantilla, esHtml])

  async function guardar() {
    if (!html.trim()) {
      toast.error(esHtml ? 'El HTML no puede estar vacío' : 'El contenido no puede estar vacío')
      return
    }
    setLoading(true)
    try {
      const config = esHtml
        ? { ...plantilla.config, html }
        : JSON.parse(html) as object
      const res = await fetch(`/api/plantillas/${plantilla.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config }),
      })
      if (!res.ok) throw new Error(await mensajeErrorRespuesta(res, 'No se pudo guardar la plantilla'))
      toast.success('Plantilla actualizada')
      onSaved()
    } catch (e) {
      if (e instanceof SyntaxError) {
        toast.error('JSON inválido')
      } else {
        toast.error(mensajeErrorDesconocido(e, 'No se pudo guardar la plantilla'))
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" data-modal-overlay>
      <div className="bg-white rounded-[14px] w-full max-w-4xl shadow-xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-[#eef0f2]">
          <h3 className="text-[14px] font-bold">{plantilla.nombre}</h3>
          <p className="text-[11.5px] text-[#6b7280] mt-1">
            {esHtml
              ? 'Editá el HTML de la plantilla. Usá placeholders como {{cliente_nombre}}, {{item1_codigo}}, {{total_final}}, etc.'
              : 'Edición avanzada en JSON (solo remitos y otros tipos).'}
          </p>
        </div>
        {cargando ? (
          <p className="p-8 text-[12.5px] text-[#9aa1ab]">Cargando plantilla…</p>
        ) : (
          <textarea
            value={html}
            onChange={(e) => setHtml(e.target.value)}
            className="flex-1 m-4 font-mono text-[11px] border border-[#e4e7eb] rounded-[9px] p-3 min-h-[420px] resize-none focus:outline-none focus:ring-2 focus:ring-[#E8650A]/40"
            spellCheck={false}
          />
        )}
        <div className="px-5 py-4 border-t border-[#eef0f2] flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={loading}>Cancelar</Button>
          <Button variant="primary" onClick={guardar} loading={loading} disabled={cargando}>Guardar</Button>
        </div>
      </div>
    </div>
  )
}
