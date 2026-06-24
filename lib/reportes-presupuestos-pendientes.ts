import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { prisma } from '@/lib/prisma'
import { actualizarPresupuestosVencidos } from '@/lib/presupuestos/actualizar-vencidos'

export async function obtenerPresupuestosPendientes() {
  await actualizarPresupuestosVencidos()
  return prisma.presupuesto.findMany({
    where: { estado: { in: ['ENVIADO', 'APROBADO'] } },
    select: {
      numero: true,
      estado: true,
      total: true,
      moneda: true,
      fechaEmision: true,
      fechaVencimiento: true,
      vigenciaDias: true,
      cliente: { select: { nombre: true } },
      vendedor: { select: { nombre: true } },
    },
    orderBy: [{ fechaVencimiento: 'asc' }, { numero: 'asc' }],
  })
}

function escCsv(val: string | number | null | undefined): string {
  const s = val == null ? '' : String(val)
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

export function presupuestosPendientesToCsv(
  presupuestos: Awaited<ReturnType<typeof obtenerPresupuestosPendientes>>,
): string {
  const ahora = new Date()
  const headers = [
    'Numero',
    'Estado',
    'Cliente',
    'Vendedor',
    'Fecha emision',
    'Fecha vencimiento',
    'Vigencia dias',
    'Total',
    'Moneda',
  ]

  const rows = presupuestos.map((p) =>
    [
      p.numero,
      p.estado,
      p.cliente.nombre,
      p.vendedor?.nombre ?? '',
      format(p.fechaEmision, 'yyyy-MM-dd'),
      p.fechaVencimiento ? format(p.fechaVencimiento, 'yyyy-MM-dd') : '',
      p.vigenciaDias,
      p.total.toFixed(2),
      p.moneda,
    ]
      .map(escCsv)
      .join(','),
  )

  const proximosVencer = presupuestos.filter(
    (p) => p.fechaVencimiento && p.fechaVencimiento.getTime() >= ahora.getTime(),
  ).length
  const meta = `# Presupuestos ENVIADO/APROBADO — ${presupuestos.length} registro(s) — ${proximosVencer} vigentes (${format(ahora, 'dd/MM/yyyy', { locale: es })})`

  return [meta, headers.join(','), ...rows].join('\n')
}
