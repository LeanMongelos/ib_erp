import { Header } from '@/components/layout/Header'
import { NuevaFacturaForm } from '@/components/facturacion/NuevaFacturaForm'
import { prisma } from '@/lib/prisma'
import { plain } from '@/lib/serialize'
import { redirect } from 'next/navigation'
import {
  ensureClienteEventual,
  ordenarClientesConEventual,
} from '@/lib/clientes/eventual'
import { requirePagePermission } from '@/lib/page-guard'
import { obtenerPlantillaPredeterminadaResumen } from '@/lib/plantillas/resolver-plantilla'

async function getData(otId?: string, presupuestoId?: string, remitoId?: string) {
  const clienteEventual = await ensureClienteEventual()

  let remitoPrefill: Awaited<ReturnType<typeof import('@/lib/remitos/venta').itemsFacturaDesdeRemito>> | null = null
  if (remitoId) {
    const { itemsFacturaDesdeRemito } = await import('@/lib/remitos/venta')
    remitoPrefill = await itemsFacturaDesdeRemito(remitoId)
    presupuestoId = remitoPrefill.presupuestoId
  }

  const [clientesRaw, emisores, ot, presupuesto] = await Promise.all([
    prisma.cliente.findMany({
      where: { activo: true },
      select: {
        id: true,
        nombre: true,
        condicionIva: true,
        alicuotaIva: { select: { porcentaje: true } },
      },
    }),
    prisma.emisor.findMany({
      where: { activo: true },
      select: {
        id: true,
        razonSocial: true,
        predeterminado: true,
        ambiente: true,
        certificadoPath: true,
        clavePrivadaPath: true,
      },
    }),
    otId
      ? prisma.ordenTrabajo.findUnique({
          where: { id: otId },
          include: { cliente: true, repuestos: true },
        })
      : null,
    presupuestoId
      ? prisma.presupuesto.findUnique({
          where: { id: presupuestoId },
          include: {
            cliente: { select: { id: true, nombre: true } },
            items: {
              include: {
                inventario: {
                  select: {
                    id: true,
                    tipoArticulo: true,
                    esSerializado: true,
                    requierePreventivo: true,
                    intervaloPreventivoDias: true,
                  },
                },
              },
            },
            factura: { select: { id: true, numero: true } },
            ot: { select: { id: true, numero: true } },
          },
        })
      : null,
  ])

  const clientes = ordenarClientesConEventual(clientesRaw, clienteEventual.id)

  return { clientes, emisores, ot, presupuesto, remitoPrefill }
}

export default async function NuevaFacturaPage({
  searchParams,
}: {
  searchParams: Promise<{ otId?: string; presupuestoId?: string; remitoId?: string }>
}) {
  await requirePagePermission('facturas.create')
  const params = await searchParams
  let { otId, presupuestoId, remitoId } = params

  if (remitoId && !presupuestoId) {
    const { itemsFacturaDesdeRemito } = await import('@/lib/remitos/venta')
    const r = await itemsFacturaDesdeRemito(remitoId).catch(() => null)
    if (r) presupuestoId = r.presupuestoId
  }

  if (presupuestoId && !otId) {
    const pres = await prisma.presupuesto.findUnique({
      where: { id: presupuestoId },
      select: { otId: true },
    })
    if (pres?.otId) otId = pres.otId
  }

  const { clientes, emisores, ot, presupuesto, remitoPrefill } = await getData(otId, presupuestoId, remitoId)
  const plantillaFactura = await obtenerPlantillaPredeterminadaResumen('FACTURA')

  if (remitoId && !remitoPrefill) redirect('/facturacion')

  if (presupuestoId) {
    if (!presupuesto) redirect('/presupuestos')
    if (presupuesto.factura) redirect('/facturacion')
    if (presupuesto.estado !== 'APROBADO') {
      redirect(`/presupuestos/${presupuestoId}`)
    }
    if (!remitoId) {
      const { mensajeFacturaRequiereRemito, remitoEmitidoPresupuesto } = await import(
        '@/lib/facturas/validar-flujo-remito'
      )
      const msg = await mensajeFacturaRequiereRemito({ presupuestoId })
      if (msg) {
        const emitido = await remitoEmitidoPresupuesto(presupuestoId)
        if (emitido) {
          redirect(
            `/facturacion/nueva?remitoId=${emitido.id}&presupuestoId=${presupuestoId}${otId ? `&otId=${otId}` : ''}`,
          )
        }
        redirect(`/presupuestos/${presupuestoId}`)
      }
    }
  }

  if (otId && !presupuestoId) {
    const facturaOt = await prisma.factura.findUnique({ where: { otId } })
    if (facturaOt) redirect(`/servicio-tecnico/${otId}`)
  }

  const subtitle = remitoPrefill
    ? `Desde remito · presupuesto ${presupuesto?.numero ?? ''}`
    : presupuesto
    ? `Desde presupuesto ${presupuesto.numero}${ot ? ` · OT ${ot.numero}` : ''} · ${presupuesto.cliente.nombre}`
    : ot
      ? `Desde OT · ${ot.numero ?? ''}`
      : 'Facturación · Nuevo comprobante'

  return (
    <>
      <Header title="Nueva Factura" subtitle={subtitle} />
      <div className="flex-1 overflow-y-auto bg-[#F4F6F9] p-6">
        <NuevaFacturaForm
          clientes={plain(clientes)}
          emisores={plain(emisores)}
          otPrefill={ot ? plain(ot) : null}
          presupuestoPrefill={presupuesto ? plain(presupuesto) : null}
          remitoPrefill={remitoPrefill ? plain(remitoPrefill) : null}
          plantillaFactura={plain(plantillaFactura)}
        />
      </div>
    </>
  )
}
