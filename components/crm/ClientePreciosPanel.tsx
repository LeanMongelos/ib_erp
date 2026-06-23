'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { useCan } from '@/components/auth/useCan'
import { mensajeErrorDesconocido, mensajeErrorJson } from '@/lib/errores'

interface ListaOption {
  id: string
  codigo: string
  nombre: string
  tipo: string
  moneda: string
}

interface Props {
  clienteId: string
  listaPreciosId?: string | null
  esMayorista?: boolean
  monedaPreferida?: string | null
  puedeEditar: boolean
  onSaved?: () => void
}

export function ClientePreciosPanel({
  clienteId,
  listaPreciosId,
  esMayorista = false,
  monedaPreferida,
  puedeEditar,
  onSaved,
}: Props) {
  const canUpdate = useCan('clientes.update')
  const puedeEditarReal = puedeEditar && canUpdate
  const [listas, setListas] = useState<ListaOption[]>([])
  const [form, setForm] = useState({
    listaPreciosId: listaPreciosId ?? '',
    esMayorista,
    monedaPreferida: monedaPreferida ?? '',
  })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetch('/api/listas-precios', { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setListas(data.filter((l: ListaOption & { activo?: boolean }) => l.activo !== false)) })
      .catch(() => {})
  }, [])

  useEffect(() => {
    setForm({
      listaPreciosId: listaPreciosId ?? '',
      esMayorista,
      monedaPreferida: monedaPreferida ?? '',
    })
  }, [listaPreciosId, esMayorista, monedaPreferida])

  async function guardar() {
    setLoading(true)
    try {
      const res = await fetch(`/api/clientes/${clienteId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listaPreciosId: form.listaPreciosId || null,
          esMayorista: form.esMayorista,
          monedaPreferida: form.monedaPreferida || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(mensajeErrorJson(data, 'No se pudo guardar'))
      toast.success('Condiciones comerciales actualizadas')
      onSaved?.()
    } catch (e) {
      toast.error(mensajeErrorDesconocido(e, 'No se pudo guardar'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <h4 className="text-[11px] font-bold text-[#8a909a] uppercase tracking-wide mb-3">Precios comerciales</h4>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Select
          label="Lista asignada"
          value={form.listaPreciosId}
          disabled={!puedeEditarReal}
          onChange={(e) => setForm((f) => ({ ...f, listaPreciosId: e.target.value }))}
          placeholder="Automática (por tipo cliente)"
          options={[
            { value: '', label: 'Automática (por tipo cliente)' },
            ...listas.map((l) => ({ value: l.id, label: `${l.codigo} — ${l.nombre}` })),
          ]}
        />
        <Select
          label="Moneda preferida"
          value={form.monedaPreferida}
          disabled={!puedeEditarReal}
          onChange={(e) => setForm((f) => ({ ...f, monedaPreferida: e.target.value }))}
          placeholder="Sin preferencia"
          options={[
            { value: '', label: 'Sin preferencia' },
            { value: 'ARS', label: 'ARS' },
            { value: 'USD', label: 'USD' },
          ]}
        />
        <div className="flex flex-col justify-end gap-2">
          <label className="flex items-center gap-2 text-[12.5px] text-[#3a4150] cursor-pointer">
            <input
              type="checkbox"
              checked={form.esMayorista}
              disabled={!puedeEditarReal}
              onChange={(e) => setForm((f) => ({ ...f, esMayorista: e.target.checked }))}
            />
            Cliente mayorista (usa lista MAY predeterminada)
          </label>
          {puedeEditarReal && (
            <Button variant="secondary" size="sm" loading={loading} onClick={guardar}>
              Guardar precios
            </Button>
          )}
        </div>
      </div>
      <p className="text-[11px] text-[#9aa1ab] mt-3">
        Al presupuestar o facturar, el picker sugerirá precios según esta configuración. El operador puede ajustarlos manualmente.
      </p>
    </Card>
  )
}
