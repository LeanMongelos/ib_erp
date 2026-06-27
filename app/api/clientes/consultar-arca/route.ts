import { NextRequest, NextResponse } from 'next/server'
import { requirePermission, handleApiError, ApiError } from '@/lib/api-auth'
import { validarCuit } from '@/lib/cuit'
import { consultarContribuyenteArca } from '@/lib/afip/consultar-contribuyente'

export async function GET(req: NextRequest) {
  try {
    await requirePermission('clientes.create', 'clientes.update')

    const cuit = new URL(req.url).searchParams.get('cuit')?.trim() ?? ''
    if (!cuit) {
      throw new ApiError(400, 'Indicá un CUIT para consultar')
    }
    if (!validarCuit(cuit)) {
      throw new ApiError(400, 'CUIT inválido — verificá el formato y el dígito verificador')
    }

    const resultado = await consultarContribuyenteArca(cuit)
    if (!resultado.ok) {
      const status =
        resultado.codigo === 'NO_ENCONTRADO'
          ? 404
          : resultado.codigo === 'CONFIG'
            ? 503
            : 502
      throw new ApiError(status, resultado.mensaje)
    }

    return NextResponse.json(resultado.data)
  } catch (error) {
    return handleApiError(error)
  }
}
