import { startOfMonth, endOfMonth, format, isBefore } from 'date-fns'
import { es } from 'date-fns/locale'
import { prisma } from '@/lib/prisma'

export type EstadoCuotaReporte = 'PENDIENTE' | 'VENCIDA' | 'PAGADA'

export function estadoCuotaReporte(
  estado: string,
  fechaVencimiento: Date,
  ahora = new Date(),
): EstadoCuotaReporte {
  if (estado === 'COBRADO') return 'PAGADA'
  if (estado === 'ANULADO') return 'PENDIENTE'
  if (isBefore(fechaVencimiento, ahora)) return 'VENCIDA'
  return 'PENDIENTE'
}

export async function obtenerCuotasCobranzasMesActual() {
  const ahora = new Date()
  const inicioMes = startOfMonth(ahora)
  const finMes = endOfMonth(ahora)

  return prisma.vencimientoCobranza.findMany({
    where: {
      estado: { not: 'ANULADO' },
      fechaVencimiento: { gte: inicioMes, lte: finMes },
    },
    include: {
      factura: {
        select: {
          numero: true,
          moneda: true,
          cliente: { select: { nombre: true } },
        },
      },
    },
    orderBy: [{ fechaVencimiento: 'asc' }, { numeroCuota: 'asc' }],
  })
}

function escCsv(val: string | number | null | undefined): string {
  const s = val == null ? '' : String(val)
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

export function cobranzasMesToCsv(
  cuotas: Awaited<ReturnType<typeof obtenerCuotasCobranzasMesActual>>,
): string {
  const ahora = new Date()
  const periodo = format(ahora, 'MMMM yyyy', { locale: es })
  const headers = [
    'Factura',
    'Cliente',
    'Cuota',
    'Fecha vencimiento',
    'Estado',
    'Monto',
    'Moneda',
    'Cobrado en',
  ]

  const rows = cuotas.map((c) => {
    const estado = estadoCuotaReporte(c.estado, c.fechaVencimiento, ahora)
    return [
      c.factura.numero,
      c.factura.cliente.nombre,
      c.numeroCuota,
      format(c.fechaVencimiento, 'yyyy-MM-dd'),
      estado,
      c.monto.toFixed(2),
      c.factura.moneda,
      c.cobradoEn ? format(c.cobradoEn, 'yyyy-MM-dd') : '',
    ]
      .map(escCsv)
      .join(',')
  })

  const pendiente = cuotas.reduce((acc, c) => {
    const e = estadoCuotaReporte(c.estado, c.fechaVencimiento, ahora)
    return e !== 'PAGADA' ? acc + c.monto : acc
  }, 0)
  const pagado = cuotas.reduce((acc, c) => {
    const e = estadoCuotaReporte(c.estado, c.fechaVencimiento, ahora)
    return e === 'PAGADA' ? acc + c.monto : acc
  }, 0)

  const meta = `# Cobranzas ${periodo} — ${cuotas.length} cuota(s) — pendiente ${pendiente.toFixed(2)} · cobrado ${pagado.toFixed(2)}`

  return [meta, headers.join(','), ...rows].join('\n')
}
