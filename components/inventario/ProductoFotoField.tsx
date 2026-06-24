'use client'

import { useRef, useState } from 'react'
import { Camera, Trash2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { comprimirImagenProducto } from '@/lib/imagen/comprimir-imagen'
import { mensajeErrorDesconocido, mensajeErrorRespuesta } from '@/lib/errores'

type Props = {
  inventarioId?: string | null
  fotoUrl: string | null
  onFotoChange: (url: string | null) => void
  /** Solo alta: archivo comprimido en memoria hasta guardar el producto. */
  onArchivoPendiente?: (file: File | null) => void
  disabled?: boolean
}

export async function subirFotoInventario(inventarioId: string, file: File): Promise<string> {
  const comprimida = file.type === 'image/webp' ? file : await comprimirImagenProducto(file)
  const fd = new FormData()
  fd.append('archivo', comprimida)
  const res = await fetch(`/api/inventario/${inventarioId}/foto`, {
    method: 'POST',
    body: fd,
    credentials: 'include',
  })
  if (!res.ok) throw new Error(await mensajeErrorRespuesta(res, 'No se pudo subir la foto'))
  const data = (await res.json()) as { fotoUrl: string }
  return data.fotoUrl
}

export function ProductoFotoField({
  inventarioId,
  fotoUrl,
  onFotoChange,
  onArchivoPendiente,
  disabled,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [subiendo, setSubiendo] = useState(false)
  const [previewLocal, setPreviewLocal] = useState<string | null>(null)

  const preview = previewLocal ?? fotoUrl

  async function subir(file: File) {
    setSubiendo(true)
    try {
      const comprimida = await comprimirImagenProducto(file)
      const kb = Math.round(comprimida.size / 1024)

      if (!inventarioId) {
        if (previewLocal) URL.revokeObjectURL(previewLocal)
        const url = URL.createObjectURL(comprimida)
        setPreviewLocal(url)
        onArchivoPendiente?.(comprimida)
        onFotoChange(null)
        toast.success(`Imagen optimizada (${kb} KB) — se guardará al crear el producto`)
        return
      }

      const nuevaUrl = await subirFotoInventario(inventarioId, comprimida)
      setPreviewLocal(null)
      onFotoChange(nuevaUrl)
      onArchivoPendiente?.(null)
      toast.success(`Foto actualizada (${kb} KB)`)
    } catch (e) {
      toast.error(mensajeErrorDesconocido(e, 'No se pudo procesar la imagen'))
    } finally {
      setSubiendo(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  async function quitar() {
    if (previewLocal) URL.revokeObjectURL(previewLocal)
    setPreviewLocal(null)
    onArchivoPendiente?.(null)

    if (!inventarioId) {
      onFotoChange(null)
      return
    }

    setSubiendo(true)
    try {
      const res = await fetch(`/api/inventario/${inventarioId}/foto`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (!res.ok) throw new Error(await mensajeErrorRespuesta(res, 'No se pudo quitar la imagen'))
      onFotoChange(null)
      toast.success('Foto eliminada')
    } catch (e) {
      toast.error(mensajeErrorDesconocido(e, 'No se pudo quitar la imagen'))
    } finally {
      setSubiendo(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-[11.5px] font-semibold text-[#5b626d] uppercase">Foto del producto</p>
      <div className="flex flex-col sm:flex-row gap-3 items-start">
        <div className="w-[120px] h-[120px] rounded-[10px] border border-[#e4e7eb] bg-[#f8f9fb] flex items-center justify-center overflow-hidden shrink-0">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="Producto" className="w-full h-full object-contain" />
          ) : (
            <Camera size={28} className="text-[#c4c9d1]" />
          )}
        </div>
        <div className="flex flex-col gap-2 flex-1">
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            disabled={disabled || subiendo}
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void subir(f)
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
            <Upload size={14} /> {preview ? 'Cambiar imagen' : 'Subir imagen'}
          </Button>
          {preview && (
            <Button type="button" variant="secondary" size="sm" disabled={disabled || subiendo} onClick={() => void quitar()}>
              <Trash2 size={14} /> Quitar foto
            </Button>
          )}
          <p className="text-[10.5px] text-[#9aa1ab] leading-relaxed">
            JPG, PNG o WEBP. Se optimiza en el navegador (máx. 800 px, WebP) antes de subir al servidor.
          </p>
        </div>
      </div>
    </div>
  )
}
