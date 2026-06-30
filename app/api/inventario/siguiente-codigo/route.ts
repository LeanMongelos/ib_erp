import { NextRequest, NextResponse } from 'next/server'
import { requirePermission, handleApiError, ApiError } from '@/lib/api-auth'
import { buscarSiguienteCodigoInterno } from '@/lib/inventario/siguiente-codigo-db'
import { extraerPrefijoCodigo } from '@/lib/inventario/siguiente-codigo'
import { plain } from '@/lib/serialize'

export async function GET(req: NextRequest) {
  try {
    await requirePermission('inventario.read')
    const prefijoParam = new URL(req.url).searchParams.get('prefijo')?.trim() ?? ''
    const prefijo = extraerPrefijoCodigo(prefijoParam)
    if (!prefijo) {
      throw new ApiError(400, 'Indicá un prefijo de 3–4 letras (ej. HOE o ALQ)')
    }

    const resultado = await buscarSiguienteCodigoInterno(prefijo)
    return NextResponse.json(plain(resultado))
  } catch (error) {
    return handleApiError(error)
  }
}
