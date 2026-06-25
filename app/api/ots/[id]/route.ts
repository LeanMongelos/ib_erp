import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireAuth, requirePermission, handleApiError, ApiError } from '@/lib/api-auth'
import { tienePermiso } from '@/lib/rbac'
import { otUpdateSchema } from '@/lib/validation'
import { plain } from '@/lib/serialize'
import type { EstadoOT } from '@/types'
import { validarRepuestosOTCliente } from '@/lib/ots/repuestos-ot-client'
import { aplicarPreciosRepuestosOT, validarStockRepuestosOT } from '@/lib/ots/repuestos-ot'
import { registrarMovimientoStock } from '@/lib/inventario'
import { validarTransicionOT } from '@/lib/ots/transiciones'
import {
  mergeChecklistIntoDiagnostico,
  parseChecklistFromDiagnostico,
} from '@/lib/ots/checklist-solucion'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission('servicio.read')
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
    const { id } = await params
    const body = await req.json()
    const { estado, nota, diagnostico, checklistSolucion, tecnicoId, repuestos, crearPlanPreventivo } = otUpdateSchema.parse(body)

    const otActual = await prisma.ordenTrabajo.findUnique({
      where: { id },
      select: { estado: true, numero: true, tipo: true, equipoId: true, clienteId: true, tecnicoId: true, diagnostico: true },
    })
    if (!otActual) throw new ApiError(404, 'Orden de trabajo no encontrada')

    if (estado !== undefined) {
      const errTrans = validarTransicionOT(otActual.estado as EstadoOT, estado)
      if (errTrans) throw new ApiError(400, errTrans)
    }

    const cerrando = estado === 'CERRADA' && otActual.estado !== 'CERRADA'

    const actor = await requireAuth()
    if (!tienePermiso(actor.permissions, 'servicio.update')) {
      throw new ApiError(403, 'No tenés permisos para realizar esta acción')
    }
    if (cerrando && !tienePermiso(actor.permissions, 'servicio.close')) {
      throw new ApiError(403, 'No tenés permisos para cerrar órdenes de trabajo')
    }
    if (
      tecnicoId !== undefined &&
      tecnicoId !== otActual.tecnicoId &&
      !tienePermiso(actor.permissions, 'servicio.assign')
    ) {
      throw new ApiError(403, 'No tenés permisos para asignar técnicos')
    }

    let repuestosNormalizados: typeof repuestos | undefined
    if (repuestos !== undefined) {
      const errRep = validarRepuestosOTCliente(repuestos)
      if (errRep) throw new ApiError(400, errRep)
      repuestosNormalizados = await aplicarPreciosRepuestosOT(repuestos, otActual.clienteId)
    }

    const repuestosParaCierre =
      repuestosNormalizados ??
      (cerrando
        ? await prisma.repuestoOT.findMany({
            where: { otId: id },
            select: { descripcion: true, cantidad: true, precioUnit: true, inventarioId: true },
          })
        : [])

    if (cerrando) {
      await validarStockRepuestosOT(repuestosParaCierre)
    }

    const updateData: Prisma.OrdenTrabajoUpdateInput = {}
    if (checklistSolucion !== undefined) {
      const { texto } = parseChecklistFromDiagnostico(otActual.diagnostico)
      const textoBase = diagnostico !== undefined ? diagnostico : texto
      updateData.diagnostico = mergeChecklistIntoDiagnostico(textoBase, checklistSolucion)
    } else if (diagnostico !== undefined) {
      const { checklist } = parseChecklistFromDiagnostico(otActual.diagnostico)
      updateData.diagnostico = mergeChecklistIntoDiagnostico(diagnostico, checklist)
    }
    if (tecnicoId !== undefined) {
      updateData.tecnico = tecnicoId ? { connect: { id: tecnicoId } } : { disconnect: true }
    }
    if (estado !== undefined) {
      updateData.estado = estado
      updateData.fechaCierre = estado === 'CERRADA' ? new Date() : null
      updateData.historial = {
        create: { estado, nota: nota ?? `Estado cambiado a ${estado}` },
      }
    }

    const ot = await prisma.$transaction(async (tx) => {
      if (repuestosNormalizados !== undefined) {
        await tx.repuestoOT.deleteMany({ where: { otId: id } })
        if (repuestosNormalizados.length > 0) {
          await tx.repuestoOT.createMany({
            data: repuestosNormalizados.map((r) => ({
              descripcion: r.descripcion,
              cantidad: r.cantidad,
              precioUnit: r.precioUnit,
              inventarioId: r.inventarioId ?? null,
              otId: id,
            })),
          })
        }
      }

      const actualizada = await tx.ordenTrabajo.update({
        where: { id },
        data: updateData,
        include: {
          equipo: { select: { id: true, numeroSerie: true } },
          repuestos: true,
        },
      })

      if (cerrando) {
        for (const r of actualizada.repuestos) {
          if (!r.inventarioId) continue
          await registrarMovimientoStock(
            {
              inventarioId: r.inventarioId,
              tipo: 'SALIDA',
              cantidad: r.cantidad,
              motivo: `Repuesto OT ${actualizada.numero}`,
              referencia: `ot:${id}:cierre`,
              usuarioId: actor.id,
            },
            tx,
          )
        }
      }

      return actualizada
    })

    if (cerrando && ot.equipoId) {
      const { registrarEntradaHistoria } = await import('@/lib/equipos/historia-clinica')
      await registrarEntradaHistoria(ot.equipoId, {
        tipo: 'OT',
        titulo: `OT ${ot.numero} cerrada`,
        contenido: diagnostico ?? nota ?? null,
        referenciaId: ot.id,
        usuarioId: actor.id,
      })
    }

    if (estado !== undefined) {
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

    if (cerrando) {
      void import('@/lib/ots/notify-cliente-cerrada').then(({ notifyClienteOtCerrada }) =>
        notifyClienteOtCerrada(id).catch(() => null),
      )
    }

    if (
      tecnicoId !== undefined &&
      tecnicoId &&
      tecnicoId !== otActual.tecnicoId
    ) {
      void import('@/lib/ots/notify-tecnico-asignada').then(({ notifyTecnicoOtAsignada }) =>
        notifyTecnicoOtAsignada(id, tecnicoId).catch(() => null),
      )
    }

    let planPreventivo: { creado: boolean; planId?: string; motivo?: string } | undefined
    if (
      cerrando &&
      ot.equipoId &&
      crearPlanPreventivo !== false &&
      ['CORRECTIVO', 'GARANTIA', 'CALIBRACION'].includes(otActual.tipo)
    ) {
      const { crearPlanPreventivoPostCierre } = await import('@/lib/ots/plan-preventivo-post-cierre')
      planPreventivo = await crearPlanPreventivoPostCierre({
        otId: id,
        otNumero: otActual.numero,
        tipo: otActual.tipo,
        equipoId: ot.equipoId,
        tecnicoId: ot.tecnicoId ?? tecnicoId ?? otActual.tecnicoId,
      })
    }

    return NextResponse.json(plain({ ...ot, planPreventivo }))
  } catch (error) {
    return handleApiError(error)
  }
}
