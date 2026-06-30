import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission, handleApiError, ApiError } from '@/lib/api-auth'
import { contratoAlquilerCreateSchema, estadoContratoAlquilerEnum } from '@/lib/validation'
import { crearConNumeroUnico, siguienteNumeroContratoAlquiler } from '@/lib/sequences'
import { registrarAuditoria, getIp } from '@/lib/audit'
import { plain } from '@/lib/serialize'

export async function GET(req: NextRequest) {
  try {
    await requirePermission('alquiler.read')

    const { searchParams } = new URL(req.url)
    const q = searchParams.get('q')?.trim() ?? ''
    const estadoRaw = searchParams.get('estado') ?? ''
    const estado = estadoContratoAlquilerEnum.safeParse(estadoRaw).success ? estadoRaw : ''

    const contratos = await prisma.contratoAlquiler.findMany({
      where: {
        ...(estado && { estado: estado as 'BORRADOR' | 'ACTIVO' | 'SUSPENDIDO' | 'FINALIZADO' | 'CANCELADO' }),
        ...(q && {
          OR: [
            { numero: { contains: q, mode: 'insensitive' } },
            { cliente: { nombre: { contains: q, mode: 'insensitive' } } },
          ],
        }),
      },
      include: {
        cliente: { select: { id: true, nombre: true, cuit: true } },
        _count: { select: { lineas: true, cuotas: true } },
      },
      orderBy: { creadoEn: 'desc' },
    })

    return NextResponse.json(plain(contratos))
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requirePermission('alquiler.create')
    const body = await req.json()
    const data = contratoAlquilerCreateSchema.parse(body)
    const { lineas, ...base } = data

    for (const l of lineas) {
      const unidad = await prisma.inventarioUnidad.findUnique({
        where: { id: l.inventarioUnidadId },
        include: { inventario: { select: { nombre: true, tipoArticulo: true } } },
      })
      if (!unidad) {
        throw new ApiError(400, 'Unidad de inventario no encontrada')
      }
      if (unidad.inventario.tipoArticulo !== 'ALQUILER') {
        throw new ApiError(
          400,
          `«${unidad.inventario.nombre}» no pertenece al parque de alquiler (tipo ALQUILER)`,
        )
      }
    }

    const contrato = await crearConNumeroUnico(
      siguienteNumeroContratoAlquiler,
      (numero) =>
        prisma.contratoAlquiler.create({
          data: {
            numero,
            clienteId: base.clienteId,
            fechaInicio: base.fechaInicio ?? null,
            fechaFin: base.fechaFin ?? null,
            diaFacturacion: base.diaFacturacion,
            observaciones: base.observaciones ?? null,
            creadoPorId: actor.id,
            lineas: {
              create: lineas.map((l) => ({
                inventarioUnidadId: l.inventarioUnidadId,
                montoMensual: l.montoMensual,
                beneficiarioNombre: l.beneficiarioNombre ?? null,
                beneficiarioDocumento: l.beneficiarioDocumento ?? null,
                beneficiarioTelefono: l.beneficiarioTelefono ?? null,
                beneficiarioEmail: l.beneficiarioEmail ?? null,
                domicilio: l.domicilio ?? null,
                localidad: l.localidad ?? null,
                provincia: l.provincia ?? null,
                codigoPostal: l.codigoPostal ?? null,
                lat: l.lat ?? null,
                lng: l.lng ?? null,
                fechaEntrega: l.fechaEntrega ?? null,
                observaciones: l.observaciones ?? null,
              })),
            },
          },
          include: {
            cliente: { select: { id: true, nombre: true } },
            lineas: {
              include: {
                inventarioUnidad: {
                  select: {
                    id: true,
                    numeroSerie: true,
                    inventario: { select: { nombre: true } },
                  },
                },
              },
            },
          },
        }),
    )

    await registrarAuditoria({
      usuarioId: actor.id,
      accion: 'alquiler.contrato.create',
      entidad: 'ContratoAlquiler',
      entidadId: contrato.id,
      despues: { numero: contrato.numero, clienteId: contrato.clienteId },
      ip: getIp(req),
    })

    return NextResponse.json(plain(contrato), { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
