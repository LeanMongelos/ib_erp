import { differenceInDays, format } from 'date-fns'
import { es } from 'date-fns/locale'
import { prisma } from '@/lib/prisma'
import { estadoCuotaReporte } from '@/lib/reportes-cobranzas-mes'

export type BucketAging = '0-30' | '31-60' | '61-90' | '90+'

export function bucketAging(dias: number): BucketAging {
  if (dias <= 30) return '0-30'
  if (dias <= 60) return '31-60'
  if (dias <= 90) return '61-90'
  return '90+'
}

export async function obtenerCuotasAgingPendientes() {
  const ahora = new Date()
  const cuotas = await prisma.vencimientoCobranza.findMany({
    where: { estado: { in: ['PENDIENTE', 'AVISO_ENVIADO'] } },
    include: {
      factura: {
        select: {
          numero: true,
          moneda: true,
          cliente: { select: { nombre: true } },
        },
      },
    },
    orderBy: { fechaVencimiento: 'asc' },
  })

  return cuotas
    .map((c) => {
      const estado = estadoCuotaReporte(c.estado, c.fechaVencimiento, ahora)
      if (estado === 'PAGADA') return null
      const dias = Math.max(0, differenceInDays(ahora, c.fechaVencimiento))
      return {
        ...c,
        estadoReporte: estado,
        diasAntiguedad: dias,
        bucket: bucketAging(dias),
      }
    })
    .filter(Boolean) as Array<
    (typeof cuotas)[number] & {
      estadoReporte: string
      diasAntiguedad: number
      bucket: BucketAging
    }
  >
}

function escCsv(val: string | number | null | undefined): string {
  const s = val == null ? '' : String(val)
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

export function agingCobranzasToCsv(cuotas: Awaited<ReturnType<typeof obtenerCuotasAgingPendientes>>): string {
  const ahora = new Date()
  const headers = [
    'Factura',
    'Cliente',
    'Cuota',
    'Vencimiento',
    'Dias antigüedad',
    'Bucket',
    'Estado',
    'Monto',
    'Moneda',
  ]

  const rows = cuotas.map((c) =>
    [
      c.factura.numero,
      c.factura.cliente.nombre,
      c.numeroCuota,
      format(c.fechaVencimiento, 'yyyy-MM-dd'),
      c.diasAntiguedad,
      c.bucket,
      c.estadoReporte,
      c.monto.toFixed(2),
      c.factura.moneda,
    ]
      .map(escCsv)
      .join(','),
  )

  const total = cuotas.reduce((a, c) => a + c.monto, 0)
  const meta = `# Aging cobranzas — ${cuotas.length} cuota(s) pendiente(s) — total ${total.toFixed(2)} (${format(ahora, 'dd/MM/yyyy', { locale: es })})`

  return [meta, headers.join(','), ...rows].join('\n')
}
