'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Search, Plus, ChevronRight, ChevronDown } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { BadgeTipoCliente } from '@/components/ui/badge'
import { formatFecha } from '@/lib/utils'
import type { Cliente, TipoCliente } from '@/types'

const TIPOS: { value: string; label: string }[] = [
  { value: 'TODOS',       label: 'Todos los tipos' },
  { value: 'HOSPITAL',    label: 'Hospital' },
  { value: 'CLINICA',     label: 'Clínica' },
  { value: 'CONSULTORIO', label: 'Consultorio' },
  { value: 'SANATORIO',   label: 'Sanatorio' },
  { value: 'OTRO',        label: 'Otro' },
]

interface ClienteRow extends Cliente {
  _count?: { equipos: number; ots: number }
  ots?: Array<{ creadoEn: string }>
}

export function ClientesTable({ clientes }: { clientes: ClienteRow[] }) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [tipo, setTipo] = useState('TODOS')

  const filtered = clientes.filter((c) => {
    const matchSearch =
      !search ||
      c.nombre.toLowerCase().includes(search.toLowerCase()) ||
      (c.ciudad ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (c.contacto ?? '').toLowerCase().includes(search.toLowerCase())
    const matchTipo = tipo === 'TODOS' || c.tipo === tipo
    return matchSearch && matchTipo
  })

  function handleSearch(e: React.ChangeEvent<HTMLInputElement>) {
    setSearch(e.target.value)
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Barra de filtros */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 bg-white border border-[#e4e7eb] rounded-[9px] px-3 py-2 w-[300px]">
          <Search size={16} className="text-[#9aa1ab]" />
          <input
            value={search}
            onChange={handleSearch}
            placeholder="Buscar cliente, ciudad, contacto…"
            className="flex-1 text-[12.5px] bg-transparent border-none outline-none text-[#1f242c] placeholder:text-[#9aa1ab]"
          />
        </div>

        <div className="flex items-center gap-2 bg-white border border-[#e4e7eb] rounded-[9px] px-3 py-2">
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value)}
            className="text-[12.5px] text-[#3a4150] font-semibold bg-transparent border-none outline-none cursor-pointer"
          >
            {TIPOS.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        <div className="flex-1" />

        <Button
          onClick={() => router.push('/crm/nuevo')}
          size="md"
          className="gap-2"
        >
          <Plus size={16} strokeWidth={2.4} />
          Nuevo Cliente
        </Button>
      </div>

      {/* Tabla */}
      <Card padding={false} className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                {['Cliente', 'Tipo', 'Ciudad', 'Contacto', 'Equipos', 'Última OT', 'Acciones'].map((h, i) => (
                  <th
                    key={h}
                    className={`px-5 py-3 text-[10.5px] font-bold text-[#8a909a] tracking-[0.6px] uppercase border-b border-[#eef0f2] ${i === 6 ? 'text-right' : 'text-left'} ${i === 4 ? 'text-center' : ''}`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((c, i) => {
                const initials = c.nombre
                  .split(' ')
                  .slice(0, 2)
                  .map((w) => w[0])
                  .join('')
                  .toUpperCase()
                const ultimaOT = c.ots?.[0]?.creadoEn

                return (
                  <tr key={c.id} className={i % 2 === 0 ? 'bg-white' : 'bg-[#fafbfc]'}>
                    <td className="px-5 py-[13px] border-b border-[#f4f5f7]">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-[8px] bg-[#FFF1E2] flex items-center justify-center text-[#E8650A] font-extrabold text-[12px] flex-shrink-0">
                          {initials}
                        </div>
                        <span className="text-[12.5px] font-bold text-[#1f242c]">{c.nombre}</span>
                      </div>
                    </td>
                    <td className="px-5 py-[13px] border-b border-[#f4f5f7]">
                      <BadgeTipoCliente tipo={c.tipo} />
                    </td>
                    <td className="px-5 py-[13px] text-[12.5px] text-[#3a4150] border-b border-[#f4f5f7]">
                      {c.ciudad ?? '—'}
                    </td>
                    <td className="px-5 py-[13px] text-[12.5px] text-[#6b7280] border-b border-[#f4f5f7]">
                      {c.contacto ?? '—'}
                    </td>
                    <td className="px-5 py-[13px] text-center text-[12.5px] font-bold text-[#3a4150] border-b border-[#f4f5f7]">
                      {c._count?.equipos ?? 0}
                    </td>
                    <td className="px-5 py-[13px] text-[12.5px] text-[#6b7280] border-b border-[#f4f5f7]">
                      {ultimaOT ? formatFecha(ultimaOT) : 'Nunca'}
                    </td>
                    <td className="px-5 py-[13px] text-right border-b border-[#f4f5f7]">
                      <Link
                        href={`/crm/${c.id}`}
                        className="inline-flex items-center gap-1 text-[#E8650A] text-[12px] font-bold hover:underline"
                      >
                        Ver ficha
                        <ChevronRight size={13} strokeWidth={2.4} />
                      </Link>
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-[12.5px] text-[#9aa1ab]">
                    No se encontraron clientes con los filtros aplicados
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
