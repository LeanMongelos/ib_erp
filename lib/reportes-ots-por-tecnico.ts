import { startOfMonth, endOfMonth, format } from 'date-fns'
import { es } from 'date-fns/locale'
import { prisma } from '@/lib/prisma'

export async function obtenerOtsPorTecnicoMesActual() {
  const ahora = new Date()
  const inicio = startOfMonth(ahora)
  const fin = endOfMonth(ahora)

  const ots = await prisma.ordenTrabajo.findMany({
    where: {
      OR: [
        { fechaApertura: { gte: inicio, lte: fin } },
        { fechaCierre: { gte: inicio, lte: fin } },
      ],
    },
    select: {
      numero: true,
      estado: true,
      tipo: true,
      fechaApertura: true,
      fechaCierre: true,
      tecnico: { select: { nombre: true } },
      cliente: { select: { nombre: true } },
    },
    orderBy: [{ tecnico: { nombre: 'asc' } }, { numero: 'asc' }],
  })

  const resumen = new Map<string, { abiertas: number; cerradas: number }>()
  for (const ot of ots) {
    const t = ot.tecnico?.nombre ?? 'Sin asignar'
    const agg = resumen.get(t) ?? { abiertas: 0, cerradas: 0 }
    if (ot.estado === 'CERRADA' && ot.fechaCierre && ot.fechaCierre >= inicio && ot.fechaCierre <= fin) {
      agg.cerradas++
    } else if (ot.estado !== 'CERRADA' && ot.estado !== 'CANCELADA') {
      agg.abiertas++
    }
    resumen.set(t, agg)
  }

  return {
    ots,
    resumen,
    periodo: format(ahora, 'MMMM yyyy', { locale: es }),
  }
}

function escCsv(val: string | number | null | undefined): string {
  const s = val == null ? '' : String(val)
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

export function otsPorTecnicoToCsv(data: Awaited<ReturnType<typeof obtenerOtsPorTecnicoMesActual>>): string {
  const headers = ['Tecnico', 'Numero OT', 'Estado', 'Tipo', 'Cliente', 'Apertura', 'Cierre']

  const rows = data.ots.map((o) =>
    [
      o.tecnico?.nombre ?? 'Sin asignar',
      o.numero,
      o.estado,
      o.tipo,
      o.cliente.nombre,
      format(o.fechaApertura, 'yyyy-MM-dd'),
      o.fechaCierre ? format(o.fechaCierre, 'yyyy-MM-dd') : '',
    ]
      .map(escCsv)
      .join(','),
  )

  const resumenLines = [...data.resumen.entries()].map(
    ([t, agg]) => `# ${t}: ${agg.abiertas} abierta(s) · ${agg.cerradas} cerrada(s) en el mes`,
  )

  const meta = `# OTs por técnico — ${data.periodo} — ${data.ots.length} OT(s)`
  return [meta, ...resumenLines, '', headers.join(','), ...rows].join('\n')
}
