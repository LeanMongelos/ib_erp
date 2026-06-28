import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission, handleApiError } from '@/lib/api-auth'
import { contratoAlquilerUpdateSchema } from '@/lib/validation'
import { registrarAuditoria, getIp } from '@/lib/audit'
import { plain } from '@/lib/serialize'

type Params = { params: { id: string } }

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    await requirePermission('alquiler.read')

    const contrato = await prisma.contratoAlquiler.findUnique({
      where: { id: params.id },
      include: {
        cliente: { select: { id: true, nombre: true, cuit: true, telefono: true, email: true } },
        creadoPor: { select: { id: true, nombre: true } },
        lineas: {
          include: {
            inventarioUnidad: {
              select: {
                id: true,
                numeroSerie: true,
                estado: true,
                inventario: { select: { id: true, nombre: true, marca: true, modelo: true } },
              },
            },
            equipo: { select: { id: true, nombre: true, numeroSerie: true, origen: true } },
          },
          orderBy: { creadoEn: 'asc' },
        },
        cuotas: {
          orderBy: [{ periodo: 'desc' }, { vencimiento: 'asc' }],
          include: { factura: { select: { id: true, numero: true, estado: true } } },
        },
      },
    })

    if (!contrato) {
      return NextResponse.json({ error: 'Contrato no encontrado' }, { status: 404 })
    }

    return NextResponse.json(plain(contrato))
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const actor = await requirePermission('alquiler.update')
    const body = await req.json()
    const data = contratoAlquilerUpdateSchema.parse(body)

    const existente = await prisma.contratoAlquiler.findUnique({ where: { id: params.id } })
    if (!existente) {
      return NextResponse.json({ error: 'Contrato no encontrado' }, { status: 404 })
    }
    if (existente.estado !== 'BORRADOR') {
      return NextResponse.json(
        { error: 'Solo se pueden editar contratos en borrador' },
        { status: 400 },
      )
    }

    const contrato = await prisma.contratoAlquiler.update({
      where: { id: params.id },
      data: {
        ...(data.clienteId && { clienteId: data.clienteId }),
        ...(data.fechaInicio !== undefined && { fechaInicio: data.fechaInicio }),
        ...(data.fechaFin !== undefined && { fechaFin: data.fechaFin }),
        ...(data.diaFacturacion !== undefined && { diaFacturacion: data.diaFacturacion }),
        ...(data.observaciones !== undefined && { observaciones: data.observaciones }),
      },
      include: {
        cliente: { select: { id: true, nombre: true } },
        lineas: true,
      },
    })

    await registrarAuditoria({
      usuarioId: actor.id,
      accion: 'alquiler.contrato.update',
      entidad: 'ContratoAlquiler',
      entidadId: contrato.id,
      despues: data,
      ip: getIp(req),
    })

    return NextResponse.json(plain(contrato))
  } catch (error) {
    return handleApiError(error)
  }
}
