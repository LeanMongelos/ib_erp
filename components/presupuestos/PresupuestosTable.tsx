'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Plus } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { BadgeEstadoPresupuesto } from '@/components/ui/badge'
import { formatFecha } from '@/lib/utils'
import { formatMontoMoneda } from '@/lib/moneda'

const ESTADOS = [
  { value: 'TODOS', label: 'Todos' },
  { value: 'BORRADOR', label: 'Borrador' },
  { value: 'ENVIADO', label: 'Enviado' },
  { value: 'APROBADO', label: 'Aprobado' },
  { value: 'CONVERTIDO', label: 'Convertido' },
  { value: 'RECHAZADO', label: 'Rechazado' },
  { value: 'VENCIDO', label: 'Vencido' },
]

interface PresupuestoRow {
  id: string
  numero: string
  version?: number
  estado: string
  fechaEmision: string
  fechaVencimiento?: string | null
  total: number
  moneda?: string
  cliente?: { nombre: string }
}

export function PresupuestosTable({ presupuestos }: { presupuestos: PresupuestoRow[] }) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [estado, setEstado] = useState('TODOS')

  const filtered = presupuestos.filter((p) => {
    const q = search.toLowerCase()
    const matchSearch = !search || p.numero.toLowerCase().includes(q) || (p.cliente?.nombre ?? '').toLowerCase().includes(q)
    const matchEstado = estado === 'TODOS' || p.estado === estado
    return matchSearch && matchEstado
  })

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 bg-white border border-[#e4e7eb] rounded-[9px] px-3 py-2 w-[280px]">
          <Search size={16} className="text-[#9aa1ab]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar presupuesto, cliente…"
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
        <div className="flex-1" />
        <Button variant="outline" onClick={() => router.push('/presupuestos/nuevo?modo=ocasional')}>
          Venta ocasional
        </Button>
        <Button onClick={() => router.push('/presupuestos/nuevo')}>
          <Plus size={16} strokeWidth={2.4} />
          Nuevo Presupuesto
        </Button>
      </div>

      <Card padding={false}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                {['N° Presupuesto', 'Cliente', 'Emisión', 'Vencimiento', 'Total', 'Estado'].map((h) => (
                  <th key={h} className="px-5 py-3 text-left text-[10.5px] font-bold text-[#8a909a] tracking-[0.6px] uppercase border-b border-[#eef0f2]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((p, i) => (
                <tr
                  key={p.id}
                  onClick={() => router.push(`/presupuestos/${p.id}`)}
                  className={`cursor-pointer hover:bg-orange-50/50 ${i % 2 === 0 ? 'bg-white' : 'bg-[#fafbfc]'}`}
                >
                  <td className="px-5 py-[13px] text-[12.5px] font-bold text-[#E8650A] border-b border-[#f4f5f7]">
                    {p.numero}
                    {(p.version ?? 1) > 1 && (
                      <span className="ml-1 text-[10px] font-semibold text-[#6b7280]">v{p.version}</span>
                    )}
                  </td>
                  <td className="px-5 py-[13px] text-[12.5px] font-semibold text-[#3a4150] border-b border-[#f4f5f7]">{p.cliente?.nombre ?? '—'}</td>
                  <td className="px-5 py-[13px] text-[12.5px] text-[#6b7280] border-b border-[#f4f5f7]">{formatFecha(p.fechaEmision)}</td>
                  <td className="px-5 py-[13px] text-[12.5px] text-[#6b7280] border-b border-[#f4f5f7]">{p.fechaVencimiento ? formatFecha(p.fechaVencimiento) : '—'}</td>
                  <td className="px-5 py-[13px] text-[12.5px] font-bold text-[#1f242c] border-b border-[#f4f5f7]">{formatMontoMoneda(p.total, p.moneda ?? 'ARS')}</td>
                  <td className="px-5 py-[13px] border-b border-[#f4f5f7]"><BadgeEstadoPresupuesto estado={p.estado} /></td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="px-5 py-10 text-center text-[12.5px] text-[#9aa1ab]">No se encontraron presupuestos</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
