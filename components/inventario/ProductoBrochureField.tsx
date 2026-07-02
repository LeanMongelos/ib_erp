'use client'

import { useRef, useState } from 'react'
import { FileText, Trash2, Upload, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { mensajeErrorDesconocido, mensajeErrorRespuesta } from '@/lib/errores'

const MAX_BYTES = 20 * 1024 * 1024

type Props = {
  inventarioId?: string | null
  brochureUrl: string | null
  onBrochureChange: (url: string | null) => void
  /** Solo alta: archivo en memoria hasta guardar el producto. */
  onArchivoPendiente?: (file: File | null) => void
  disabled?: boolean
}

export async function subirBrochureInventario(inventarioId: string, file: File): Promise<string> {
  const fd = new FormData()
  fd.append('archivo', file)
  const res = await fetch(`/api/inventario/${inventarioId}/brochure`, {
    method: 'POST',
    body: fd,
    credentials: 'include',
  })
  if (!res.ok) throw new Error(await mensajeErrorRespuesta(res, 'No se pudo subir el brochure'))
  const data = (await res.json()) as { brochureUrl: string }
  return data.brochureUrl
}

export function ProductoBrochureField({
  inventarioId,
  brochureUrl,
  onBrochureChange,
  onArchivoPendiente,
  disabled,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [subiendo, setSubiendo] = useState(false)
  const [nombrePendiente, setNombrePendiente] = useState<string | null>(null)

  const tiene = Boolean(brochureUrl) || Boolean(nombrePendiente)

  async function elegir(file: File) {
    if (file.type !== 'application/pdf') {
      toast.error('El brochure debe ser un archivo PDF')
      return
    }
    if (file.size > MAX_BYTES) {
      toast.error('El PDF supera el límite permitido (20 MB)')
      return
    }
    setSubiendo(true)
    try {
      if (!inventarioId) {
        setNombrePendiente(file.name)
        onArchivoPendiente?.(file)
        onBrochureChange(null)
        toast.success(`PDF listo (${Math.round(file.size / 1024)} KB) — se guardará al crear el producto`)
        return
      }
      const url = await subirBrochureInventario(inventarioId, file)
      setNombrePendiente(null)
      onBrochureChange(url)
      onArchivoPendiente?.(null)
      toast.success('Brochure actualizado')
    } catch (e) {
      toast.error(mensajeErrorDesconocido(e, 'No se pudo subir el brochure'))
    } finally {
      setSubiendo(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  async function quitar() {
    setNombrePendiente(null)
    onArchivoPendiente?.(null)

    if (!inventarioId) {
      onBrochureChange(null)
      return
    }

    setSubiendo(true)
    try {
      const res = await fetch(`/api/inventario/${inventarioId}/brochure`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (!res.ok) throw new Error(await mensajeErrorRespuesta(res, 'No se pudo quitar el brochure'))
      onBrochureChange(null)
      toast.success('Brochure eliminado')
    } catch (e) {
      toast.error(mensajeErrorDesconocido(e, 'No se pudo quitar el brochure'))
    } finally {
      setSubiendo(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-[11.5px] font-semibold text-[#5b626d] uppercase">Brochure / ficha técnica (PDF)</p>
      <div className="flex flex-col sm:flex-row gap-3 items-start">
        <div className="w-[120px] h-[120px] rounded-[10px] border border-[#e4e7eb] bg-[#f8f9fb] flex items-center justify-center overflow-hidden shrink-0">
          <FileText size={30} className={tiene ? 'text-[#D94F1E]' : 'text-[#c4c9d1]'} />
        </div>
        <div className="flex flex-col gap-2 flex-1">
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            disabled={disabled || subiendo}
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void elegir(f)
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            loading={subiendo}
            disabled={disabled}
            onClick={() => inputRef.current?.click()}
          >
            <Upload size={14} /> {tiene ? 'Cambiar brochure' : 'Subir brochure'}
          </Button>
          {brochureUrl && (
            <a
              href={brochureUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[#D94F1E] hover:underline"
            >
              <ExternalLink size={14} /> Ver brochure
            </a>
          )}
          {tiene && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={disabled || subiendo}
              onClick={() => void quitar()}
            >
              <Trash2 size={14} /> Quitar brochure
            </Button>
          )}
          {nombrePendiente && (
            <p className="text-[10.5px] text-[#5b626d] truncate max-w-[220px]">Archivo: {nombrePendiente}</p>
          )}
          <p className="text-[10.5px] text-[#9aa1ab] leading-relaxed">
            PDF hasta 20 MB. Queda disponible para ver las especificaciones desde la ficha del producto.
          </p>
        </div>
      </div>
    </div>
  )
}
