import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission, handleApiError, ApiError } from '@/lib/api-auth'
import { getStorage } from '@/lib/storage'
import { registrarAuditoria, getIp } from '@/lib/audit'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requirePermission('emisores.update')
    const { id } = await params

    const emisor = await prisma.emisor.findUnique({ where: { id } })
    if (!emisor) throw new ApiError(404, 'Emisor no encontrado')

    const form = await req.formData()
    const certFile = form.get('certificado') as File | null
    const keyFile = form.get('clave') as File | null

    if (!certFile || !keyFile) {
      throw new ApiError(400, 'Debés enviar certificado (.crt) y clave (.key)')
    }

    const storage = getStorage()
    const cuitSafe = emisor.cuit.replace(/\D/g, '')
    const certKey = `afip/${cuitSafe}/certificado.crt`
    const keyKey = `afip/${cuitSafe}/clave.key`

    const certBuf = Buffer.from(await certFile.arrayBuffer())
    const keyBuf = Buffer.from(await keyFile.arrayBuffer())

    await storage.put(certKey, certBuf, 'application/x-x509-ca-cert')
    await storage.put(keyKey, keyBuf, 'application/octet-stream')

    const updated = await prisma.emisor.update({
      where: { id },
      data: {
        certificadoPath: certKey,
        clavePrivadaPath: keyKey,
      },
    })

    await registrarAuditoria({
      usuarioId: actor.id,
      accion: 'emisor.certificado',
      entidad: 'Emisor',
      entidadId: id,
      ip: getIp(req),
    })

    return NextResponse.json({ ok: true, certificadoConfigured: true })
  } catch (error) {
    return handleApiError(error)
  }
}
