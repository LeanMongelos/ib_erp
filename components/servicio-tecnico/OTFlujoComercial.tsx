'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  FileText,
  Send,
  CheckCircle,
  Receipt,
  ArrowRight,
  Wrench,
  PackageCheck,
} from 'lucide-react'
import { toast } from 'sonner'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { BadgeEstadoPresupuesto, BadgeEstadoOT } from '@/components/ui/badge'
import type { EstadoOT } from '@/types'
import { formatMonto } from '@/lib/utils'
import { useCan } from '@/components/auth/useCan'
import { mensajeErrorDesconocido, mensajeErrorJson, mensajeErrorRespuesta } from '@/lib/errores'
import { validarTransicionOT } from '@/lib/ots/transiciones-client'

interface PresupuestoVinculado {
  id: string
  numero: string
  estado: string
  total: number
  factura?: { id: string; numero: string } | null
}

interface OTFlujoComercialProps {
  otId: string
  otNumero: string
  otEstado: string
  presupuestos: PresupuestoVinculado[]
  factura?: { id: string; numero: string } | null
}

const PASOS = [
  { key: 'presupuesto', label: 'Presupuesto' },
  { key: 'aprobacion', label: 'Aprobación cliente' },
  { key: 'desarrollo', label: 'En desarrollo' },
  { key: 'factura', label: 'Facturación' },
  { key: 'finalizado', label: 'Finalizado' },
] as const

function calcularPaso(
  pres: PresupuestoVinculado | undefined,
  factura: OTFlujoComercialProps['factura'],
  otEstado: string,
): number {
  const facturaFinal = factura ?? pres?.factura

  if (facturaFinal && otEstado === 'CERRADA') return 5
  if (facturaFinal) return 4
  if (!pres || pres.estado === 'BORRADOR') return 1
  if (pres.estado === 'ENVIADO') return 2
  if (pres.estado === 'RECHAZADO' || pres.estado === 'VENCIDO') return 1

  if (pres.estado === 'APROBADO' || pres.estado === 'CONVERTIDO') {
    if (otEstado === 'CERRADA') return 4
    return 3
  }

  return 1
}

export function OTFlujoComercial({
  otId,
  otNumero,
  otEstado,
  presupuestos,
  factura,
}: OTFlujoComercialProps) {
  const router = useRouter()
  const puedeCrearPresupuesto = useCan('presupuestos.create')
  const puedeAprobar = useCan('presupuestos.approve')
  const puedeFacturar = useCan('facturas.create')
  const puedeActualizarOt = useCan('servicio.update')

  const presupuesto = presupuestos[0]
  const facturaFinal = factura ?? presupuesto?.factura
  const paso = calcularPaso(presupuesto, factura, otEstado)

  async function enviarPresupuesto() {
    if (!presupuesto) return
    try {
      const res = await fetch(`/api/presupuestos/${presupuesto.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: 'ENVIADO' }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(mensajeErrorJson(data, 'No se pudo enviar el presupuesto'))
      toast.success('Presupuesto enviado al cliente')
      router.refresh()
    } catch (e) {
      toast.error(mensajeErrorDesconocido(e, 'No se pudo enviar el presupuesto'))
    }
  }

  async function aprobarPresupuesto() {
    if (!presupuesto) return
    try {
      const res = await fetch(`/api/presupuestos/${presupuesto.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: 'APROBADO' }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(mensajeErrorJson(data, 'No se pudo aprobar el presupuesto'))
      toast.success('Presupuesto aprobado — podés iniciar la reparación')
      router.refresh()
    } catch (e) {
      toast.error(mensajeErrorDesconocido(e, 'No se pudo aprobar el presupuesto'))
    }
  }

  async function cambiarEstadoOt(nuevoEstado: string, mensaje: string) {
    const err = validarTransicionOT(otEstado as EstadoOT, nuevoEstado as EstadoOT)
    if (err) {
      toast.error(err)
      return
    }
    try {
      const res = await fetch(`/api/ots/${otId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          estado: nuevoEstado,
          nota:
            nuevoEstado === 'EN_PROCESO'
              ? 'Reparación iniciada tras aprobación del presupuesto'
              : nuevoEstado === 'CERRADA'
                ? 'Reparación finalizada — listo para facturar y entregar'
                : `Estado cambiado a ${nuevoEstado}`,
        }),
      })
      if (!res.ok) throw new Error(await mensajeErrorRespuesta(res, 'No se pudo actualizar la OT'))
      toast.success(mensaje)
      router.refresh()
    } catch (e) {
      toast.error(mensajeErrorDesconocido(e, 'No se pudo actualizar la OT'))
    }
  }

  function irAFacturar() {
    if (!presupuesto) return
    router.push(`/facturacion/nueva?presupuestoId=${presupuesto.id}&otId=${otId}`)
  }

  const presAprobado =
    presupuesto &&
    (presupuesto.estado === 'APROBADO' || presupuesto.estado === 'CONVERTIDO')

  return (
    <Card className="bg-[#FFFBEB] border-[#FDE68A]">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-[11px] font-bold text-[#92400E] tracking-[0.6px] uppercase">Flujo comercial</p>
            <p className="text-[13px] text-[#78350F] mt-1">
              Presupuestá, obtené aprobación, repará el equipo, facturá para cobrar y cerrá la entrega.
            </p>
          </div>
          <BadgeEstadoOT estado={otEstado as EstadoOT} />
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {PASOS.map((p, i) => {
            const n = i + 1
            const done = paso > n
            const active = paso === n
            return (
              <div key={p.key} className="flex items-center gap-1.5">
                <span
                  className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10.5px] font-bold whitespace-nowrap ${
                    done
                      ? 'bg-green-100 text-green-800'
                      : active
                        ? 'bg-[#E8650A] text-white'
                        : 'bg-white text-[#9CA3AF] border border-[#E5E7EB]'
                  }`}
                >
                  {done ? <CheckCircle size={11} /> : null}
                  {n}. {p.label}
                </span>
                {i < PASOS.length - 1 && <ArrowRight size={12} className="text-[#D1D5DB] shrink-0" />}
              </div>
            )
          })}
        </div>

        {/* Paso 5 — Finalizado */}
        {paso === 5 && facturaFinal && (
          <div className="flex flex-wrap items-center justify-between gap-3 bg-green-50 rounded-[10px] border border-green-200 px-4 py-3">
            <div>
              <p className="text-[13px] font-bold text-green-900 flex items-center gap-1.5">
                <PackageCheck size={16} /> OT finalizada — equipo listo para entrega
              </p>
              <p className="text-[12px] text-green-800 mt-0.5">
                Factura {facturaFinal.numero} emitida · OT {otNumero} cerrada
              </p>
            </div>
            <Link href="/facturacion">
              <Button variant="secondary" size="sm">
                <Receipt size={14} /> Ver facturación
              </Button>
            </Link>
          </div>
        )}

        {/* Paso 4 — Facturación */}
        {paso === 4 && !facturaFinal && presupuesto && (
          <div className="flex flex-col gap-3 bg-white rounded-[10px] border border-[#E5E7EB] px-4 py-3">
            <p className="text-[13px] text-[#3a4150]">
              Reparación finalizada. Generá la factura para cobrar al cliente.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[12px] font-bold text-[#E8650A]">{presupuesto.numero}</span>
              <BadgeEstadoPresupuesto estado={presupuesto.estado} />
              <span className="text-[12px] text-[#6b7280]">{formatMonto(presupuesto.total)}</span>
            </div>
            {puedeFacturar && (
              <Button variant="primary" size="sm" className="w-fit" onClick={irAFacturar}>
                <Receipt size={14} /> Generar factura
              </Button>
            )}
          </div>
        )}

        {paso === 4 && facturaFinal && otEstado !== 'CERRADA' && (
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white rounded-[10px] border border-[#E5E7EB] px-4 py-3">
            <p className="text-[13px] text-[#3a4150]">
              Factura {facturaFinal.numero} creada. Cerrá la OT para completar la entrega.
            </p>
            {puedeActualizarOt && otEstado !== 'CERRADA' && (
              <Button
                variant="dark"
                size="sm"
                onClick={() => cambiarEstadoOt('CERRADA', 'OT cerrada — entrega registrada')}
              >
                <PackageCheck size={14} /> Confirmar entrega y cerrar
              </Button>
            )}
          </div>
        )}

        {/* Paso 3 — En desarrollo */}
        {paso === 3 && presAprobado && (
          <div className="flex flex-col gap-3 bg-white rounded-[10px] border border-[#E5E7EB] px-4 py-3">
            <p className="text-[13px] text-[#3a4150]">
              {otEstado === 'EN_PROCESO'
                ? 'Reparación en curso. Completá el diagnóstico y repuestos; cuando termines, marcá la reparación como finalizada.'
                : 'Presupuesto aprobado. Iniciá la reparación del equipo.'}
            </p>
            <div className="flex flex-wrap gap-2">
              {otEstado === 'ABIERTA' && puedeActualizarOt && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => cambiarEstadoOt('EN_PROCESO', 'Reparación iniciada')}
                >
                  <Wrench size={14} /> Iniciar reparación
                </Button>
              )}
              {otEstado === 'EN_PROCESO' && puedeActualizarOt && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    cambiarEstadoOt('CERRADA', 'Reparación finalizada — podés facturar')
                  }
                >
                  <CheckCircle size={14} /> Reparación finalizada
                </Button>
              )}
              <Link href={`/presupuestos/${presupuesto!.id}`}>
                <Button variant="outline" size="sm">Ver presupuesto</Button>
              </Link>
            </div>
          </div>
        )}

        {/* Paso 2 — Aprobación */}
        {paso === 2 && presupuesto && (
          <div className="flex flex-col gap-3 bg-white rounded-[10px] border border-[#E5E7EB] px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Link
                  href={`/presupuestos/${presupuesto.id}`}
                  className="text-[13px] font-bold text-[#E8650A] hover:underline"
                >
                  {presupuesto.numero}
                </Link>
                <BadgeEstadoPresupuesto estado={presupuesto.estado} />
                <span className="text-[12px] text-[#6b7280]">{formatMonto(presupuesto.total)}</span>
              </div>
            </div>
            <p className="text-[11.5px] text-[#6b7280]">
              Esperando respuesta del cliente. Cuando apruebe el presupuesto, continuá con la reparación.
            </p>
            {puedeAprobar && (
              <Button variant="secondary" size="sm" className="w-fit" onClick={aprobarPresupuesto}>
                <CheckCircle size={14} /> Cliente aprobó
              </Button>
            )}
          </div>
        )}

        {/* Paso 1 — Presupuesto */}
        {paso === 1 && (
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white rounded-[10px] border border-[#E5E7EB] px-4 py-3">
            {presupuesto ? (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <Link
                    href={`/presupuestos/${presupuesto.id}`}
                    className="text-[13px] font-bold text-[#E8650A] hover:underline"
                  >
                    {presupuesto.numero}
                  </Link>
                  <BadgeEstadoPresupuesto estado={presupuesto.estado} />
                </div>
                {presupuesto.estado === 'BORRADOR' && puedeCrearPresupuesto && (
                  <Button variant="secondary" size="sm" className="w-fit" onClick={enviarPresupuesto}>
                    <Send size={14} /> Enviar al cliente
                  </Button>
                )}
              </div>
            ) : (
              <>
                <p className="text-[13px] text-[#3a4150]">Todavía no hay presupuesto vinculado a esta OT.</p>
                {puedeCrearPresupuesto && (
                  <Link href={`/presupuestos/nuevo?otId=${otId}`}>
                    <Button variant="primary" size="sm">
                      <FileText size={14} /> Crear presupuesto
                    </Button>
                  </Link>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </Card>
  )
}
