import { prisma } from '@/lib/prisma'
import { ApiError } from '@/lib/api-auth'
import { calcularTotales } from '@/lib/documentos'
import { datosItemsFacturaNestedCreate } from '@/lib/facturas/datos-items-factura'
import { crearConNumeroUnico, siguienteNumeroFactura } from '@/lib/sequences'
import { sincronizarVencimientosCobranza } from '@/lib/cobranzas/vencimientos'
import { resolverPlantillaIdEmision } from '@/lib/plantillas/resolver-plantilla'
import { formatPeriodo } from '@/lib/alquiler/periodo'
import type { TipoFactura } from '@prisma/client'

export async function facturarCuotasAlquiler(opts: {
  contratoId: string
  periodo?: string
  cuotaIds?: string[]
  tipo?: TipoFactura
  observaciones?: string | null
}) {
  const periodo = opts.periodo ?? formatPeriodo(new Date())

  const contrato = await prisma.contratoAlquiler.findUnique({
    where: { id: opts.contratoId },
    include: {
      cliente: { select: { id: true, nombre: true, condicionIva: true } },
      cuotas: {
        where: {
          estado: { in: ['PENDIENTE', 'VENCIDA'] },
          facturaId: null,
          ...(opts.cuotaIds?.length ? { id: { in: opts.cuotaIds } } : { periodo }),
        },
        include: {
          linea: {
            include: {
              inventarioUnidad: {
                select: {
                  numeroSerie: true,
                  inventario: { select: { nombre: true } },
                },
              },
            },
          },
        },
      },
    },
  })

  if (!contrato) throw new ApiError(404, 'Contrato no encontrado')
  if (!['ACTIVO', 'SUSPENDIDO'].includes(contrato.estado)) {
    throw new ApiError(400, 'Solo se pueden facturar contratos activos o suspendidos')
  }
  if (contrato.cuotas.length === 0) {
    throw new ApiError(400, 'No hay cuotas pendientes para facturar en el período seleccionado')
  }

  const itemsInput = contrato.cuotas.map((c) => {
    const equipo = c.linea.inventarioUnidad.inventario.nombre
    const serie = c.linea.inventarioUnidad.numeroSerie
    const ben = c.linea.beneficiarioNombre
    const partes = [`Alquiler ${equipo}`, c.periodo]
    if (serie) partes.push(`S/N ${serie}`)
    if (ben) partes.push(ben)
    return {
      descripcion: partes.join(' — '),
      cantidad: 1,
      precioUnit: c.monto,
      bonificacionPct: 0,
    }
  })

  const { itemsCalculados, subtotal, iva, total, alicuotaIvaPct } = calcularTotales(itemsInput, 0, 21)

  const emisor = await prisma.emisor.findFirst({
    where: { predeterminado: true, activo: true },
    select: { id: true, puntoVenta: true },
  })

  const plantillaId = await resolverPlantillaIdEmision('FACTURA', null)
  const fechaEmision = new Date()
  const vencimientoCuota = contrato.cuotas.reduce(
    (max, c) => (c.vencimiento > max ? c.vencimiento : max),
    contrato.cuotas[0]!.vencimiento,
  )
  const diasPlazo = Math.max(
    0,
    Math.ceil((vencimientoCuota.getTime() - fechaEmision.getTime()) / (1000 * 60 * 60 * 24)),
  )

  const obs = [
    opts.observaciones?.trim(),
    `Contrato ${contrato.numero} — período ${periodo}`,
  ].filter(Boolean).join('\n')

  const factura = await crearConNumeroUnico(
    () => siguienteNumeroFactura(opts.tipo ?? 'B'),
    (numero) =>
      prisma.$transaction(async (tx) => {
        const creada = await tx.factura.create({
          data: {
            numero,
            tipo: opts.tipo ?? 'B',
            estado: 'BORRADOR',
            subtotal,
            iva,
            total,
            moneda: 'ARS',
            bonificacionPct: 0,
            alicuotaIvaPct,
            clienteId: contrato.clienteId,
            emisorId: emisor?.id ?? null,
            plantillaId,
            concepto: 2,
            condicionPago: diasPlazo === 0 ? 'Contado' : `${diasPlazo} días`,
            observaciones: obs || null,
            puntoVenta: emisor?.puntoVenta ?? null,
            items: {
              create: datosItemsFacturaNestedCreate(itemsCalculados),
            },
          },
          include: { cliente: true, items: true },
        })

        await tx.cuotaAlquiler.updateMany({
          where: { id: { in: contrato.cuotas.map((c) => c.id) } },
          data: { facturaId: creada.id, estado: 'FACTURADA' },
        })

        await sincronizarVencimientosCobranza(creada.id, [diasPlazo], tx)

        return creada
      }),
  )

  return prisma.factura.findUnique({
    where: { id: factura.id },
    include: {
      cliente: true,
      items: true,
      vencimientos: { orderBy: { numeroCuota: 'asc' } },
    },
  })
}
