'use client'

import { Fragment, useCallback, useEffect, useState } from 'react'
import { Search, ChevronDown, ChevronRight } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { ConfigPageShell } from '@/components/configuracion/ConfigPageShell'
import { ExportAuditoriaButton } from '@/components/configuracion/ExportAuditoriaButton'
import { usePermisos } from '@/components/auth/useCan'
import { AUDITORIA_EXPORT_PERMISSIONS } from '@/lib/page-permissions'
import { etiquetaAccion } from '@/lib/config/config-labels'
import { formatFechaHora } from '@/lib/utils'
import { mensajeErrorDesconocido, mensajeErrorRespuesta } from '@/lib/errores'

interface LogRow {
  id: string
  accion: string
  entidad: string
  entidadId: string | null
  ip: string | null
  fecha: string
  antes: unknown
  despues: unknown
  usuario: { id: string; nombre: string; email: string } | null
}

export function AuditoriaManager() {
  const userPermisos = usePermisos()
  const puedeExportar =
    userPermisos.includes('*') ||
    AUDITORIA_EXPORT_PERMISSIONS.some((p) => userPermisos.includes(p))
  const [logs, setLogs] = useState<LogRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [q, setQ] = useState('')
  const [entidad, setEntidad] = useState('')
  const [usuarioId, setUsuarioId] = useState('')
  const [entidades, setEntidades] = useState<string[]>([])
  const [usuarios, setUsuarios] = useState<{ id: string; nombre: string; email: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [expandido, setExpandido] = useState<string | null>(null)

  const cargar = useCallback(async (p = page) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(p), limit: '40' })
      if (q.trim()) params.set('q', q.trim())
      if (entidad) params.set('entidad', entidad)
      if (usuarioId) params.set('usuarioId', usuarioId)
      const res = await fetch(`/api/auditoria?${params}`, { credentials: 'include' })
      if (!res.ok) throw new Error(await mensajeErrorRespuesta(res, 'Error al cargar auditoría'))
      const data = await res.json()
      setLogs(data.logs ?? [])
      setTotal(data.total ?? 0)
      setPage(data.page ?? 1)
      setPages(data.pages ?? 1)
      setEntidades(data.filtros?.entidades ?? [])
      setUsuarios(data.filtros?.usuarios ?? [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [page, q, entidad, usuarioId])

  useEffect(() => { cargar(1) }, [q, entidad, usuarioId]) // eslint-disable-line react-hooks/exhaustive-deps

  function buscar(e: React.FormEvent) {
    e.preventDefault()
    cargar(1)
  }

  return (
    <ConfigPageShell>
      <p className="text-[12.5px] text-[#7c828c]">
        Registro inmutable de acciones en el ERP: {total.toLocaleString('es-AR')} eventos en total.
      </p>

      {puedeExportar && (
        <Card className="p-4">
          <p className="text-[12px] font-semibold text-[#16181d] mb-2">Exportar auditoría (CSV)</p>
          <p className="text-[11.5px] text-[#7c828c] mb-3">
            Hasta 10.000 registros por rango de fechas. Requiere permiso de configuración o auditoría.
          </p>
          <ExportAuditoriaButton />
        </Card>
      )}

      <Card className="p-4">
        <form onSubmit={buscar} className="flex flex-wrap gap-3 items-end">
          <div className="flex items-center gap-2 bg-[#f4f6f9] border border-[#e4e7eb] rounded-[9px] px-3 py-2 flex-1 min-w-[200px]">
            <Search size={16} className="text-[#9aa1ab]" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar acción, entidad, IP…"
              className="flex-1 bg-transparent text-[13px] outline-none"
            />
          </div>
          <Select
            label="Entidad"
            value={entidad}
            onChange={(e) => setEntidad(e.target.value)}
            options={[{ value: '', label: 'Todas' }, ...entidades.map((en) => ({ value: en, label: en }))]}
            className="min-w-[160px]"
          />
          <Select
            label="Usuario"
            value={usuarioId}
            onChange={(e) => setUsuarioId(e.target.value)}
            options={[{ value: '', label: 'Todos' }, ...usuarios.map((u) => ({ value: u.id, label: u.nombre }))]}
            className="min-w-[180px]"
          />
          <Button type="submit" variant="primary" size="sm">Filtrar</Button>
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
                  <th className="text-left px-3 py-2">Usuario</th>
                  <th className="text-left px-3 py-2">Acción</th>
                  <th className="text-left px-3 py-2">Entidad</th>
                  <th className="text-left px-3 py-2">IP</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l) => (
                  <Fragment key={l.id}>
                    <tr className="border-t border-[#f4f5f7] hover:bg-[#fafbfc]">
                      <td className="px-3 py-2.5">
                        {(l.antes != null || l.despues != null) ? (
                          <button type="button" onClick={() => setExpandido(expandido === l.id ? null : l.id)} className="text-[#9aa1ab]">
                            {expandido === l.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          </button>
                        ) : null}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">{formatFechaHora(l.fecha)}</td>
                      <td className="px-3 py-2.5">
                        {l.usuario ? (
                          <>
                            <p className="font-semibold">{l.usuario.nombre}</p>
                            <p className="text-[10.5px] text-[#9aa1ab]">{l.usuario.email}</p>
                          </>
                        ) : (
                          <span className="text-[#9aa1ab]">Sistema</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 font-semibold">{etiquetaAccion(l.accion)}</td>
                      <td className="px-3 py-2.5">
                        <span className="font-mono text-[11px]">{l.entidad}</span>
                        {l.entidadId && <span className="text-[#9aa1ab] ml-1">· {l.entidadId.slice(0, 8)}…</span>}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-[11px]">{l.ip ?? '—'}</td>
                    </tr>
                    {expandido === l.id && (
                      <tr className="bg-[#fafbfc]">
                        <td colSpan={6} className="px-5 py-3">
                          <div className="grid grid-cols-2 gap-4">
                            {l.antes != null && (
                              <div>
                                <p className="text-[10px] font-bold uppercase text-[#8a909a] mb-1">Antes</p>
                                <pre className="text-[10.5px] bg-white border rounded-lg p-2 overflow-auto max-h-40">{JSON.stringify(l.antes, null, 2)}</pre>
                              </div>
                            )}
                            {l.despues != null && (
                              <div>
                                <p className="text-[10px] font-bold uppercase text-[#8a909a] mb-1">Después</p>
                                <pre className="text-[10.5px] bg-white border rounded-lg p-2 overflow-auto max-h-40">{JSON.stringify(l.despues, null, 2)}</pre>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
                {logs.length === 0 && (
                  <tr><td colSpan={6} className="px-5 py-10 text-center text-[#9aa1ab]">Sin registros con esos filtros</td></tr>
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
