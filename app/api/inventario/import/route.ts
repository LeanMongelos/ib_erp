import { NextRequest, NextResponse } from 'next/server'
import { requirePermission, handleApiError, ApiError } from '@/lib/api-auth'
import { parsearInventarioWorkbook } from '@/lib/inventario-excel'
import { importarFilasInventario } from '@/lib/inventario-import'
import { importarInventarioCsv } from '@/lib/inventario/import-csv'

export const runtime = 'nodejs'
export const maxDuration = 120

function esCsv(nombre: string): boolean {
  return nombre.toLowerCase().endsWith('.csv')
}

function esExcel(nombre: string): boolean {
  const n = nombre.toLowerCase()
  return n.endsWith('.xlsx') || n.endsWith('.xls')
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requirePermission('inventario.create')

    const form = await req.formData()
    const archivo = form.get('archivo')
    if (!(archivo instanceof Blob)) {
      throw new ApiError(400, 'Subí un archivo CSV o Excel')
    }

    const nombre = 'name' in archivo && typeof archivo.name === 'string' ? archivo.name : ''

    if (nombre && esCsv(nombre)) {
      const texto = await archivo.text()
      if (texto.trim().length < 5) throw new ApiError(400, 'Archivo vacío o corrupto')
      if (texto.length > 2 * 1024 * 1024) throw new ApiError(400, 'Máximo 2 MB por archivo')
      const resultado = await importarInventarioCsv(texto, actor.id)
      return NextResponse.json(resultado)
    }

    if (nombre && !esExcel(nombre)) {
      throw new ApiError(400, 'El archivo debe ser CSV (.csv) o Excel (.xlsx / .xls)')
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
