import { NextRequest, NextResponse } from 'next/server'
import { requirePermission, handleApiError } from '@/lib/api-auth'
import { libroComprasQuerySchema } from '@/lib/validation'
import { plain } from '@/lib/serialize'
import {
  consultarLibroCompras,
  libroComprasACsv,
  totalesLibroCompras,
} from '@/lib/compras/libro-compras'

export async function GET(req: NextRequest) {
  try {
    await requirePermission('compras.read')
    const { searchParams } = new URL(req.url)

    const parsed = libroComprasQuerySchema.parse({
      desde: searchParams.get('desde'),
      hasta: searchParams.get('hasta'),
      proveedorId: searchParams.get('proveedorId') ?? undefined,
      formato: searchParams.get('formato') ?? 'json',
    })

    const lineas = await consultarLibroCompras({
      desde: parsed.desde,
      hasta: parsed.hasta,
      proveedorId: parsed.proveedorId,
    })

    if (parsed.formato === 'csv') {
      const csv = libroComprasACsv(lineas)
      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="libro-compras-${parsed.desde.toISOString().slice(0, 10)}-${parsed.hasta.toISOString().slice(0, 10)}.csv"`,
        },
      })
    }

    return NextResponse.json(
      plain({
        lineas,
        totales: totalesLibroCompras(lineas),
        desde: parsed.desde,
        hasta: parsed.hasta,
      }),
    )
  } catch (error) {
    return handleApiError(error)
  }
}
