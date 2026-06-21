'use client'

import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Hash, Save, Info } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { mensajeErrorDesconocido, mensajeErrorRespuesta } from '@/lib/errores'

export interface SecuenciaNumeracionRow {
  id: string
  clave: string
  etiqueta: string
  tipo: 'PRESUPUESTO' | 'FACTURA' | 'REMITO'
  subtipo: string | null
  anio: number | null
  prefijo: string
  padding: number
  proximoNumero: number
  maxEnBd: number
  proximoEfectivo: number
  ejemplo: string
}

export function NumeracionComprobantes({ puedeEditar }: { puedeEditar: boolean }) {
  const [filas, setFilas] = useState<SecuenciaNumeracionRow[]>([])
  const [loadingLista, setLoadingLista] = useState(true)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancel = false
    ;(async () => {
      try {
        const res = await fetch('/api/plantillas/numeracion')
        if (!res.ok) throw new Error(await mensajeErrorRespuesta(res, 'No se pudo cargar la numeración'))
        const data = (await res.json()) as SecuenciaNumeracionRow[]
        if (!cancel) setFilas(data)
      } catch (e) {
        if (!cancel) toast.error(mensajeErrorDesconocido(e, 'Error al cargar numeración'))
      } finally {
        if (!cancel) setLoadingLista(false)
      }
    })()
    return () => { cancel = true }
  }, [])

  const porGrupo = useMemo(() => ({
    presupuestos: filas.filter((f) => f.tipo === 'PRESUPUESTO'),
    facturas: filas.filter((f) => f.tipo === 'FACTURA'),
    remitos: filas.filter((f) => f.tipo === 'REMITO'),
  }), [filas])

  function setProximo(clave: string, valor: string) {
    const n = parseInt(valor, 10)
    if (Number.isNaN(n) || n < 1) return
    setFilas((prev) => prev.map((f) => {
      if (f.clave !== clave) return f
      const proximoEfectivo = Math.max(n, f.maxEnBd + 1)
      const ejemplo = `${f.prefijo}${String(proximoEfectivo).padStart(f.padding, '0')}`
      return { ...f, proximoNumero: n, proximoEfectivo, ejemplo }
    }))
  }

  async function guardar() {
    setLoading(true)
    try {
      const res = await fetch('/api/plantillas/numeracion', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          secuencias: filas.map((f) => ({ clave: f.clave, proximoNumero: f.proximoNumero })),
        }),
      })
      if (!res.ok) throw new Error(await mensajeErrorRespuesta(res, 'No se pudo guardar la numeración'))
      const data = (await res.json()) as SecuenciaNumeracionRow[]
      setFilas(data)
      toast.success('Numeración actualizada')
    } catch (e) {
      toast.error(mensajeErrorDesconocido(e, 'No se pudo guardar'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <div className="flex items-center gap-2 mb-2">
        <Hash size={16} className="text-[#E8650A]" />
        <h3 className="text-[13px] font-bold text-[#1f242c]">Numeración correlativa</h3>
      </div>
      <p className="text-[12px] text-[#6b7280] mb-3 leading-relaxed">
        Próximo número al migrar desde otra plataforma. El fiscal AFIP se define en Emisores; acá va el número interno del documento.
      </p>

      {loadingLista ? (
        <p className="text-[12px] text-[#9aa1ab]">Cargando numeración…</p>
      ) : (
        <div className="flex flex-col gap-4">
          <GrupoNumeracion titulo="Presupuestos" filas={porGrupo.presupuestos} puedeEditar={puedeEditar} onChange={setProximo} />
          <GrupoNumeracion titulo="Facturas (número interno)" filas={porGrupo.facturas} puedeEditar={puedeEditar} onChange={setProximo} />
          <GrupoNumeracion titulo="Remitos" filas={porGrupo.remitos} puedeEditar={puedeEditar} onChange={setProximo} />

          {puedeEditar && filas.length > 0 && (
            <div className="flex justify-end pt-1">
              <Button variant="primary" size="sm" onClick={guardar} loading={loading}>
                <Save size={14} /> Guardar numeración
              </Button>
            </div>
          )}
        </div>
      )}
    </Card>
  )
}

function GrupoNumeracion({
  titulo,
  filas,
  puedeEditar,
  onChange,
}: {
  titulo: string
  filas: SecuenciaNumeracionRow[]
  puedeEditar: boolean
  onChange: (clave: string, valor: string) => void
}) {
  if (filas.length === 0) return null

  return (
    <div className="border border-[#eef0f2] rounded-lg p-3 bg-[#fafbfc]">
      <p className="text-[11.5px] font-bold text-[#5b626d] uppercase mb-2">{titulo}</p>
      <div className="flex flex-col gap-2">
        {filas.map((f) => (
          <div key={f.clave} className="grid grid-cols-1 sm:grid-cols-[1fr_120px_1fr] gap-2 items-end py-2 border-b border-[#eef0f2] last:border-0">
            <div>
              <p className="text-[12.5px] font-semibold text-[#16181d]">{f.etiqueta}</p>
              <p className="text-[10.5px] text-[#9aa1ab]">Formato: {f.prefijo}{'0'.repeat(f.padding)}</p>
              {f.maxEnBd > 0 && (
                <p className="text-[10.5px] text-[#6b7280]">Último en base: {f.prefijo}{String(f.maxEnBd).padStart(f.padding, '0')}</p>
              )}
            </div>
            <Input
              label="Próximo"
              type="number"
              min={1}
              value={f.proximoNumero}
              disabled={!puedeEditar}
              onChange={(e) => onChange(f.clave, e.target.value)}
            />
            <div className="sm:text-right">
              <p className="text-[9.5px] font-semibold text-[#5b626d] uppercase">Emitirá</p>
              <p className="text-[13px] font-bold text-[#C4540A] font-mono">{f.ejemplo}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
