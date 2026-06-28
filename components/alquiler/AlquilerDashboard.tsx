'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { Plus, Search, Repeat, Download } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatFecha } from '@/lib/utils'
import { ESTADO_CONTRATO_LABEL } from '@/lib/alquiler/periodo'
import { useCan } from '@/components/auth/useCan'

interface ContratoRow {
  id: string
  numero: string
  estado: string
  fechaInicio: string | null
  fechaFin: string | null
  creadoEn: string
  cliente: { id: string; nombre: string; cuit: string | null }
  _count: { lineas: number; cuotas: number }
}

interface Resumen {
  contratosActivos: number
  contratosBorrador: number
  cuotasPendientes: number
  cuotasVencidas: number
  montoMensualActivo: number
}

const ESTADO_VARIANT: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'info'> = {
  BORRADOR: 'default',
  ACTIVO: 'success',
  SUSPENDIDO: 'warning',
  FINALIZADO: 'info',
  CANCELADO: 'danger',
}

function formatMonto(n: number) {
  return n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })
}

export function AlquilerDashboard({
  contratos: iniciales,
  resumen,
}: {
  contratos: ContratoRow[]
  resumen: Resumen
}) {
  const puedeCrear = useCan('alquiler.create')
  const puedeExportar = useCan('alquiler.export')
  const [contratos] = useState(iniciales)
  const [q, setQ] = useState('')
  const [estado, setEstado] = useState('')

  const filtrados = useMemo(() => {
    return contratos.filter((c) => {
      if (estado && c.estado !== estado) return false
      if (!q) return true
      const t = q.toLowerCase()
      return (
        c.numero.toLowerCase().includes(t) ||
        c.cliente.nombre.toLowerCase().includes(t) ||
        (c.cliente.cuit ?? '').includes(t)
      )
    })
  }, [contratos, q, estado])

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <p className="text-[11px] text-[#9aa1ab] uppercase tracking-wide">Contratos activos</p>
          <p className="text-2xl font-bold text-[#1f242c]">{resumen.contratosActivos}</p>
        </Card>
        <Card className="p-4">
          <p className="text-[11px] text-[#9aa1ab] uppercase tracking-wide">En borrador</p>
          <p className="text-2xl font-bold text-[#1f242c]">{resumen.contratosBorrador}</p>
        </Card>
        <Card className="p-4">
          <p className="text-[11px] text-[#9aa1ab] uppercase tracking-wide">Cuotas pendientes</p>
          <p className="text-2xl font-bold text-[#1f242c]">{resumen.cuotasPendientes}</p>
        </Card>
        <Card className="p-4">
          <p className="text-[11px] text-[#9aa1ab] uppercase tracking-wide">MRR activo</p>
          <p className="text-xl font-bold text-[#E8650A]">{formatMonto(resumen.montoMensualActivo)}</p>
        </Card>
      </div>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <Repeat size={18} className="text-[#E8650A]" />
            <h2 className="text-[15px] font-bold text-[#1f242c]">Contratos de alquiler</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#9aa1ab]" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar número o cliente…"
                className="pl-8 pr-3 py-2 text-[12.5px] border border-[#e4e7eb] rounded-[9px] bg-white w-56"
              />
            </div>
            <select
              value={estado}
              onChange={(e) => setEstado(e.target.value)}
              className="border border-[#e4e7eb] rounded-[9px] px-3 py-2 text-[12.5px] bg-white"
            >
              <option value="">Todos los estados</option>
              {Object.entries(ESTADO_CONTRATO_LABEL).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            {puedeExportar && (
              <>
                <a href="/api/reportes/alquiler-parque" className="inline-flex">
                  <Button variant="outline" size="sm"><Download size={14} /> Parque CSV</Button>
                </a>
                <a href="/api/reportes/alquiler-mrr" className="inline-flex">
                  <Button variant="outline" size="sm"><Download size={14} /> MRR CSV</Button>
                </a>
              </>
            )}
            {puedeCrear && (
              <Link href="/alquiler/contratos/nuevo">
                <Button variant="primary" size="sm">
                  <Plus size={15} /> Nuevo contrato
                </Button>
              </Link>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="border-b border-[#eef0f2] text-left text-[#9aa1ab]">
                <th className="py-2 pr-3 font-semibold">Número</th>
                <th className="py-2 pr-3 font-semibold">Cliente pagador</th>
                <th className="py-2 pr-3 font-semibold">Estado</th>
                <th className="py-2 pr-3 font-semibold">Líneas</th>
                <th className="py-2 pr-3 font-semibold">Inicio</th>
                <th className="py-2 font-semibold">Creado</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-[#9aa1ab]">
                    No hay contratos que coincidan con el filtro.
                  </td>
                </tr>
              )}
              {filtrados.map((c) => (
                <tr key={c.id} className="border-b border-[#f3f4f6] hover:bg-[#fafbfc]">
                  <td className="py-3 pr-3">
                    <Link href={`/alquiler/contratos/${c.id}`} className="font-semibold text-[#E8650A] hover:underline">
                      {c.numero}
                    </Link>
                  </td>
                  <td className="py-3 pr-3">
                    <div>{c.cliente.nombre}</div>
                    {c.cliente.cuit && <div className="text-[11px] text-[#9aa1ab]">{c.cliente.cuit}</div>}
                  </td>
                  <td className="py-3 pr-3">
                    <Badge variant={ESTADO_VARIANT[c.estado] ?? 'default'}>
                      {ESTADO_CONTRATO_LABEL[c.estado] ?? c.estado}
                    </Badge>
                  </td>
                  <td className="py-3 pr-3">{c._count.lineas}</td>
                  <td className="py-3 pr-3">{c.fechaInicio ? formatFecha(c.fechaInicio) : '—'}</td>
                  <td className="py-3">{formatFecha(c.creadoEn)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
