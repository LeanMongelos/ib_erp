'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { mensajeErrorDesconocido, mensajeErrorRespuesta } from '@/lib/errores'
import { AREAS_TICKET, TIPOS_TICKET } from '@/lib/tickets/constants'

interface Props {
  areaOrigenDefault: string
}

export function NuevoTicketForm({ areaOrigenDefault }: Props) {
  const router = useRouter()
  const [guardando, setGuardando] = useState(false)
  const [form, setForm] = useState({
    titulo: '',
    descripcion: '',
    tipo: 'CONSULTA',
    areaOrigen: areaOrigenDefault,
    prioridad: 'NORMAL',
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setGuardando(true)
    try {
      const res = await fetch('/api/tickets', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error(await mensajeErrorRespuesta(res, 'No se pudo crear la solicitud'))
      const ticket = (await res.json()) as { id: string; numero: string }
      toast.success(`Solicitud ${ticket.numero} creada`)
      router.push(`/tickets/${ticket.id}`)
    } catch (err) {
      toast.error(mensajeErrorDesconocido(err, 'Error al crear solicitud'))
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Card className="p-6 max-w-2xl">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="text-[11.5px] font-semibold text-[#5b626d] uppercase">Título *</label>
          <input
            required
            maxLength={200}
            value={form.titulo}
            onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))}
            placeholder="Ej. No puedo emitir factura tipo A"
            className="mt-1 w-full border border-[#e4e7eb] rounded-[9px] px-3 py-2 text-[13px]"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-[11.5px] font-semibold text-[#5b626d] uppercase">Tipo *</label>
            <Select
              value={form.tipo}
              onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value }))}
              options={TIPOS_TICKET.map((t) => ({ value: t.value, label: t.label }))}
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-[11.5px] font-semibold text-[#5b626d] uppercase">Área solicitante *</label>
            <Select
              value={form.areaOrigen}
              onChange={(e) => setForm((f) => ({ ...f, areaOrigen: e.target.value }))}
              options={AREAS_TICKET.filter((a) => a.value !== 'DESARROLLO').map((a) => ({
                value: a.value,
                label: a.label,
              }))}
              className="mt-1"
            />
          </div>
        </div>

        <div>
          <label className="text-[11.5px] font-semibold text-[#5b626d] uppercase">Prioridad</label>
          <Select
            value={form.prioridad}
            onChange={(e) => setForm((f) => ({ ...f, prioridad: e.target.value }))}
            options={[
              { value: 'BAJA', label: 'Baja' },
              { value: 'NORMAL', label: 'Normal' },
              { value: 'ALTA', label: 'Alta' },
              { value: 'URGENTE', label: 'Urgente' },
            ]}
            className="mt-1 max-w-xs"
          />
        </div>

        <div>
          <label className="text-[11.5px] font-semibold text-[#5b626d] uppercase">Descripción *</label>
          <textarea
            required
            rows={6}
            maxLength={8000}
            value={form.descripcion}
            onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))}
            placeholder="Contá qué pasó, en qué pantalla, qué esperabas y qué ocurrió…"
            className="mt-1 w-full border border-[#e4e7eb] rounded-[9px] px-3 py-2 text-[13px] resize-y min-h-[120px]"
          />
        </div>

        <div className="flex gap-2 pt-2">
          <Button type="submit" disabled={guardando}>
            {guardando ? 'Enviando…' : 'Enviar solicitud'}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.push('/tickets')}>
            Cancelar
          </Button>
        </div>
      </form>
    </Card>
  )
}
