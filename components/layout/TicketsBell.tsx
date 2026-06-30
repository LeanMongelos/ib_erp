'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Ticket, ImagePlus, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useCan } from '@/components/auth/useCan'
import { useSession } from 'next-auth/react'
import { BadgeEstadoTicket } from '@/components/ui/badge'
import { toast } from 'sonner'
import { mensajeErrorDesconocido, mensajeErrorRespuesta } from '@/lib/errores'
import { areaDesdeRol } from '@/lib/tickets/constants'

type TicketMini = {
  id: string
  numero: string
  titulo: string
  estado: string
  creadoEn: string
}

type AlertaTicket = {
  clave: string
  titulo: string
  mensaje: string
  href: string
  leida: boolean
  prioridad: string
}

export function TicketsBell() {
  const puedeCrear = useCan('tickets.create')
  const esAdmin = useCan('tickets.read_all')
  const { data: session } = useSession()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [tickets, setTickets] = useState<TicketMini[]>([])
  const [alertas, setAlertas] = useState<AlertaTicket[]>([])
  const [noLeidas, setNoLeidas] = useState(0)
  const [enviando, setEnviando] = useState(false)
  const [titulo, setTitulo] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [archivo, setArchivo] = useState<File | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  const cargar = useCallback(async () => {
    if (!puedeCrear) return
    setLoading(true)
    try {
      const res = await fetch('/api/tickets/inbox', { credentials: 'include' })
      if (!res.ok) return
      const data = await res.json()
      setTickets(data.tickets ?? [])
      setAlertas(data.alertas ?? [])
      setNoLeidas(data.noLeidas ?? 0)
    } catch {
      /* ignore */
    } finally {
      setLoading(false)
    }
  }, [puedeCrear])

  useEffect(() => {
    void cargar()
    const t = setInterval(() => void cargar(), 60_000)
    return () => clearInterval(t)
  }, [cargar])

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  if (!puedeCrear) return null

  async function enviarTicket(e: React.FormEvent) {
    e.preventDefault()
    if (titulo.trim().length < 5 || descripcion.trim().length < 10) {
      toast.error('Completá título (5+) y descripción (10+)')
      return
    }
    setEnviando(true)
    try {
      const rol = session?.user?.roles?.[0] ?? 'ADMINISTRACION'
      const res = await fetch('/api/tickets', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titulo: titulo.trim(),
          descripcion: descripcion.trim(),
          tipo: 'CONSULTA',
          areaOrigen: areaDesdeRol(rol),
          prioridad: 'NORMAL',
        }),
      })
      if (!res.ok) throw new Error(await mensajeErrorRespuesta(res, 'No se pudo crear el ticket'))
      const ticket = (await res.json()) as { id: string; numero: string }

      if (archivo) {
        const fd = new FormData()
        fd.append('archivo', archivo)
        const resAdj = await fetch(`/api/tickets/${ticket.id}/adjuntos`, {
          method: 'POST',
          credentials: 'include',
          body: fd,
        })
        if (!resAdj.ok) {
          toast.warning('Ticket creado pero la imagen no se pudo subir')
        }
      }

      toast.success(`Ticket ${ticket.numero} creado`)
      setTitulo('')
      setDescripcion('')
      setArchivo(null)
      setOpen(false)
      await cargar()
      router.push(`/tickets/${ticket.id}`)
    } catch (err) {
      toast.error(mensajeErrorDesconocido(err, 'Error al crear ticket'))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v)
          if (!open) void cargar()
        }}
        className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors"
        aria-label="Tickets"
        title="Tickets"
      >
        <Ticket size={18} className="text-[#5b626d]" />
        {noLeidas > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#E8650A] text-white text-[10px] font-bold flex items-center justify-center">
            {noLeidas > 9 ? '9+' : noLeidas}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-[min(100vw-2rem,380px)] bg-white border border-[#e9ebef] rounded-[12px] shadow-xl z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-[#f0f1f4] bg-[#fafbfc]">
            <p className="text-[13px] font-bold text-[#1f242c]">Tickets</p>
            <p className="text-[11px] text-[#9aa1ab]">Pedidos, errores y mejoras del ERP</p>
          </div>

          <form onSubmit={enviarTicket} className="p-4 border-b border-[#f0f1f4] space-y-2">
            <p className="text-[11px] font-bold uppercase text-[#8a909a]">Nuevo ticket rápido</p>
            <input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Título breve"
              maxLength={200}
              className="w-full border border-[#e4e7eb] rounded-[8px] px-2.5 py-2 text-[12.5px]"
            />
            <textarea
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="¿Qué necesitás? (mín. 10 caracteres)"
              rows={2}
              className="w-full border border-[#e4e7eb] rounded-[8px] px-2.5 py-2 text-[12.5px] resize-none"
            />
            <label className="flex items-center gap-2 text-[11.5px] text-[#5b626d] cursor-pointer">
              <ImagePlus size={14} />
              <span>{archivo ? archivo.name : 'Adjuntar captura (JPG/PNG)'}</span>
              <input
                type="file"
                accept="image/jpeg,image/png"
                className="hidden"
                onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
              />
            </label>
            <button
              type="submit"
              disabled={enviando}
              className="w-full py-2 rounded-[8px] bg-[#E8650A] text-white text-[12.5px] font-bold hover:bg-[#d45a09] disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {enviando ? <Loader2 size={14} className="animate-spin" /> : null}
              Enviar ticket
            </button>
          </form>

          {alertas.filter((a) => !a.leida).length > 0 && (
            <div className="px-4 py-2 border-b border-[#f0f1f4] bg-orange-50/50">
              <p className="text-[10.5px] font-bold uppercase text-[#E8650A] mb-1.5">Actualizaciones</p>
              {alertas.filter((a) => !a.leida).slice(0, 3).map((a) => (
                <Link
                  key={a.clave}
                  href={a.href}
                  onClick={() => setOpen(false)}
                  className="block py-1.5 text-[12px] text-[#1f242c] hover:text-[#E8650A]"
                >
                  <span className="font-semibold">{a.titulo}</span>
                  <span className="block text-[11px] text-[#6b7280] truncate">{a.mensaje}</span>
                </Link>
              ))}
            </div>
          )}

          <div className="max-h-[220px] overflow-y-auto p-2">
            <p className="px-2 py-1 text-[10.5px] font-bold uppercase text-[#8a909a]">Mis tickets</p>
            {loading ? (
              <p className="px-2 py-3 text-[12px] text-[#9aa1ab]">Cargando…</p>
            ) : tickets.length === 0 ? (
              <p className="px-2 py-3 text-[12px] text-[#9aa1ab]">No tenés tickets abiertos.</p>
            ) : (
              tickets.map((t) => (
                <Link
                  key={t.id}
                  href={`/tickets/${t.id}`}
                  onClick={() => setOpen(false)}
                  className="flex items-center justify-between gap-2 px-2 py-2 rounded-lg hover:bg-gray-50"
                >
                  <div className="min-w-0">
                    <p className="text-[11px] font-mono text-[#E8650A]">{t.numero}</p>
                    <p className="text-[12px] font-medium text-[#1f242c] truncate">{t.titulo}</p>
                  </div>
                  <BadgeEstadoTicket estado={t.estado} />
                </Link>
              ))
            )}
          </div>

          <div className="px-4 py-2.5 border-t border-[#f0f1f4] flex gap-3 text-[11.5px]">
            <Link href="/tickets/mis" onClick={() => setOpen(false)} className="text-[#E8650A] font-semibold hover:underline">
              Ver todos los míos
            </Link>
            {esAdmin && (
              <Link href="/tickets/admin" onClick={() => setOpen(false)} className="text-[#5b626d] font-semibold hover:underline ml-auto">
                Panel admin
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
