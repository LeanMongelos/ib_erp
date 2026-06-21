'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatAlicuotaLabel } from '@/lib/iva/format'
import { mensajeErrorDesconocido, mensajeErrorJson, mensajeErrorRespuesta } from '@/lib/errores'

interface AlicuotaRow {
  id: string
  codigo: string
  nombre: string
  porcentaje: number
  activo: boolean
  esPredeterminada: boolean
}

export function AlicuotasIvaManager({ inicial }: { inicial: AlicuotaRow[] }) {
  const router = useRouter()
  const [alicuotas, setAlicuotas] = useState(inicial)
  const [loading, setLoading] = useState('')
  const [nueva, setNueva] = useState({ codigo: '', nombre: '', porcentaje: '' })

  async function marcarPredeterminada(id: string) {
    setLoading(id)
    try {
      const res = await fetch('/api/alicuotas-iva', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, esPredeterminada: true }),
      })
      if (!res.ok) throw new Error(await mensajeErrorRespuesta(res, 'No se pudo actualizar la alícuota predeterminada'))
      setAlicuotas((prev) => prev.map((a) => ({ ...a, esPredeterminada: a.id === id })))
      toast.success('Alícuota predeterminada actualizada')
      router.refresh()
    } catch (e) {
      toast.error(mensajeErrorDesconocido(e, 'No se pudo actualizar la alícuota predeterminada'))
    } finally {
      setLoading('')
    }
  }

  async function crear() {
    if (!nueva.codigo || !nueva.nombre || !nueva.porcentaje) {
      toast.error('Completá código, nombre y porcentaje')
      return
    }
    setLoading('crear')
    try {
      const res = await fetch('/api/alicuotas-iva', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          codigo: nueva.codigo,
          nombre: nueva.nombre,
          porcentaje: Number(nueva.porcentaje),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(mensajeErrorJson(data, 'No se pudo crear la alícuota de IVA'))
      setAlicuotas((prev) => [...prev, data].sort((a, b) => a.porcentaje - b.porcentaje))
      setNueva({ codigo: '', nombre: '', porcentaje: '' })
      toast.success('Alícuota creada')
      router.refresh()
    } catch (e: unknown) {
      toast.error(mensajeErrorDesconocido(e, 'No se pudo crear la alícuota de IVA'))
    } finally {
      setLoading('')
    }
  }

  return (
    <div className="max-w-3xl flex flex-col gap-4">
      <Card>
        <h3 className="text-[13.5px] font-bold text-[#1f242c] mb-2">Alícuotas de IVA</h3>
        <p className="text-[12px] text-[#6b7280] mb-4">
          Definí los porcentajes disponibles al facturar y presupuestar. Se aplican por cliente,
          por comprobante o por ítem según el caso.
        </p>
        <table className="w-full">
          <thead>
            <tr>
              {['Código', 'Nombre', 'Porcentaje', 'Default', ''].map((h, i) => (
                <th
                  key={h || 'acc'}
                  className={`pb-2 text-[10px] font-bold text-[#8a909a] uppercase border-b ${i === 2 || i === 3 ? 'text-right' : 'text-left'}`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {alicuotas.map((a) => (
              <tr key={a.id}>
                <td className="py-3 text-[12px] font-mono text-[#6b7280] border-b border-[#f4f5f7]">{a.codigo}</td>
                <td className="py-3 text-[12.5px] font-semibold border-b border-[#f4f5f7]">{a.nombre}</td>
                <td className="py-3 text-[12.5px] font-bold text-right border-b border-[#f4f5f7]">
                  {formatAlicuotaLabel(a.porcentaje)}
                </td>
                <td className="py-3 text-right border-b border-[#f4f5f7]">
                  {a.esPredeterminada ? (
                    <span className="text-[10px] font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded">Default</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => marcarPredeterminada(a.id)}
                      disabled={loading === a.id}
                      className="text-[11px] text-[#E8650A] font-semibold hover:underline disabled:opacity-50"
                    >
                      Usar por defecto
                    </button>
                  )}
                </td>
                <td className="py-3 border-b border-[#f4f5f7]" />
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card>
        <h3 className="text-[13px] font-bold mb-3">Agregar alícuota personalizada</h3>
        <div className="grid grid-cols-3 gap-3">
          <Input label="Código" value={nueva.codigo} onChange={(e) => setNueva({ ...nueva, codigo: e.target.value.toUpperCase() })} placeholder="IVA_5" />
          <Input label="Nombre" value={nueva.nombre} onChange={(e) => setNueva({ ...nueva, nombre: e.target.value })} placeholder="IVA Especial" />
          <Input label="Porcentaje" type="number" min={0} max={100} step={0.1} value={nueva.porcentaje} onChange={(e) => setNueva({ ...nueva, porcentaje: e.target.value })} />
        </div>
        <div className="mt-4 flex justify-end">
          <Button onClick={crear} loading={loading === 'crear'}>Agregar alícuota</Button>
        </div>
      </Card>

      <Card>
        <h3 className="text-[12px] font-bold text-[#8a909a] uppercase mb-2">Cómo se aplica</h3>
        <ul className="text-[12px] text-[#6b7280] flex flex-col gap-1.5 list-disc pl-4">
          <li><strong>Configuración → Fiscal</strong>: catálogo de alícuotas (21%, 10,5%, 27%, 0%, custom).</li>
          <li><strong>Cliente</strong>: alícuota por defecto según condición IVA o manual en la ficha.</li>
          <li><strong>Factura / Presupuesto</strong>: selector general + columna IVA por ítem si mezclás tasas.</li>
        </ul>
      </Card>
    </div>
  )
}
