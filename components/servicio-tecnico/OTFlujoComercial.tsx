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
  Truck,
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
import { remitoListoParaEmitir, remitoPendientesEmision } from '@/lib/remitos/venta'

interface ItemRemitoResumen {
  descripcion: string
  inventarioId: string | null
  inventarioUnidadId?: string | null
  equipoId?: string | null
  numeroSerie?: string | null
  inventario?: {
    modoTrazabilidad?: string | null
    tipoArticulo?: string | null
    esSerializado?: boolean
  } | null
}

interface RemitoResumen {
  id: string
  numero: string
  estado: string
  items?: ItemRemitoResumen[]
}

interface PresupuestoVinculado {
  id: string
  numero: string
  estado: string
  total: number
  factura?: { id: string; numero: string } | null
  ordenVenta?: {
    id: string
    numero?: string
    remitos: RemitoResumen[]
  } | null
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
  { key: 'remito', label: 'Remito' },
  { key: 'factura', label: 'Facturación' },
  { key: 'finalizado', label: 'Finalizado' },
] as const

function remitoActivo(pres?: PresupuestoVinculado): RemitoResumen | undefined {
  return pres?.ordenVenta?.remitos?.[0]
}

function calcularPaso(
  pres: PresupuestoVinculado | undefined,
  factura: OTFlujoComercialProps['factura'],
  otEstado: string,
): number {
  const facturaFinal = factura ?? pres?.factura
  const remito = remitoActivo(pres)

  if (facturaFinal && otEstado === 'CERRADA') return 6
  if (remito?.estado === 'EMITIDO' && !facturaFinal) return 5
  if (facturaFinal) return 5

  if (pres && (pres.estado === 'APROBADO' || pres.estado === 'CONVERTIDO')) {
    if (otEstado !== 'CERRADA') return 3
    if (!remito || remito.estado === 'BORRADOR') return 4
    if (remito.estado === 'EMITIDO') return 5
  }

  if (!pres || pres.estado === 'BORRADOR') return 1
  if (pres.estado === 'ENVIADO') return 2
  if (pres.estado === 'RECHAZADO' || pres.estado === 'VENCIDO') return 1

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
  const remito = remitoActivo(presupuesto)
  const paso = calcularPaso(presupuesto, factura, otEstado)
  const pendientesSerie = remito?.items ? remitoPendientesEmision(remito.items) : []
  const remitoPuedeEmitirse = remito?.estado === 'BORRADOR' && remitoListoParaEmitir(remito.items ?? [])

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

  async function generarRemito() {
    if (!presupuesto) return
    try {
      if (presupuesto.estado !== 'APROBADO' && presupuesto.estado !== 'CONVERTIDO') {
        const resApr = await fetch(`/api/presupuestos/${presupuesto.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ estado: 'APROBADO' }),
        })
        const dataApr = await resApr.json().catch(() => ({}))
        if (!resApr.ok) throw new Error(mensajeErrorJson(dataApr, 'No se pudo aprobar el presupuesto'))
      }
      const res = await fetch(`/api/presupuestos/${presupuesto.id}/remito`, {
        method: 'POST',
        credentials: 'include',
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(mensajeErrorJson(data, 'No se pudo crear el remito'))
      toast.success('Remito creado — asigná las series y emitilo')
      router.push(`/remitos/${data.id}`)
    } catch (e) {
      toast.error(mensajeErrorDesconocido(e, 'No se pudo generar el remito'))
    }
  }

  async function emitirRemito() {
    if (!remito) return
    try {
      const res = await fetch(`/api/remitos-venta/${remito.id}/emitir`, {
        method: 'POST',
        credentials: 'include',
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(mensajeErrorJson(data, 'No se pudo emitir el remito'))
      toast.success('Remito emitido — ya podés facturar')
      router.refresh()
    } catch (e) {
      toast.error(mensajeErrorDesconocido(e, 'No se pudo emitir el remito'))
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
                ? 'Reparación finalizada — generar remito y facturar'
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
              Presupuestá, obtené aprobación, repará el equipo, emití el remito, facturá y cerrá la entrega.
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

        {/* Paso 6 — Finalizado */}
        {paso === 6 && facturaFinal && (
          <div className="flex flex-wrap items-center justify-between gap-3 bg-green-50 rounded-[10px] border border-green-200 px-4 py-3">
            <div>
              <p className="text-[13px] font-bold text-green-900 flex items-center gap-1.5">
                <PackageCheck size={16} /> OT finalizada — equipo listo para entrega
              </p>
              <p className="text-[12px] text-green-800 mt-0.5">
                Remito {remito?.numero ?? '—'} · Factura {facturaFinal.numero} · OT {otNumero} cerrada
              </p>
            </div>
            <Link href="/facturacion">
              <Button variant="secondary" size="sm">
                <Receipt size={14} /> Ver facturación
              </Button>
            </Link>
          </div>
        )}

        {/* Paso 5 — Facturación */}
        {paso === 5 && presupuesto && (
          <div className="flex flex-col gap-3 bg-white rounded-[10px] border border-[#E5E7EB] px-4 py-3">
            {!facturaFinal ? (
              <>
                <p className="text-[13px] text-[#3a4150]">
                  Remito {remito?.numero ?? ''} emitido. Generá la factura para cobrar al cliente.
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[12px] font-bold text-[#E8650A]">{presupuesto.numero}</span>
                  <BadgeEstadoPresupuesto estado={presupuesto.estado} />
                  <span className="text-[12px] text-[#6b7280]">{formatMonto(presupuesto.total)}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {puedeFacturar && remito && (
                    <Link href={`/facturacion/nueva?remitoId=${remito.id}&otId=${otId}&presupuestoId=${presupuesto.id}`}>
                      <Button variant="primary" size="sm">
                        <Receipt size={14} /> Generar factura
                      </Button>
                    </Link>
                  )}
                  {remito && (
                    <Link href={`/remitos/${remito.id}`}>
                      <Button variant="outline" size="sm">
                        <Truck size={14} /> Ver remito
                      </Button>
                    </Link>
                  )}
                </div>
              </>
            ) : (
              <>
                <p className="text-[13px] text-[#3a4150]">
                  Factura {facturaFinal.numero} creada.
                  {otEstado !== 'CERRADA'
                    ? ' Cerrá la OT para completar la entrega.'
                    : ' Ciclo comercial completado.'}
                </p>
                {puedeActualizarOt && otEstado !== 'CERRADA' && (
                  <Button
                    variant="dark"
                    size="sm"
                    className="w-fit"
                    onClick={() => cambiarEstadoOt('CERRADA', 'OT cerrada — entrega registrada')}
                  >
                    <PackageCheck size={14} /> Confirmar entrega y cerrar
                  </Button>
                )}
              </>
            )}
          </div>
        )}

        {/* Paso 4 — Remito */}
        {paso === 4 && presAprobado && presupuesto && (
          <div className="flex flex-col gap-3 bg-white rounded-[10px] border border-[#E5E7EB] px-4 py-3">
            <p className="text-[13px] text-[#3a4150]">
              {remito
                ? remito.estado === 'BORRADOR'
                  ? `Remito ${remito.numero} en borrador. Asigná las series y emitilo antes de facturar.`
                  : `Remito ${remito.numero} listo.`
                : 'Reparación finalizada. Generá el remito de entrega antes de facturar.'}
            </p>
            <div className="flex flex-wrap gap-2">
              {!remito && puedeFacturar && (
                <Button variant="primary" size="sm" onClick={generarRemito}>
                  <Truck size={14} /> Generar remito
                </Button>
              )}
              {remito?.estado === 'BORRADOR' && (
                <>
                  {pendientesSerie.length > 0 && (
                    <p className="text-[12px] text-amber-800 bg-amber-50 border border-amber-200 rounded-[8px] px-3 py-2">
                      Faltan series en: {pendientesSerie.slice(0, 3).join(', ')}
                      {pendientesSerie.length > 3 ? ` (+${pendientesSerie.length - 3} más)` : ''}.
                      Asigná las series en el editor del remito antes de emitir.
                    </p>
                  )}
                  <Link href={`/remitos/${remito.id}`}>
                    <Button variant="primary" size="sm">
                      <Truck size={14} /> Asignar series
                    </Button>
                  </Link>
                  {puedeFacturar && remitoPuedeEmitirse && (
                    <Button variant="secondary" size="sm" onClick={emitirRemito}>
                      <CheckCircle size={14} /> Emitir remito
                    </Button>
                  )}
                </>
              )}
              <Link href={`/presupuestos/${presupuesto.id}`}>
                <Button variant="outline" size="sm">Ver presupuesto</Button>
              </Link>
            </div>
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
                    cambiarEstadoOt('CERRADA', 'Reparación finalizada — generá el remito')
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
