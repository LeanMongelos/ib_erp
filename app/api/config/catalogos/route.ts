import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireAuth, requirePermission, handleApiError, ApiError } from '@/lib/api-auth'
import { plain } from '@/lib/serialize'
import { registrarAuditoria, getIp } from '@/lib/audit'
import { seedModulosConfigIfEmpty } from '@/lib/config/seed-modulos-config'

export async function GET(req: NextRequest) {
  try {
    await requireAuth()
    await seedModulosConfigIfEmpty()

    const tipo = new URL(req.url).searchParams.get('tipo')
    if (tipo === 'categorias') {
      const categorias = await prisma.categoriaInventarioCat.findMany({
        where: { activo: true },
        orderBy: [{ orden: 'asc' }, { nombre: 'asc' }],
      })
      return NextResponse.json(plain(categorias))
    }

    if (tipo === 'depositos') {
      await requirePermission('inventario.read')
      const depositos = await prisma.deposito.findMany({
        where: { activo: true },
        orderBy: { nombre: 'asc' },
        select: { id: true, nombre: true, direccion: true, tipo: true },
      })
      return NextResponse.json(plain(depositos))
    }

    await requirePermission('config.update')
    const [categorias, depositos, condicionesPago] = await Promise.all([
      prisma.categoriaInventarioCat.findMany({ orderBy: [{ orden: 'asc' }, { nombre: 'asc' }] }),
      prisma.deposito.findMany({ orderBy: { nombre: 'asc' } }),
      prisma.condicionPagoCat.findMany({ orderBy: { nombre: 'asc' } }),
    ])
    return NextResponse.json(plain({ categorias, depositos, condicionesPago }))
  } catch (error) {
    return handleApiError(error)
  }
}

const bodySchema = z.object({
  tipo: z.enum(['categoria', 'deposito', 'condicion_pago']),
  id: z.string().optional(),
  data: z.record(z.string(), z.unknown()),
})

export async function POST(req: NextRequest) {
  try {
    const actor = await requirePermission('config.update')
    const { tipo, data } = bodySchema.parse(await req.json())

    if (tipo === 'categoria') {
      const codigo = String(data.codigo ?? data.nombre ?? '').trim().toUpperCase().replace(/\s+/g, '_')
      if (!codigo) throw new ApiError(400, 'Código requerido')
      const created = await prisma.categoriaInventarioCat.create({
        data: {
          codigo,
          nombre: String(data.nombre ?? codigo),
          orden: Number(data.orden ?? 0),
        },
      })
      await registrarAuditoria({ usuarioId: actor.id, accion: 'config.catalogos.update', entidad: 'CategoriaInventarioCat', entidadId: created.id, despues: created, ip: getIp(req) })
      return NextResponse.json(plain(created), { status: 201 })
    }

    if (tipo === 'deposito') {
      const nombre = String(data.nombre ?? '').trim()
      if (!nombre) throw new ApiError(400, 'Nombre requerido')
      const tipoDeposito = String(data.tipo ?? 'DEPOSITO').trim() as 'DEPOSITO' | 'SHOWROOM' | 'CAJA' | 'OTRO'
      const created = await prisma.deposito.create({
        data: {
          nombre,
          direccion: (data.direccion as string) || null,
          tipo: tipoDeposito,
        },
      })
      await registrarAuditoria({ usuarioId: actor.id, accion: 'config.catalogos.update', entidad: 'Deposito', entidadId: created.id, despues: created, ip: getIp(req) })
      return NextResponse.json(plain(created), { status: 201 })
    }

    if (tipo === 'condicion_pago') {
      const codigo = String(data.codigo ?? '').trim().toUpperCase()
      if (!codigo) throw new ApiError(400, 'Código requerido')
      const created = await prisma.condicionPagoCat.create({
        data: {
          codigo,
          nombre: String(data.nombre ?? codigo),
          diasPlazo: Number(data.diasPlazo ?? 0),
          plazosCobranza: (data.plazosCobranza as string) || null,
        },
      })
      await registrarAuditoria({ usuarioId: actor.id, accion: 'config.catalogos.update', entidad: 'CondicionPagoCat', entidadId: created.id, despues: created, ip: getIp(req) })
      return NextResponse.json(plain(created), { status: 201 })
    }

    throw new ApiError(400, 'Tipo no soportado')
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const actor = await requirePermission('config.update')
    const { tipo, id, data } = bodySchema.parse(await req.json())
    if (!id) throw new ApiError(400, 'Falta id')

    if (tipo === 'categoria') {
      const updated = await prisma.categoriaInventarioCat.update({ where: { id }, data: data as object })
      await registrarAuditoria({ usuarioId: actor.id, accion: 'config.catalogos.update', entidad: 'CategoriaInventarioCat', entidadId: id, despues: updated, ip: getIp(req) })
      return NextResponse.json(plain(updated))
    }
    if (tipo === 'deposito') {
      const updated = await prisma.deposito.update({ where: { id }, data: data as object })
      await registrarAuditoria({ usuarioId: actor.id, accion: 'config.catalogos.update', entidad: 'Deposito', entidadId: id, despues: updated, ip: getIp(req) })
      return NextResponse.json(plain(updated))
    }
    if (tipo === 'condicion_pago') {
      if (data.esDefault === true) {
        await prisma.condicionPagoCat.updateMany({ data: { esDefault: false } })
      }
      const updated = await prisma.condicionPagoCat.update({ where: { id }, data: data as object })
      await registrarAuditoria({ usuarioId: actor.id, accion: 'config.catalogos.update', entidad: 'CondicionPagoCat', entidadId: id, despues: updated, ip: getIp(req) })
      return NextResponse.json(plain(updated))
    }

    throw new ApiError(400, 'Tipo no soportado')
  } catch (error) {
    return handleApiError(error)
  }
}
