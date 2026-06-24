'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Search, Plus } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { BadgeEstadoOT, BadgePrioridad, BadgeTipoOT } from '@/components/ui/badge'
import { formatFecha, formatFechaHora } from '@/lib/utils'
import type { OrdenTrabajo } from '@/types'
import { cn } from '@/lib/utils'

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
  tecnico?: { nombre: string }
  tecnicoId?: string | null
}

export function OTsTable({ ots }: { ots: OTRow[] }) {
  const router = useRouter()
  const [search,  setSearch]  = useState('')
  const [estado,  setEstado]  = useState('TODOS')
  const [tecnico, setTecnico] = useState('TODOS')
  const [sla,     setSla]     = useState<(typeof SLA_FILTROS)[number]['value']>('TODOS')

  const tecnicosUnicos = useMemo(() => {
    const names = new Set<string>()
    for (const ot of ots) {
      if (ot.tecnico?.nombre) names.add(ot.tecnico.nombre)
    }
    return [...names].sort((a, b) => a.localeCompare(b, 'es'))
  }, [ots])

  function matchSla(ot: OTRow): boolean {
    if (sla === 'TODOS') return true
    const ahora = Date.now()
    const vence = new Date(ot.slaVence).getTime()
    const vencido = ot.estado === 'VENCIDA' || vence < ahora
    const proximo = !vencido && vence - ahora <= 24 * 60 * 60 * 1000
    if (sla === 'VENCIDO') return vencido
    if (sla === 'PROXIMO') return proximo
    return !vencido && !proximo
  }

  const filtered = ots.filter((ot) => {
    const q = search.toLowerCase()
    const matchSearch =
      !search ||
      ot.numero.toLowerCase().includes(q) ||
      (ot.cliente?.nombre ?? '').toLowerCase().includes(q) ||
      (ot.equipo?.nombre  ?? '').toLowerCase().includes(q)
    const matchEstado = estado === 'TODOS' || ot.estado === estado
    const matchTecnico = tecnico === 'TODOS' || ot.tecnico?.nombre === tecnico
    return matchSearch && matchEstado && matchTecnico && matchSla(ot)
  })

  return (
    <div className="flex flex-col gap-4">
      {/* Filtros */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 bg-white border border-[#e4e7eb] rounded-[9px] px-3 py-2 w-[260px]">
          <Search size={16} className="text-[#9aa1ab]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar OT, cliente, equipo…"
            className="flex-1 text-[12.5px] bg-transparent border-none outline-none text-[#1f242c] placeholder:text-[#9aa1ab]"
          />
        </div>

        <div className="bg-white border border-[#e4e7eb] rounded-[9px] px-3 py-2">
          <select
            value={estado}
            onChange={(e) => setEstado(e.target.value)}
            className="text-[12.5px] text-[#3a4150] font-semibold bg-transparent border-none outline-none cursor-pointer"
          >
            {ESTADOS.map((e) => <option key={e.value} value={e.value}>{e.label}</option>)}
          </select>
        </div>

        {tecnicosUnicos.length > 0 && (
          <div className="bg-white border border-[#e4e7eb] rounded-[9px] px-3 py-2">
            <select
              value={tecnico}
              onChange={(e) => setTecnico(e.target.value)}
              className="text-[12.5px] text-[#3a4150] font-semibold bg-transparent border-none outline-none cursor-pointer"
            >
              <option value="TODOS">Todos los técnicos</option>
              {tecnicosUnicos.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        )}

        <div className="bg-white border border-[#e4e7eb] rounded-[9px] px-3 py-2">
          <select
            value={sla}
            onChange={(e) => setSla(e.target.value as typeof sla)}
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

      {/* Tabla */}
      <Card padding={false}>
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
              {filtered.map((ot, i) => {
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
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="px-5 py-10 text-center text-[12.5px] text-[#9aa1ab]">No se encontraron órdenes de trabajo</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
