'use client'

import { Fragment, useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Search, ChevronDown, ChevronRight, AlertTriangle, FileSpreadsheet } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { ConfigPageShell } from '@/components/configuracion/ConfigPageShell'
import { etiquetaNivelLog, etiquetaOrigenLog } from '@/lib/config/config-labels'
import { formatFechaHora } from '@/lib/utils'
import { mensajeErrorRespuesta } from '@/lib/errores'

interface LogRow {
  id: string
  nivel: string
  origen: string
  ruta: string | null
  metodo: string | null
  mensaje: string
  stack: string | null
  ip: string | null
  metadata: unknown
  fecha: string
  usuario: { id: string; nombre: string; email: string } | null
}

interface DiaResumen {
  dia: string
  total: number
}

function formatDiaCorto(dia: string): string {
  const [y, m, d] = dia.split('-')
  return `${d}/${m}/${y.slice(2)}`
}

export function LogsManager() {
  const searchParams = useSearchParams()
  const [logs, setLogs] = useState<LogRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [retencion, setRetencion] = useState(15)
  const [q, setQ] = useState('')
  const [nivel, setNivel] = useState(() => searchParams.get('nivel') ?? '')
  const [origen, setOrigen] = useState(() => searchParams.get('origen') ?? '')
  const [usuarioId, setUsuarioId] = useState('')
  const [dia, setDia] = useState('')
  const [origenes, setOrigenes] = useState<string[]>([])
  const [niveles, setNiveles] = useState<string[]>([])
  const [dias, setDias] = useState<DiaResumen[]>([])
  const [usuarios, setUsuarios] = useState<{ id: string; nombre: string; email: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [expandido, setExpandido] = useState<string | null>(null)

  const cargar = useCallback(async (p = page) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(p), limit: '40' })
      if (q.trim()) params.set('q', q.trim())
      if (nivel) params.set('nivel', nivel)
      if (origen) params.set('origen', origen)
      if (usuarioId) params.set('usuarioId', usuarioId)
      if (dia) params.set('dia', dia)
      const res = await fetch(`/api/logs?${params}`, { credentials: 'include' })
      if (!res.ok) throw new Error(await mensajeErrorRespuesta(res, 'Error al cargar logs'))
      const data = await res.json()
      setLogs(data.logs ?? [])
      setTotal(data.total ?? 0)
      setPage(data.page ?? 1)
      setPages(data.pages ?? 1)
      setRetencion(data.retencionDias ?? 15)
      setOrigenes(data.filtros?.origenes ?? [])
      setNiveles(data.filtros?.niveles ?? [])
      setDias(data.filtros?.dias ?? [])
      setUsuarios(data.filtros?.usuarios ?? [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [page, q, nivel, origen, usuarioId, dia])

  useEffect(() => { cargar(1) }, [q, nivel, origen, usuarioId, dia]) // eslint-disable-line react-hooks/exhaustive-deps

  function buscar(e: React.FormEvent) {
    e.preventDefault()
    cargar(1)
  }

  function exportarExcel() {
    const params = new URLSearchParams()
    if (q.trim()) params.set('q', q.trim())
    if (nivel) params.set('nivel', nivel)
    if (origen) params.set('origen', origen)
    if (usuarioId) params.set('usuarioId', usuarioId)
    if (dia) params.set('dia', dia)
    window.open(`/api/logs/export?${params}`, '_blank')
  }

  function nivelColor(n: string): string {
    if (n === 'ERROR') return 'text-red-600 bg-red-50'
    if (n === 'WARN') return 'text-amber-700 bg-amber-50'
    return 'text-blue-700 bg-blue-50'
  }

  return (
    <ConfigPageShell>
      <div className="flex items-start gap-2 text-[12.5px] text-[#7c828c]">
        <AlertTriangle size={16} className="text-[#E8650A] mt-0.5 flex-shrink-0" />
        <p>
          Errores técnicos capturados automáticamente (API, workers). Retención:{' '}
          <strong className="text-[#16181d]">{retencion} días</strong>.{' '}
          {total.toLocaleString('es-AR')} evento(s) con los filtros actuales.
        </p>
      </div>

      <Card className="p-3">
        <p className="text-[10px] font-bold uppercase text-[#8a909a] mb-2">Por día</p>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setDia('')}
            className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors ${
              !dia ? 'bg-[#E8650A] text-white border-[#E8650A]' : 'bg-white text-[#6b7280] border-[#e4e7eb] hover:border-[#E8650A]'
            }`}
          >
            Todos
          </button>
          {dias.map((d) => (
            <button
              key={d.dia}
              type="button"
              onClick={() => setDia(d.dia)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors ${
                dia === d.dia
                  ? 'bg-[#E8650A] text-white border-[#E8650A]'
                  : d.total > 0
                    ? 'bg-white text-[#16181d] border-[#e4e7eb] hover:border-[#E8650A]'
                    : 'bg-[#fafbfc] text-[#b0b5bd] border-[#f0f1f3]'
              }`}
            >
              {formatDiaCorto(d.dia)}
              {d.total > 0 && <span className="ml-1 opacity-80">({d.total})</span>}
            </button>
          ))}
        </div>
      </Card>

      <Card className="p-4">
        <form onSubmit={buscar} className="flex flex-wrap gap-3 items-end">
          <div className="flex items-center gap-2 bg-[#f4f6f9] border border-[#e4e7eb] rounded-[9px] px-3 py-2 flex-1 min-w-[200px]">
            <Search size={16} className="text-[#9aa1ab]" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar mensaje, ruta, stack…"
              className="flex-1 bg-transparent text-[13px] outline-none"
            />
          </div>
          <Select
            label="Nivel"
            value={nivel}
            onChange={(e) => setNivel(e.target.value)}
            options={[{ value: '', label: 'Todos' }, ...niveles.map((n) => ({ value: n, label: etiquetaNivelLog(n) }))]}
            className="min-w-[130px]"
          />
          <Select
            label="Origen"
            value={origen}
            onChange={(e) => setOrigen(e.target.value)}
            options={[{ value: '', label: 'Todos' }, ...origenes.map((o) => ({ value: o, label: etiquetaOrigenLog(o) }))]}
            className="min-w-[150px]"
          />
          <Select
            label="Usuario"
            value={usuarioId}
            onChange={(e) => setUsuarioId(e.target.value)}
            options={[{ value: '', label: 'Todos' }, ...usuarios.map((u) => ({ value: u.id, label: u.nombre }))]}
            className="min-w-[180px]"
          />
          <Button type="submit" variant="primary" size="sm">Filtrar</Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={exportarExcel}
            disabled={loading || total === 0}
            title="Descarga Excel con los filtros actuales (hasta 5000 filas, incluye stack y metadata)"
          >
            <FileSpreadsheet size={14} className="mr-1.5" />
            Exportar Excel
          </Button>
        </form>
      </Card>

      <Card padding={false}>
        {loading ? (
          <p className="p-6 text-[12.5px] text-[#9aa1ab]">Cargando…</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="text-[10px] uppercase text-[#8a909a]">
                  <th className="w-8 px-3 py-2"></th>
                  <th className="text-left px-3 py-2">Fecha</th>
                  <th className="text-left px-3 py-2">Nivel</th>
                  <th className="text-left px-3 py-2">Origen</th>
                  <th className="text-left px-3 py-2">Ruta</th>
                  <th className="text-left px-3 py-2">Mensaje</th>
                  <th className="text-left px-3 py-2">Usuario</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l) => (
                  <Fragment key={l.id}>
                    <tr className="border-t border-[#f4f5f7] hover:bg-[#fafbfc]">
                      <td className="px-3 py-2.5">
                        {(l.stack || l.metadata != null) ? (
                          <button type="button" onClick={() => setExpandido(expandido === l.id ? null : l.id)} className="text-[#9aa1ab]">
                            {expandido === l.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          </button>
                        ) : null}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">{formatFechaHora(l.fecha)}</td>
                      <td className="px-3 py-2.5">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${nivelColor(l.nivel)}`}>
                          {etiquetaNivelLog(l.nivel)}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">{etiquetaOrigenLog(l.origen)}</td>
                      <td className="px-3 py-2.5 font-mono text-[11px]">
                        {l.metodo && <span className="text-[#9aa1ab]">{l.metodo} </span>}
                        {l.ruta ?? '—'}
                      </td>
                      <td className="px-3 py-2.5 max-w-[280px] truncate" title={l.mensaje}>{l.mensaje}</td>
                      <td className="px-3 py-2.5">
                        {l.usuario ? (
                          <>
                            <p className="font-semibold">{l.usuario.nombre}</p>
                            <p className="text-[10.5px] text-[#9aa1ab]">{l.usuario.email}</p>
                          </>
                        ) : (
                          <span className="text-[#9aa1ab]">—</span>
                        )}
                      </td>
                    </tr>
                    {expandido === l.id && (
                      <tr className="bg-[#fafbfc]">
                        <td colSpan={7} className="px-5 py-3 space-y-3">
                          {l.ip && (
                            <p className="text-[11px] text-[#6b7280]">IP: <span className="font-mono">{l.ip}</span></p>
                          )}
                          {l.stack && (
                            <div>
                              <p className="text-[10px] font-bold uppercase text-[#8a909a] mb-1">Stack trace</p>
                              <pre className="text-[10.5px] bg-white border rounded-lg p-2 overflow-auto max-h-48 whitespace-pre-wrap">{l.stack}</pre>
                            </div>
                          )}
                          {l.metadata != null && (
                            <div>
                              <p className="text-[10px] font-bold uppercase text-[#8a909a] mb-1">Metadata</p>
                              <pre className="text-[10.5px] bg-white border rounded-lg p-2 overflow-auto max-h-32">{JSON.stringify(l.metadata, null, 2)}</pre>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
                {logs.length === 0 && (
                  <tr><td colSpan={7} className="px-5 py-10 text-center text-[#9aa1ab]">Sin registros con esos filtros</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        <div className="px-5 py-3 border-t flex items-center justify-between text-[12px]">
          <span className="text-[#6b7280]">Página {page} de {pages}</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => cargar(page - 1)}>Anterior</Button>
            <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => cargar(page + 1)}>Siguiente</Button>
          </div>
        </div>
      </Card>
    </ConfigPageShell>
  )
}
