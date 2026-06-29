'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { formatFecha, formatMonto } from '@/lib/utils'
import { useCan } from '@/components/auth/useCan'
import { mensajeErrorDesconocido, mensajeErrorRespuesta } from '@/lib/errores'

type CronogramaItem =
  | {
      tipo: 'FACTURA'
      id: string
      numeroCuota: number
      diasDesdeEmision: number
      fechaVencimiento: string
      monto: number
      estadoVencimiento: string
      factura: {
        id: string
        numero: string
        total: number
        estado: string
        condicionPago: string | null
        clienteId: string
        clienteNombre: string
      }
    }
  | {
      tipo: 'ALQUILER'
      id: string
      contratoId: string
      contratoNumero: string
      periodo: string
      fechaVencimiento: string
      monto: number
      cantidadCuotas: number
      estado: string
      clienteId: string
      clienteNombre: string
    }

type FiltroOrigen = 'TODOS' | 'FACTURA' | 'ALQUILER'

export function VencimientosProximos() {
  const puedeFacturarAlquiler = useCan('alquiler.bill')
  const [items, setItems] = useState<CronogramaItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState<FiltroOrigen>('TODOS')
  const [facturando, setFacturando] = useState<string | null>(null)

  const cargar = useCallback(() => {
    setLoading(true)
    fetch(`/api/cobranzas/vencimientos?dias=120&origen=${filtro}`)
      .then((r) => r.json())
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }, [filtro])

  useEffect(() => {
    cargar()
  }, [cargar])

  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)

  function vencido(fechaVencimiento: string) {
    const due = new Date(fechaVencimiento)
    due.setHours(0, 0, 0, 0)
    return due.getTime() <= hoy.getTime()
  }

  function badgeFactura(item: Extract<CronogramaItem, { tipo: 'FACTURA' }>) {
    const { factura } = item
    if (factura.estado === 'BORRADOR') {
      return { text: 'Pendiente AFIP', className: 'text-blue-700 bg-blue-50' }
    }
    if (factura.estado === 'VENCIDA' || vencido(item.fechaVencimiento)) {
      return { text: 'Vencida', className: 'text-red-700 bg-red-50' }
    }
    if (['EMITIDA', 'PENDIENTE'].includes(factura.estado)) {
      return { text: 'Por cobrar', className: 'text-amber-700 bg-amber-50' }
    }
    return { text: factura.estado, className: 'text-gray-600 bg-gray-50' }
  }

  function badgeAlquiler(item: Extract<CronogramaItem, { tipo: 'ALQUILER' }>) {
    if (item.estado === 'VENCIDA' || vencido(item.fechaVencimiento)) {
      return { text: 'Sin facturar · vencida', className: 'text-red-700 bg-red-50' }
    }
    return { text: 'Sin facturar', className: 'text-purple-700 bg-purple-50' }
  }

  async function facturarAlquiler(item: Extract<CronogramaItem, { tipo: 'ALQUILER' }>) {
    setFacturando(item.id)
    try {
      const res = await fetch(`/api/alquiler/contratos/${item.contratoId}/facturar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ periodo: item.periodo }),
      })
      if (!res.ok) throw new Error(await mensajeErrorRespuesta(res, 'No se pudo facturar'))
      const factura = await res.json()
      toast.success(`Factura ${factura.numero} creada — emití AFIP y registrá el cobro abajo`, {
        action: puedeFacturarAlquiler
          ? {
              label: 'Ir a ACTA',
              onClick: () => {
                window.location.href = `/alquiler/contratos/${item.contratoId}`
              },
            }
          : undefined,
        description: 'Podés generar ACTAs de entrega desde el detalle del contrato.',
      })
      cargar()
    } catch (e) {
      toast.error(mensajeErrorDesconocido(e, 'Error al facturar alquiler'))
    } finally {
      setFacturando(null)
    }
  }

  function acciones(item: CronogramaItem) {
    if (item.tipo === 'ALQUILER') {
      return (
        <div className="flex flex-wrap justify-end gap-1">
          {puedeFacturarAlquiler && (
            <Button
              variant="primary"
              size="sm"
              disabled={facturando === item.id}
              onClick={() => facturarAlquiler(item)}
            >
              {facturando === item.id ? '…' : 'Facturar'}
            </Button>
          )}
          <Link href={`/alquiler/contratos/${item.contratoId}`}>
            <Button variant="outline" size="sm">Contrato</Button>
          </Link>
        </div>
      )
    }

    const { factura } = item
    const puedeCobrar = ['EMITIDA', 'VENCIDA', 'PENDIENTE'].includes(factura.estado)

    return (
      <div className="flex flex-wrap justify-end gap-1">
        {factura.estado === 'BORRADOR' && (
          <Link href="/facturacion">
            <Button variant="primary" size="sm">Emitir AFIP</Button>
          </Link>
        )}
        {puedeCobrar && (
          <Link href={`/cobranzas?cliente=${factura.clienteId}#registrar-cobranza`}>
            <Button variant="primary" size="sm">Cobrar</Button>
          </Link>
        )}
      </div>
    )
  }

  function referencia(item: CronogramaItem) {
    if (item.tipo === 'ALQUILER') {
      return (
        <div>
          <span className="font-bold text-[#7c3aed]">{item.contratoNumero}</span>
          <span className="text-[#9aa1ab]"> · Alquiler {item.periodo}</span>
          {item.cantidadCuotas > 1 && (
            <div className="text-[10px] text-[#9aa1ab]">{item.cantidadCuotas} líneas</div>
          )}
        </div>
      )
    }
    return (
      <span className="font-bold text-[#E8650A]">{item.factura.numero}</span>
    )
  }

  function detalle(item: CronogramaItem) {
    if (item.tipo === 'ALQUILER') return `Cuota mensual · ${item.periodo}`
    return `${item.numeroCuota} · ${item.factura.condicionPago ?? `día ${item.diasDesdeEmision}`}`
  }

  return (
    <Card padding={false} className="max-w-6xl">
      <div className="px-5 py-3 border-b border-[#eef0f2] flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-[13px] font-bold text-[#1f242c]">Cronograma de cobranzas</h3>
          <p className="text-[11px] text-[#9aa1ab] mt-0.5">
            Facturas emitidas, borradores pendientes de AFIP y cuotas de alquiler sin facturar.
          </p>
        </div>
        <select
          value={filtro}
          onChange={(e) => setFiltro(e.target.value as FiltroOrigen)}
          className="border border-[#e4e7eb] rounded-[9px] px-3 py-1.5 text-[12px] bg-white"
        >
          <option value="TODOS">Todo</option>
          <option value="FACTURA">Solo facturas</option>
          <option value="ALQUILER">Solo alquiler</option>
        </select>
      </div>
      {loading ? (
        <p className="p-5 text-[12.5px] text-[#9aa1ab]">Cargando…</p>
      ) : items.length === 0 ? (
        <p className="p-5 text-[12.5px] text-[#9aa1ab]">Sin vencimientos en el período</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px]">
            <thead>
              <tr>
                {['Referencia', 'Cliente', 'Detalle', 'Vencimiento', 'Monto', 'Estado', 'Acción'].map((h, i) => (
                  <th
                    key={h}
                    className={`px-4 py-2.5 text-[10px] font-bold text-[#8a909a] uppercase border-b whitespace-nowrap ${i >= 3 ? 'text-right' : 'text-left'}`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => {
                const badge = item.tipo === 'ALQUILER' ? badgeAlquiler(item) : badgeFactura(item)
                return (
                  <tr key={`${item.tipo}-${item.id}`} className={i % 2 === 0 ? 'bg-white' : 'bg-[#fafbfc]'}>
                    <td className="px-4 py-3 text-[12.5px] border-b">{referencia(item)}</td>
                    <td className="px-4 py-3 text-[12.5px] text-[#3a4150] border-b">
                      {item.tipo === 'ALQUILER' ? item.clienteNombre : item.factura.clienteNombre}
                    </td>
                    <td className="px-4 py-3 text-[12.5px] text-[#6b7280] border-b">{detalle(item)}</td>
                    <td className="px-4 py-3 text-[12.5px] text-right text-[#6b7280] border-b whitespace-nowrap">
                      {formatFecha(item.fechaVencimiento)}
                    </td>
                    <td className="px-4 py-3 text-[12.5px] font-bold text-right border-b whitespace-nowrap">
                      {formatMonto(item.monto)}
                    </td>
                    <td className="px-4 py-3 text-right border-b whitespace-nowrap">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${badge.className}`}>
                        {badge.text}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right border-b">{acciones(item)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}
