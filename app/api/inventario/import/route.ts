import { NextRequest, NextResponse } from 'next/server'
import { requirePermission, handleApiError, ApiError } from '@/lib/api-auth'
import { parsearInventarioWorkbook } from '@/lib/inventario-excel'
import { importarFilasInventario } from '@/lib/inventario-import'

export const runtime = 'nodejs'
export const maxDuration = 120

export async function POST(req: NextRequest) {
  try {
    const actor = await requirePermission('inventario.create')

    const form = await req.formData()
    const archivo = form.get('archivo')
    if (!(archivo instanceof Blob)) {
      throw new ApiError(400, 'Subí un archivo Excel (.xlsx)')
    }

    const nombre = 'name' in archivo && typeof archivo.name === 'string' ? archivo.name : ''
    if (nombre && !nombre.toLowerCase().endsWith('.xlsx') && !nombre.toLowerCase().endsWith('.xls')) {
      throw new ApiError(400, 'El archivo debe ser Excel (.xlsx o .xls)')
    }

    const buffer = Buffer.from(await archivo.arrayBuffer())
    if (buffer.length < 100) throw new ApiError(400, 'Archivo vacío o corrupto')
    if (buffer.length > 5 * 1024 * 1024) throw new ApiError(400, 'Máximo 5 MB por archivo')

    const { productos, kits } = parsearInventarioWorkbook(buffer)
    const resultado = await importarFilasInventario(productos, actor.id, kits)

    return NextResponse.json(resultado)
  } catch (error) {
    return handleApiError(error)
  }
}
