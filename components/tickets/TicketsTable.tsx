'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Plus, Search } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { BadgeEstadoTicket, BadgePrioridad } from '@/components/ui/badge'
import { formatFechaHora } from '@/lib/utils'
import { mensajeErrorRespuesta } from '@/lib/errores'
import { AREAS_TICKET, ESTADOS_TICKET, TIPOS_TICKET, labelAreaTicket, labelTipoTicket } from '@/lib/tickets/constants'
import { useCan } from '@/components/auth/useCan'

interface TicketRow {
  id: string
  numero: string
  titulo: string
  tipo: string
  areaOrigen: string
  estado: string
  prioridad: string
  creadoEn: string
  solicitante?: { nombre: string }
  asignado?: { nombre: string } | null
}

function paramOrDefault(value: string | null, fallback: string) {
  return value && value.length > 0 ? value : fallback
}

export function TicketsTable() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const puedeVerTodos = useCan('tickets.read_all')

  const [search, setSearch] = useState(() => searchParams.get('q') ?? '')
  const [estado, setEstado] = useState(() => paramOrDefault(searchParams.get('estado'), 'TODOS'))
  const [tipo, setTipo] = useState(() => paramOrDefault(searchParams.get('tipo'), 'TODOS'))
  const [area, setArea] = useState(() => paramOrDefault(searchParams.get('area'), 'TODOS'))
  const [soloMios, setSoloMios] = useState(() => searchParams.get('soloMios') === '1')
  const [tickets, setTickets] = useState<TicketRow[]>([])
  const [loading, setLoading] = useState(true)

  const syncUrl = useCallback(
    (next: { q?: string; estado?: string; tipo?: string; area?: string; soloMios?: boolean }) => {
      const params = new URLSearchParams()
      const q = next.q ?? search
      const est = next.estado ?? estado
      const tip = next.tipo ?? tipo
      const ar = next.area ?? area
      const mios = next.soloMios ?? soloMios

      if (q.trim()) params.set('q', q.trim())
      if (est !== 'TODOS') params.set('estado', est)
      if (tip !== 'TODOS') params.set('tipo', tip)
      if (ar !== 'TODOS') params.set('area', ar)
      if (mios) params.set('soloMios', '1')

      const qs = params.toString()
      router.replace(qs ? `/tickets?${qs}` : '/tickets', { scroll: false })
    },
    [router, search, estado, tipo, area, soloMios],
  )

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search.trim()) params.set('q', search.trim())
      if (estado !== 'TODOS') params.set('estado', estado)
      if (tipo !== 'TODOS') params.set('tipo', tipo)
      if (area !== 'TODOS') params.set('area', area)
      if (soloMios) params.set('soloMios', '1')

      const res = await fetch(`/api/tickets?${params}`, { credentials: 'include' })
      if (!res.ok) throw new Error(await mensajeErrorRespuesta(res, 'Error al cargar solicitudes'))
      setTickets(await res.json())
    } catch (e) {
      console.error(e)
      setTickets([])
    } finally {
      setLoading(false)
    }
  }, [search, estado, tipo, area, soloMios])

  useEffect(() => {
    cargar()
  }, [cargar])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="flex flex-wrap gap-2 flex-1 min-w-[200px]">
          <div className="relative flex-1 min-w-[180px] max-w-sm">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9aa1ab]" />
            <input
              type="search"
              placeholder="Buscar por número o título…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                syncUrl({ q: e.target.value })
              }}
              className="w-full pl-9 pr-3 py-2 text-[13px] border border-[#e4e7eb] rounded-[9px] bg-white"
            />
          </div>
          <select
            value={estado}
            onChange={(e) => {
              setEstado(e.target.value)
              syncUrl({ estado: e.target.value })
            }}
            className="border border-[#e4e7eb] rounded-[9px] px-2 py-2 text-[12.5px] bg-white"
          >
            <option value="TODOS">Todos los estados</option>
            {ESTADOS_TICKET.map((e) => (
              <option key={e.value} value={e.value}>{e.label}</option>
            ))}
          </select>
          <select
            value={tipo}
            onChange={(e) => {
              setTipo(e.target.value)
              syncUrl({ tipo: e.target.value })
            }}
            className="border border-[#e4e7eb] rounded-[9px] px-2 py-2 text-[12.5px] bg-white"
          >
            <option value="TODOS">Todos los tipos</option>
            {TIPOS_TICKET.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
          <select
            value={area}
            onChange={(e) => {
              setArea(e.target.value)
              syncUrl({ area: e.target.value })
            }}
            className="border border-[#e4e7eb] rounded-[9px] px-2 py-2 text-[12.5px] bg-white"
          >
            <option value="TODOS">Todas las áreas</option>
            {AREAS_TICKET.map((a) => (
              <option key={a.value} value={a.value}>{a.label}</option>
            ))}
          </select>
          {puedeVerTodos && (
            <label className="flex items-center gap-1.5 text-[12px] text-[#5b626d] px-2">
              <input
                type="checkbox"
                checked={soloMios}
                onChange={(e) => {
                  setSoloMios(e.target.checked)
                  syncUrl({ soloMios: e.target.checked })
                }}
              />
              Solo mías
            </label>
          )}
        </div>
        <Link href="/tickets/nuevo">
          <Button size="sm">
            <Plus size={15} /> Nueva solicitud
          </Button>
        </Link>
      </div>

      <Card className="overflow-hidden">
        {loading ? (
          <p className="p-6 text-[12.5px] text-[#9aa1ab]">Cargando…</p>
        ) : tickets.length === 0 ? (
          <p className="p-6 text-[12.5px] text-[#9aa1ab]">No hay solicitudes con estos filtros.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[12.5px]">
              <thead>
                <tr className="border-b border-[#f0f1f3] text-[11px] uppercase tracking-wide text-[#8a909a]">
                  <th className="px-4 py-3 font-bold">Número</th>
                  <th className="px-4 py-3 font-bold">Título</th>
                  <th className="px-4 py-3 font-bold">Tipo</th>
                  <th className="px-4 py-3 font-bold">Área</th>
                  <th className="px-4 py-3 font-bold">Estado</th>
                  <th className="px-4 py-3 font-bold">Prioridad</th>
                  <th className="px-4 py-3 font-bold">Solicitante</th>
                  <th className="px-4 py-3 font-bold">Asignado</th>
                  <th className="px-4 py-3 font-bold">Creada</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((t) => (
                  <tr key={t.id} className="border-b border-[#f4f5f7] hover:bg-[#fafbfc]">
                    <td className="px-4 py-3">
                      <Link href={`/tickets/${t.id}`} className="font-mono font-bold text-[#E8650A] hover:underline">
                        {t.numero}
                      </Link>
                    </td>
                    <td className="px-4 py-3 max-w-[220px]">
                      <Link href={`/tickets/${t.id}`} className="font-semibold text-[#1f242c] hover:underline line-clamp-1">
                        {t.titulo}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-[#5b626d]">{labelTipoTicket(t.tipo as never)}</td>
                    <td className="px-4 py-3 text-[#5b626d]">{labelAreaTicket(t.areaOrigen as never)}</td>
                    <td className="px-4 py-3"><BadgeEstadoTicket estado={t.estado} /></td>
                    <td className="px-4 py-3"><BadgePrioridad prioridad={t.prioridad} /></td>
                    <td className="px-4 py-3 text-[#5b626d]">{t.solicitante?.nombre ?? '—'}</td>
                    <td className="px-4 py-3 text-[#5b626d]">{t.asignado?.nombre ?? '—'}</td>
                    <td className="px-4 py-3 text-[#9aa1ab] whitespace-nowrap">{formatFechaHora(t.creadoEn)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
