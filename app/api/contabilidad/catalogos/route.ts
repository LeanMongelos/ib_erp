import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requirePermission, handleApiError, ApiError } from '@/lib/api-auth'
import { plain } from '@/lib/serialize'

const bodySchema = z.object({
  tipo: z.enum(['regimen', 'plan_cuenta', 'ejercicio', 'condicion_pago', 'alicuota']),
  id: z.string().optional(),
  data: z.record(z.string(), z.unknown()),
})

export async function POST(req: NextRequest) {
  try {
    await requirePermission('config.manage_accounting')
    const { tipo, id, data } = bodySchema.parse(await req.json())

    if (tipo === 'regimen') {
      if (id) {
        const updated = await prisma.regimenImpositivo.update({
          where: { id },
          data: data as object,
          include: { jurisdiccion: true },
        })
        return NextResponse.json(plain(updated))
      }
      const codigo = String(data.codigo ?? '').trim()
      if (!codigo) throw new ApiError(400, 'Código requerido')
      const created = await prisma.regimenImpositivo.create({
        data: {
          codigo: codigo.toUpperCase(),
          nombre: String(data.nombre ?? codigo),
          tipo: String(data.tipo ?? 'RET_GAN'),
          alicuota: Number(data.alicuota ?? 0),
          minimoNoImponible: Number(data.minimoNoImponible ?? 0),
          baseMinima: Number(data.baseMinima ?? 0),
          jurisdiccionIibbId: (data.jurisdiccionIibbId as string) || null,
          activo: true,
        },
        include: { jurisdiccion: true },
      })
      return NextResponse.json(plain(created), { status: 201 })
    }

    if (tipo === 'plan_cuenta') {
      const codigo = String(data.codigo ?? '').trim()
      if (!codigo) throw new ApiError(400, 'Código requerido')
      const created = await prisma.planCuenta.create({
        data: {
          codigo,
          nombre: String(data.nombre ?? codigo),
          tipo: String(data.tipo ?? 'ACTIVO'),
          nivel: Number(data.nivel ?? 1),
          padreId: (data.padreId as string) || null,
          aceptaImputacion: data.aceptaImputacion !== false,
        },
      })
      return NextResponse.json(plain(created), { status: 201 })
    }

    if (tipo === 'ejercicio') {
      const anio = Number(data.anio)
      if (!anio) throw new ApiError(400, 'Año requerido')
      const created = await prisma.ejercicioContable.create({
        data: {
          nombre: String(data.nombre ?? `Ejercicio ${anio}`),
          anio,
          fechaInicio: new Date(anio, 0, 1),
          fechaFin: new Date(anio, 11, 31, 23, 59, 59),
        },
      })
      return NextResponse.json(plain(created), { status: 201 })
    }

    if (tipo === 'condicion_pago') {
      const codigo = String(data.codigo ?? '').trim().toUpperCase()
      const created = await prisma.condicionPagoCat.create({
        data: {
          codigo,
          nombre: String(data.nombre ?? codigo),
          diasPlazo: Number(data.diasPlazo ?? 0),
          plazosCobranza: (data.plazosCobranza as string) || null,
        },
      })
      return NextResponse.json(plain(created), { status: 201 })
    }

    if (tipo === 'alicuota') {
      const codigo = String(data.codigo ?? '').trim().toUpperCase()
      const created = await prisma.alicuotaIva.create({
        data: {
          codigo,
          nombre: String(data.nombre ?? codigo),
          porcentaje: Number(data.porcentaje ?? 21),
        },
      })
      return NextResponse.json(plain(created), { status: 201 })
    }

    throw new ApiError(400, 'Tipo no soportado')
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PATCH(req: NextRequest) {
  try {
    await requirePermission('config.manage_accounting')
    const { tipo, id, data } = bodySchema.parse(await req.json())
    if (!id) throw new ApiError(400, 'Falta id')

    if (tipo === 'regimen') {
      return NextResponse.json(plain(await prisma.regimenImpositivo.update({ where: { id }, data: data as object, include: { jurisdiccion: true } })))
    }
    if (tipo === 'plan_cuenta') {
      return NextResponse.json(plain(await prisma.planCuenta.update({ where: { id }, data: data as object })))
    }
    if (tipo === 'ejercicio') {
      return NextResponse.json(plain(await prisma.ejercicioContable.update({ where: { id }, data: data as object })))
    }
    if (tipo === 'condicion_pago') {
      return NextResponse.json(plain(await prisma.condicionPagoCat.update({ where: { id }, data: data as object })))
    }
    if (tipo === 'alicuota') {
      if (data.esPredeterminada) {
        await prisma.alicuotaIva.updateMany({ data: { esPredeterminada: false } })
      }
      return NextResponse.json(plain(await prisma.alicuotaIva.update({ where: { id }, data: data as object })))
    }

    throw new ApiError(400, 'Tipo no soportado')
  } catch (error) {
    return handleApiError(error)
  }
}
