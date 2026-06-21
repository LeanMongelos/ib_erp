import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireAuth, requirePermission, handleApiError, ApiError } from '@/lib/api-auth'
import { otUpdateSchema } from '@/lib/validation'
import { plain } from '@/lib/serialize'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth()
    const { id } = await params

    const ot = await prisma.ordenTrabajo.findUnique({
      where: { id },
      include: {
        cliente:  true,
        equipo:   true,
        tecnico:  true,
        repuestos: {
          include: {
            inventario: { select: { id: true, nombre: true, sku: true } },
          },
        },
        historial: { orderBy: { creadoEn: 'asc' } },
        factura:  true,
        presupuestos: {
          orderBy: { creadoEn: 'desc' },
          include: { factura: { select: { id: true, numero: true } } },
        },
      },
    })
    if (!ot) return NextResponse.json({ error: 'Orden de trabajo no encontrada' }, { status: 404 })
    return NextResponse.json(plain(ot))
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requirePermission('servicio.update')
    const { id } = await params

    const body = await req.json()
    const { estado, nota, diagnostico, tecnicoId, repuestos } = otUpdateSchema.parse(body)

    const updateData: Prisma.OrdenTrabajoUpdateInput = {}
    if (diagnostico !== undefined) updateData.diagnostico = diagnostico
    if (tecnicoId !== undefined) {
      updateData.tecnico = tecnicoId ? { connect: { id: tecnicoId } } : { disconnect: true }
    }
    if (estado !== undefined) {
      updateData.estado = estado
      // Al cerrar registramos la fecha; al reabrir la limpiamos
      updateData.fechaCierre = estado === 'CERRADA' ? new Date() : null
      updateData.historial = {
        create: { estado, nota: nota ?? `Estado cambiado a ${estado}` },
      }
    }

    const otActual = await prisma.ordenTrabajo.findUnique({
      where: { id },
      select: { estado: true, numero: true, tipo: true, equipoId: true, clienteId: true },
    })
    if (!otActual) throw new ApiError(404, 'Orden de trabajo no encontrada')

    if (repuestos !== undefined) {
      await prisma.repuestoOT.deleteMany({ where: { otId: id } })
      if (repuestos.length > 0) {
        await prisma.repuestoOT.createMany({
          data: repuestos.map((r) => ({
            descripcion: r.descripcion,
            cantidad: r.cantidad,
            precioUnit: r.precioUnit,
            inventarioId: r.inventarioId ?? null,
            otId: id,
          })),
        })
      }
    }

    const ot = await prisma.ordenTrabajo.update({
      where: { id },
      data: updateData,
      include: {
        equipo: { select: { id: true, numeroSerie: true } },
        repuestos: true,
      },
    })

    if (estado === 'CERRADA' && otActual.estado !== 'CERRADA') {
      const { registrarMovimientoStock } = await import('@/lib/inventario')
      for (const r of ot.repuestos) {
        if (!r.inventarioId) continue
        const item = await prisma.inventario.findUnique({ where: { id: r.inventarioId } })
        if (!item) continue
        if (item.stock < r.cantidad) {
          throw new ApiError(400, `Stock insuficiente para «${item.nombre}» (disponible: ${item.stock})`)
        }
        await registrarMovimientoStock({
          inventarioId: r.inventarioId,
          tipo: 'SALIDA',
          cantidad: r.cantidad,
          motivo: `Repuesto OT ${ot.numero}`,
          referencia: `ot:${id}:cierre`,
          usuarioId: actor.id,
        })
      }
    }

    if (estado === 'CERRADA' && ot.equipoId) {
      const { registrarEntradaHistoria } = await import('@/lib/equipos/historia-clinica')
      await registrarEntradaHistoria(ot.equipoId, {
        tipo: 'OT',
        titulo: `OT ${ot.numero} cerrada`,
        contenido: diagnostico ?? nota ?? null,
        referenciaId: ot.id,
        usuarioId: actor.id,
      })
    }

    if (estado !== undefined && otActual) {
      const { sincronizarTrackingOt } = await import('@/lib/tracking-automation')
      await sincronizarTrackingOt({
        otId: id,
        numero: otActual.numero,
        tipo: otActual.tipo,
        estadoAnterior: otActual.estado,
        estadoNuevo: estado ?? otActual.estado,
        equipoId: ot.equipoId,
        clienteId: otActual.clienteId,
        usuarioId: actor.id,
        nota: nota ?? diagnostico ?? null,
      }).catch(() => null)
    }

    return NextResponse.json(ot)
  } catch (error) {
    return handleApiError(error)
  }
}
