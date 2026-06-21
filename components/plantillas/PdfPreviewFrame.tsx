'use client'

import { useEffect, useState, useRef } from 'react'
import { Loader2 } from 'lucide-react'

/** Cola global: un solo PDF a la vez para no bloquear el dev server. */
let pdfQueue: Promise<void> = Promise.resolve()

function encolarPdf<T>(fn: () => Promise<T>): Promise<T> {
  const run = pdfQueue.then(fn, fn)
  pdfQueue = run.then(
    () => undefined,
    () => undefined,
  )
  return run
}

/** Carga PDF vía fetch (evita X-Frame-Options: DENY en respuestas API). */
export function PdfPreviewFrame({
  src,
  titulo,
  className,
  scale = 1,
  enabled = true,
  delayMs = 0,
  queued = true,
}: {
  src: string
  titulo: string
  className?: string
  scale?: number
  /** Si false, no dispara fetch (evita saturar el servidor). */
  enabled?: boolean
  /** Retraso antes de pedir el PDF (ms). */
  delayMs?: number
  /** Si true, espera turno en cola global (recomendado en listados). */
  queued?: boolean
}) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [waiting, setWaiting] = useState(true)
  const requestId = useRef(0)

  useEffect(() => {
    if (!enabled) {
      setWaiting(true)
      setBlobUrl(null)
      setError(null)
      return
    }

    const id = ++requestId.current
    let revoke: string | null = null
    setBlobUrl(null)
    setError(null)
    setWaiting(true)

    const delayTimer = window.setTimeout(() => {
      if (requestId.current !== id) return
      setWaiting(false)

      const controller = new AbortController()
      const timeoutTimer = window.setTimeout(() => controller.abort(), 45_000)

      const fetchPdf = () =>
        fetch(src, { credentials: 'include', signal: controller.signal }).then(async (res) => {
          const ct = res.headers.get('content-type') ?? ''
          if (!res.ok) {
            const msg = res.status === 401 ? 'Sesión expirada' : `Error ${res.status}`
            throw new Error(msg)
          }
          if (!ct.includes('pdf')) {
            const text = await res.text()
            throw new Error(text.slice(0, 80) || 'Respuesta no es PDF')
          }
          const blob = await res.blob()
          if (blob.size < 100) throw new Error('PDF vacío')
          return blob
        })

      const task = queued ? () => encolarPdf(fetchPdf) : fetchPdf

      task()
        .then((blob) => {
          if (requestId.current !== id) return
          revoke = URL.createObjectURL(blob)
          setBlobUrl(revoke)
        })
        .catch((e: unknown) => {
          if (requestId.current !== id) return
          const msg =
            e instanceof DOMException && e.name === 'AbortError'
              ? 'Tiempo de espera agotado'
              : e instanceof Error
                ? e.message
                : 'Error desconocido'
          setError(msg)
        })
        .finally(() => {
          window.clearTimeout(timeoutTimer)
        })
    }, delayMs)

    return () => {
      requestId.current += 1
      window.clearTimeout(delayTimer)
      if (revoke) URL.revokeObjectURL(revoke)
    }
  }, [src, enabled, delayMs, queued])

  if (!enabled || waiting) {
    return (
      <div className={`flex flex-col items-center justify-center gap-1 bg-[#f8f9fb] text-[#9aa1ab] text-[10px] ${className ?? ''}`}>
        <Loader2 size={18} className="animate-spin" />
        {!enabled ? 'En cola…' : 'Preparando…'}
      </div>
    )
  }

  if (error) {
    return (
      <div className={`flex items-center justify-center bg-[#fef2f2] text-[#991b1b] text-[10px] p-3 text-center ${className ?? ''}`}>
        {error}
      </div>
    )
  }

  if (!blobUrl) {
    return (
      <div className={`flex flex-col items-center justify-center gap-1 bg-[#f8f9fb] text-[#9aa1ab] ${className ?? ''}`}>
        <Loader2 size={20} className="animate-spin" />
        <span className="text-[10px]">Generando PDF…</span>
      </div>
    )
  }

  if (scale !== 1) {
    return (
      <div className={`relative overflow-hidden bg-white ${className ?? ''}`}>
        <iframe
          src={blobUrl}
          title={titulo}
          className="absolute top-0 left-0 border-0 bg-white pointer-events-none"
          style={{
            width: 595,
            height: 842,
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
          }}
        />
      </div>
    )
  }

  return (
    <iframe src={blobUrl} title={titulo} className={`border-0 bg-white w-full ${className ?? ''}`} />
  )
}
