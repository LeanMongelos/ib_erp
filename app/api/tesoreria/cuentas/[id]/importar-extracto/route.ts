import { NextRequest, NextResponse } from 'next/server'
import { requirePermission, handleApiError } from '@/lib/api-auth'
import { plain } from '@/lib/serialize'
import { parseExtractoCsv } from '@/lib/tesoreria/parse-extracto-csv'
import { sugerirMatchesExtracto } from '@/lib/tesoreria/conciliar-extracto'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requirePermission('tesoreria.reconcile')
    const { id: cuentaId } = await params

    let csvText = ''
    const contentType = req.headers.get('content-type') ?? ''
    if (contentType.includes('multipart/form-data')) {
      const form = await req.formData()
      const file = form.get('file')
      if (file instanceof File) {
        csvText = await file.text()
      } else {
        csvText = String(form.get('csv') ?? '')
      }
    } else {
      const body = await req.json().catch(() => ({}))
      csvText = String(body.csv ?? body.contenido ?? '')
    }

    if (!csvText.trim()) {
      return NextResponse.json({ error: 'Subí un archivo CSV o enviá el contenido' }, { status: 400 })
    }

    const lineas = parseExtractoCsv(csvText)
    const matches = await sugerirMatchesExtracto(cuentaId, lineas)

    return NextResponse.json(plain({
      lineas: lineas.length,
      matches,
    }))
  } catch (error) {
    return handleApiError(error)
  }
}
