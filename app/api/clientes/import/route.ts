import { NextRequest, NextResponse } from 'next/server'
import { requirePermission, handleApiError, ApiError } from '@/lib/api-auth'
import { importarClientesCsv } from '@/lib/clientes/import-csv'

export const runtime = 'nodejs'
export const maxDuration = 120

export async function POST(req: NextRequest) {
  try {
    const actor = await requirePermission('clientes.create')

    const form = await req.formData()
    const archivo = form.get('archivo')
    if (!(archivo instanceof Blob)) {
      throw new ApiError(400, 'Subí un archivo CSV')
    }

    const nombre = 'name' in archivo && typeof archivo.name === 'string' ? archivo.name : ''
    if (nombre && !nombre.toLowerCase().endsWith('.csv')) {
      throw new ApiError(400, 'El archivo debe ser CSV (.csv)')
    }

    const texto = await archivo.text()
    if (texto.trim().length < 10) throw new ApiError(400, 'Archivo vacío o corrupto')
    if (texto.length > 2 * 1024 * 1024) throw new ApiError(400, 'Máximo 2 MB por archivo')

    const resultado = await importarClientesCsv(texto, actor.id)
    return NextResponse.json(resultado)
  } catch (error) {
    return handleApiError(error)
  }
}
