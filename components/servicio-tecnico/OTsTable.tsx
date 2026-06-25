'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Search, Plus } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { BadgeEstadoOT, BadgePrioridad, BadgeTipoOT } from '@/components/ui/badge'
import { formatFecha, formatFechaHora } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { mensajeErrorRespuesta } from '@/lib/errores'

const ESTADOS = [
  { value: 'TODOS',      label: 'Todos los estados' },
  { value: 'ABIERTA',    label: 'Abierta' },
  { value: 'EN_PROCESO', label: 'En proceso' },
  { value: 'CERRADA',    label: 'Cerrada' },
  { value: 'VENCIDA',    label: 'Vencida' },
  { value: 'CANCELADA',  label: 'Cancelada' },
]

const SLA_FILTROS = [
  { value: 'TODOS',   label: 'Todo SLA' },
  { value: 'VENCIDO', label: 'SLA vencido' },
  { value: 'PROXIMO', label: 'SLA próximo (24 h)' },
  { value: 'OK',      label: 'SLA en término' },
] as const

interface OTRow {
  id: string
  numero: string
  descripcion: string
  tipo: string
  estado: string
  prioridad: string
  slaHoras: number
  fechaApertura: string
  fechaCierre?: string | null
  slaVence: string
  clienteId: string
  cliente?: { nombre: string }
  equipo?:  { nombre: string }
  tecnico?: { id?: string; nombre: string }
  tecnicoId?: string | null
}

interface TecnicoOption {
  id: string
  nombre: string
}

function paramOrDefault(value: string | null, fallback: string) {
  return value && value.length > 0 ? value : fallback
}

export function OTsTable({ tecnicos = [] }: { tecnicos?: TecnicoOption[] }) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [search, setSearch] = useState(() => searchParams.get('q') ?? '')
  const [estado, setEstado] = useState(() => paramOrDefault(searchParams.get('estado'), 'TODOS'))
  const [tecnicoId, setTecnicoId] = useState(() => paramOrDefault(searchParams.get('tecnicoId'), 'TODOS'))
  const [sla, setSla] = useState<(typeof SLA_FILTROS)[number]['value']>(() =>
    paramOrDefault(searchParams.get('sla'), 'TODOS') as (typeof SLA_FILTROS)[number]['value'],
  )
  const [ots, setOts] = useState<OTRow[]>([])
  const [loading, setLoading] = useState(true)

  const syncUrl = useCallback((next: {
    q?: string
    estado?: string
    tecnicoId?: string
    sla?: string
  }) => {
    const params = new URLSearchParams()
    const q = next.q ?? search
    const est = next.estado ?? estado
    const tec = next.tecnicoId ?? tecnicoId
    const slaVal = next.sla ?? sla

    if (q.trim()) params.set('q', q.trim())
    if (est !== 'TODOS') params.set('estado', est)
    if (tec !== 'TODOS') params.set('tecnicoId', tec)
    if (slaVal !== 'TODOS') params.set('sla', slaVal)

    const qs = params.toString()
    router.replace(qs ? `/servicio-tecnico?${qs}` : '/servicio-tecnico', { scroll: false })
  }, [router, search, estado, tecnicoId, sla])

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search.trim()) params.set('q', search.trim())
      if (estado !== 'TODOS') params.set('estado', estado)
      if (tecnicoId !== 'TODOS') params.set('tecnicoId', tecnicoId)
      if (sla !== 'TODOS') params.set('sla', sla)

      const res = await fetch(`/api/ots?${params}`, { credentials: 'include' })
      if (!res.ok) throw new Error(await mensajeErrorRespuesta(res, 'Error al cargar órdenes de trabajo'))
      setOts(await res.json())
    } catch (e) {
      console.error(e)
      setOts([])
    } finally {
      setLoading(false)
    }
  }, [search, estado, tecnicoId, sla])

  useEffect(() => {
    cargar()
  }, [cargar])

  function onSearchChange(value: string) {
    setSearch(value)
    syncUrl({ q: value })
  }

  function onEstadoChange(value: string) {
    setEstado(value)
    syncUrl({ estado: value })
  }

  function onTecnicoChange(value: string) {
    setTecnicoId(value)
    syncUrl({ tecnicoId: value })
  }

  function onSlaChange(value: typeof sla) {
    setSla(value)
    syncUrl({ sla: value })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 bg-white border border-[#e4e7eb] rounded-[9px] px-3 py-2 w-[260px]">
          <Search size={16} className="text-[#9aa1ab]" />
          <input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Buscar OT, cliente, equipo…"
            className="flex-1 text-[12.5px] bg-transparent border-none outline-none text-[#1f242c] placeholder:text-[#9aa1ab]"
          />
        </div>

        <div className="bg-white border border-[#e4e7eb] rounded-[9px] px-3 py-2">
          <select
            value={estado}
            onChange={(e) => onEstadoChange(e.target.value)}
            className="text-[12.5px] text-[#3a4150] font-semibold bg-transparent border-none outline-none cursor-pointer"
          >
            {ESTADOS.map((e) => <option key={e.value} value={e.value}>{e.label}</option>)}
          </select>
        </div>

        {tecnicos.length > 0 && (
          <div className="bg-white border border-[#e4e7eb] rounded-[9px] px-3 py-2">
            <select
              value={tecnicoId}
              onChange={(e) => onTecnicoChange(e.target.value)}
              className="text-[12.5px] text-[#3a4150] font-semibold bg-transparent border-none outline-none cursor-pointer"
            >
              <option value="TODOS">Todos los técnicos</option>
              {tecnicos.map((t) => (
                <option key={t.id} value={t.id}>{t.nombre}</option>
              ))}
            </select>
          </div>
        )}

        <div className="bg-white border border-[#e4e7eb] rounded-[9px] px-3 py-2">
          <select
            value={sla}
            onChange={(e) => onSlaChange(e.target.value as typeof sla)}
            className="text-[12.5px] text-[#3a4150] font-semibold bg-transparent border-none outline-none cursor-pointer"
          >
            {SLA_FILTROS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>

        <div className="flex-1" />

        <Button onClick={() => router.push('/servicio-tecnico/nueva')}>
          <Plus size={16} strokeWidth={2.4} />
          Nueva OT
        </Button>
      </div>

      <Card padding={false}>
        {loading ? (
          <p className="p-6 text-[12.5px] text-[#9aa1ab]">Cargando…</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  {['N° OT', 'Tipo', 'Cliente', 'Equipo', 'Técnico', 'Apertura', 'SLA vence', 'Estado'].map((h) => (
                    <th key={h} className="px-5 py-3 text-left text-[10.5px] font-bold text-[#8a909a] tracking-[0.6px] uppercase border-b border-[#eef0f2]">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ots.map((ot, i) => {
                  const vencido = ot.estado === 'VENCIDA' || new Date(ot.slaVence) < new Date()
                  return (
                    <tr key={ot.id} className={i % 2 === 0 ? 'bg-white' : 'bg-[#fafbfc]'}>
                      <td className="px-5 py-[13px] border-b border-[#f4f5f7]">
                        <Link href={`/servicio-tecnico/${ot.id}`} className="text-[12.5px] font-bold text-[#E8650A] hover:underline">
                          {ot.numero}
                        </Link>
                      </td>
                      <td className="px-5 py-[13px] border-b border-[#f4f5f7]">
                        <BadgeTipoOT tipo={ot.tipo} />
                      </td>
                      <td className="px-5 py-[13px] text-[12.5px] font-semibold text-[#3a4150] border-b border-[#f4f5f7]">
                        {ot.cliente?.nombre ?? '—'}
                      </td>
                      <td className="px-5 py-[13px] text-[12.5px] text-[#6b7280] border-b border-[#f4f5f7]">
                        {ot.equipo?.nombre ?? '—'}
                      </td>
                      <td className="px-5 py-[13px] text-[12.5px] text-[#3a4150] border-b border-[#f4f5f7]">
                        {ot.tecnico?.nombre ?? 'Sin asignar'}
                      </td>
                      <td className="px-5 py-[13px] text-[12.5px] text-[#6b7280] border-b border-[#f4f5f7]">
                        {formatFecha(ot.fechaApertura)}
                      </td>
                      <td className={cn('px-5 py-[13px] text-[12.5px] font-semibold border-b border-[#f4f5f7]', vencido ? 'text-[#C2261B]' : 'text-[#3a4150]')}>
                        {formatFechaHora(ot.slaVence)}
                      </td>
                      <td className="px-5 py-[13px] border-b border-[#f4f5f7]">
                        <BadgeEstadoOT estado={ot.estado as any} />
                      </td>
                    </tr>
                  )
                })}
                {ots.length === 0 && (
                  <tr><td colSpan={8} className="px-5 py-10 text-center text-[12.5px] text-[#9aa1ab]">No se encontraron órdenes de trabajo</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
