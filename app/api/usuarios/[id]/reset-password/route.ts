import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { requirePermission, handleApiError, ApiError } from '@/lib/api-auth'
import { redactForClientExcept } from '@/lib/security/redact'
import { applySecurityHeaders } from '@/lib/security/headers'
import { registrarAuditoria, getIp } from '@/lib/audit'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requirePermission('usuarios.update')
    const { id } = await params

    const existente = await prisma.usuario.findUnique({ where: { id }, select: { id: true, email: true } })
    if (!existente) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

    const passwordTemporal = randomBytes(6).toString('base64url')
    const passwordHash = await bcrypt.hash(passwordTemporal, 10)

    await prisma.usuario.update({
      where: { id },
      data: { password: passwordHash },
    })

    await registrarAuditoria({
      usuarioId: actor.id,
      accion: 'usuario.password_reset',
      entidad: 'Usuario',
      entidadId: id,
      ip: getIp(_req),
    })

    const payload = redactForClientExcept(
      { id: existente.id, email: existente.email, passwordTemporal },
      ['id', 'email', 'passwordTemporal'],
    )
    return applySecurityHeaders(NextResponse.json(payload)) as NextResponse
  } catch (error) {
    return handleApiError(error)
  }
}
