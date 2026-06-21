'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Plus, Pencil } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { ConfigPageShell } from '@/components/configuracion/ConfigPageShell'
import { CANALES_NOTIFICACION, EVENTOS_NOTIFICACION } from '@/lib/config/config-labels'
import { mensajeErrorDesconocido, mensajeErrorRespuesta } from '@/lib/errores'

type Tab = 'plantillas' | 'reglas'

interface Plantilla {
  id: string
  codigo: string
  nombre: string
  canal: string
  asunto: string | null
  cuerpo: string
  activo: boolean
}

interface Regla {
  id: string
  codigo: string
  nombre: string
  evento: string
  diasAnticipacion: number | null
  activo: boolean
  plantillaId: string | null
  plantilla?: { id: string; nombre: string; codigo: string } | null
}

export function NotificacionesManager() {
  const [tab, setTab] = useState<Tab>('reglas')
  const [plantillas, setPlantillas] = useState<Plantilla[]>([])
  const [reglas, setReglas] = useState<Regla[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<{ tipo: Tab; item?: Plantilla | Regla } | null>(null)

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/config/notificaciones', { credentials: 'include' })
      if (!res.ok) throw new Error(await mensajeErrorRespuesta(res, 'Error al cargar'))
      const data = await res.json()
      setPlantillas(data.plantillas ?? [])
      setReglas(data.reglas ?? [])
    } catch (e) {
      toast.error(mensajeErrorDesconocido(e, 'Error al cargar notificaciones'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  async function toggle(tipo: Tab, id: string, activo: boolean) {
    const res = await fetch('/api/config/notificaciones', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo: tipo === 'plantillas' ? 'plantilla' : 'regla', id, data: { activo: !activo } }),
    })
    if (res.ok) { toast.success('Actualizado'); cargar() }
    else toast.error(await mensajeErrorRespuesta(res, 'No se pudo actualizar'))
  }

  return (
    <ConfigPageShell>
      <Card className="bg-[#EFF6FF] border-[#93C5FD]">
        <p className="text-[12.5px] text-[#1E40AF]">
          Definí plantillas de mensaje y reglas por evento del ERP. Variables disponibles:{' '}
          <code className="text-[11px] bg-white px-1 rounded">{'{{numero}} {{cliente}} {{fecha}} {{monto}} {{equipo}}'}</code>
        </p>
      </Card>

      <div className="flex gap-2 border-b border-[#e4e7eb] pb-2">
        {(['reglas', 'plantillas'] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-3 py-2 rounded-[8px] text-[12px] font-semibold ${tab === t ? 'bg-[#E8650A] text-white' : 'bg-white border border-[#e4e7eb]'}`}
          >
            {t === 'reglas' ? 'Reglas de aviso' : 'Plantillas'}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-[12.5px] text-[#9aa1ab]">Cargando…</p>
      ) : tab === 'reglas' ? (
        <Card padding={false}>
          <div className="px-5 py-3 border-b flex justify-between items-center">
            <h3 className="text-[13px] font-bold">Reglas activas</h3>
            <Button variant="primary" size="sm" onClick={() => setModal({ tipo: 'reglas' })}><Plus size={14} /> Nueva regla</Button>
          </div>
          <table className="w-full text-[12px]">
            <thead>
              <tr className="text-[10px] uppercase text-[#8a909a]">
                <th className="text-left px-5 py-2">Regla</th>
                <th className="text-left px-5 py-2">Evento</th>
                <th className="text-left px-5 py-2">Anticipación</th>
                <th className="text-left px-5 py-2">Plantilla</th>
                <th className="text-right px-5 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {reglas.map((r) => (
                <tr key={r.id} className="border-t border-[#f4f5f7]">
                  <td className="px-5 py-3 font-semibold">{r.nombre}</td>
                  <td className="px-5 py-3 font-mono text-[11px]">{r.evento}</td>
                  <td className="px-5 py-3">{r.diasAnticipacion != null ? `${r.diasAnticipacion} días` : '—'}</td>
                  <td className="px-5 py-3">{r.plantilla?.nombre ?? '—'}</td>
                  <td className="px-5 py-3 text-right space-x-1">
                    <Button variant="ghost" size="sm" onClick={() => setModal({ tipo: 'reglas', item: r })}><Pencil size={14} /></Button>
                    <Button variant="outline" size="sm" onClick={() => toggle('reglas', r.id, r.activo)}>{r.activo ? 'Off' : 'On'}</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ) : (
        <Card padding={false}>
          <div className="px-5 py-3 border-b flex justify-between items-center">
            <h3 className="text-[13px] font-bold">Plantillas de mensaje</h3>
            <Button variant="primary" size="sm" onClick={() => setModal({ tipo: 'plantillas' })}><Plus size={14} /> Nueva plantilla</Button>
          </div>
          <table className="w-full text-[12px]">
            <thead>
              <tr className="text-[10px] uppercase text-[#8a909a]">
                <th className="text-left px-5 py-2">Nombre</th>
                <th className="text-left px-5 py-2">Canal</th>
                <th className="text-left px-5 py-2">Asunto</th>
                <th className="text-right px-5 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {plantillas.map((p) => (
                <tr key={p.id} className="border-t border-[#f4f5f7]">
                  <td className="px-5 py-3">
                    <p className="font-semibold">{p.nombre}</p>
                    <p className="text-[10.5px] font-mono text-[#9aa1ab]">{p.codigo}</p>
                  </td>
                  <td className="px-5 py-3">{CANALES_NOTIFICACION.find((c) => c.value === p.canal)?.label ?? p.canal}</td>
                  <td className="px-5 py-3 text-[#6b7280]">{p.asunto ?? '—'}</td>
                  <td className="px-5 py-3 text-right space-x-1">
                    <Button variant="ghost" size="sm" onClick={() => setModal({ tipo: 'plantillas', item: p })}><Pencil size={14} /></Button>
                    <Button variant="outline" size="sm" onClick={() => toggle('plantillas', p.id, p.activo)}>{p.activo ? 'Off' : 'On'}</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {modal && (
        <NotifModal
          tipo={modal.tipo}
          item={modal.item}
          plantillas={plantillas}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); cargar() }}
        />
      )}
    </ConfigPageShell>
  )
}

function NotifModal({
  tipo, item, plantillas, onClose, onSaved,
}: {
  tipo: Tab
  item?: Plantilla | Regla
  plantillas: Plantilla[]
  onClose: () => void
  onSaved: () => void
}) {
  const [loading, setLoading] = useState(false)
  const isEdit = !!item
  const p = item as Plantilla | undefined
  const r = item as Regla | undefined

  async function guardar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const data = Object.fromEntries(fd.entries()) as Record<string, string>
    setLoading(true)
    try {
      const res = await fetch('/api/config/notificaciones', {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: tipo === 'plantillas' ? 'plantilla' : 'regla',
          id: item?.id,
          data: {
            ...data,
            diasAnticipacion: data.diasAnticipacion ? Number(data.diasAnticipacion) : null,
            plantillaId: data.plantillaId || null,
          },
        }),
      })
      if (!res.ok) throw new Error(await mensajeErrorRespuesta(res, 'No se pudo guardar'))
      toast.success('Guardado')
      onSaved()
    } catch (err) {
      toast.error(mensajeErrorDesconocido(err, 'Error'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <form className="bg-white rounded-[14px] w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()} onSubmit={guardar}>
        <div className="px-5 py-4 border-b sticky top-0 bg-white">
          <h3 className="text-[14px] font-bold">{isEdit ? 'Editar' : 'Nuevo'}</h3>
        </div>
        <div className="p-5 flex flex-col gap-3">
          {tipo === 'plantillas' ? (
            <>
              <Input label="Código" name="codigo" defaultValue={p?.codigo} required disabled={isEdit} />
              <Input label="Nombre" name="nombre" defaultValue={p?.nombre} required />
              <Select label="Canal" name="canal" defaultValue={p?.canal ?? 'SISTEMA'} options={CANALES_NOTIFICACION} />
              <Input label="Asunto (email/WhatsApp)" name="asunto" defaultValue={p?.asunto ?? ''} />
              <label className="text-[11.5px] font-semibold text-[#5b626d] uppercase">
                Cuerpo del mensaje
                <textarea name="cuerpo" required defaultValue={p?.cuerpo ?? ''} rows={5}
                  className="mt-1 w-full border border-[#e4e7eb] rounded-[9px] px-3 py-2 text-[13px] font-normal normal-case" />
              </label>
            </>
          ) : (
            <>
              <Input label="Código" name="codigo" defaultValue={r?.codigo} required disabled={isEdit} />
              <Input label="Nombre" name="nombre" defaultValue={r?.nombre} required />
              <Select label="Evento del ERP" name="evento" defaultValue={r?.evento ?? ''} options={EVENTOS_NOTIFICACION} />
              <Input label="Días de anticipación" name="diasAnticipacion" type="number" defaultValue={r?.diasAnticipacion ?? 0} />
              <Select
                label="Plantilla asociada"
                name="plantillaId"
                defaultValue={r?.plantillaId ?? ''}
                options={[{ value: '', label: '— Sin plantilla —' }, ...plantillas.map((pl) => ({ value: pl.id, label: pl.nombre }))]}
              />
            </>
          )}
        </div>
        <div className="px-5 py-4 border-t flex justify-end gap-2 sticky bottom-0 bg-white">
          <Button type="button" variant="secondary" onClick={onClose} disabled={loading}>Cancelar</Button>
          <Button type="submit" variant="primary" loading={loading}>Guardar</Button>
        </div>
      </form>
    </div>
  )
}
