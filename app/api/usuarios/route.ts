import { NextRequest, NextResponse } from 'next/server'
import { redactForClientExcept } from '@/lib/security/redact'
import { applySecurityHeaders } from '@/lib/security/headers'
import bcrypt from 'bcryptjs'
import { randomBytes } from 'crypto'
import { prisma } from '@/lib/prisma'
import { requirePermission, handleApiError } from '@/lib/api-auth'
import { usuarioCreateSchema } from '@/lib/validation'
import { registrarAuditoria, getIp } from '@/lib/audit'

export async function GET() {
  try {
    await requirePermission('usuarios.read')
    const usuarios = await prisma.usuario.findMany({
      orderBy: { nombre: 'asc' },
      select: {
        id: true, nombre: true, email: true, telefono: true,
        activo: true, ultimoAcceso: true, creadoEn: true,
        roles: { select: { rol: { select: { clave: true, nombre: true } } } },
      },
    })
    // Aplanamos los roles para el cliente
    return NextResponse.json(
      usuarios.map((u) => ({ ...u, roles: u.roles.map((r) => r.rol) })),
    )
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(req: NextRequest) {
  try {
    // Alta de usuarios: solo quien tenga el permiso (SUPERADMIN / GERENTE)
    const actor = await requirePermission('usuarios.create')

    const body = await req.json()
    const { nombre, email, telefono, roles } = usuarioCreateSchema.parse(body)

    // Validamos que los roles existan
    const rolesDb = await prisma.rolRBAC.findMany({ where: { clave: { in: roles } } })
    if (rolesDb.length !== roles.length) {
      return NextResponse.json({ error: 'Uno o más roles no existen' }, { status: 400 })
    }

    // Contraseña temporal de un solo uso (hasta tener el flujo de invitación por email)
    const passwordTemporal = randomBytes(6).toString('base64url')
    const passwordHash = await bcrypt.hash(passwordTemporal, 10)

    const usuario = await prisma.usuario.create({
      data: {
        nombre,
        email,
        password: passwordHash,
        rol: 'TECNICO', // valor legado; la autorización real es por `roles`
        telefono: telefono ?? null,
        roles: { create: rolesDb.map((r) => ({ rolId: r.id })) },
      },
      select: { id: true, nombre: true, email: true },
    })

    await registrarAuditoria({
      usuarioId: actor.id,
      accion: 'usuario.create',
      entidad: 'Usuario',
      entidadId: usuario.id,
      despues: { nombre, email, roles },
      ip: getIp(req),
    })

    // Contraseña temporal: solo viaja en esta respuesta, redactada en cualquier otro contexto
    const payload = redactForClientExcept(
      { ...usuario, passwordTemporal },
      ['id', 'nombre', 'email', 'passwordTemporal'],
    )
    return applySecurityHeaders(
      NextResponse.json(payload, { status: 201 }),
    ) as NextResponse
  } catch (error) {
    return handleApiError(error)
  }
}
