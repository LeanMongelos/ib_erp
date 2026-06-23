import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { requireAuth, handleApiError, ApiError } from '@/lib/api-auth'
import { cambiarPasswordSchema } from '@/lib/validation'
import { registrarAuditoria, getIp } from '@/lib/audit'
import {
  obtenerPoliticaSeguridad,
  validarPasswordSegunPolitica,
} from '@/lib/config/politica-seguridad'

export async function PUT(req: NextRequest) {
  try {
    const actor = await requireAuth()
    const body = await req.json()
    const { actual, nueva } = cambiarPasswordSchema.parse(body)

    const usuario = await prisma.usuario.findUnique({ where: { id: actor.id } })
    if (!usuario) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

    const ok = await bcrypt.compare(actual, usuario.password)
    if (!ok) throw new ApiError(400, 'La contraseña actual es incorrecta')

    const politica = await obtenerPoliticaSeguridad()
    const errorPolitica = validarPasswordSegunPolitica(nueva, politica)
    if (errorPolitica) throw new ApiError(400, errorPolitica)

    const passwordHash = await bcrypt.hash(nueva, 10)
    await prisma.usuario.update({ where: { id: actor.id }, data: { password: passwordHash } })

    await registrarAuditoria({
      usuarioId: actor.id,
      accion: 'perfil.password_change',
      entidad: 'Usuario',
      entidadId: actor.id,
      ip: getIp(req),
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    return handleApiError(error)
  }
}
