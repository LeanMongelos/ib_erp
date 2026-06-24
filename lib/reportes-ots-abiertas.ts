import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { prisma } from '@/lib/prisma'
import { actualizarOTsVencidas } from '@/lib/ots'

export async function obtenerOtsAbiertas() {
  await actualizarOTsVencidas()
  return prisma.ordenTrabajo.findMany({
    where: { estado: { in: ['ABIERTA', 'EN_PROCESO'] } },
    select: {
      numero: true,
      estado: true,
      prioridad: true,
      tipo: true,
      descripcion: true,
      fechaApertura: true,
      slaVence: true,
      slaHoras: true,
      cliente: { select: { nombre: true } },
      tecnico: { select: { nombre: true } },
      equipo: { select: { nombre: true } },
    },
    orderBy: [{ slaVence: 'asc' }, { numero: 'asc' }],
  })
}

function escCsv(val: string | number | null | undefined): string {
  const s = val == null ? '' : String(val)
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

export function otsAbiertasToCsv(
  ots: Awaited<ReturnType<typeof obtenerOtsAbiertas>>,
): string {
  const ahora = new Date()
  const headers = [
    'Numero',
    'Estado',
    'Prioridad',
    'Tipo',
    'Cliente',
    'Tecnico',
    'Equipo',
    'Fecha apertura',
    'SLA vence',
    'SLA horas',
    'Descripcion',
  ]

  const rows = ots.map((o) =>
    [
      o.numero,
      o.estado,
      o.prioridad,
      o.tipo,
      o.cliente.nombre,
      o.tecnico?.nombre ?? '',
      o.equipo?.nombre ?? '',
      format(o.fechaApertura, 'yyyy-MM-dd'),
      format(o.slaVence, 'yyyy-MM-dd HH:mm'),
      o.slaHoras,
      o.descripcion,
    ]
      .map(escCsv)
      .join(','),
  )

  const vencidasSla = ots.filter((o) => o.slaVence.getTime() < ahora.getTime()).length
  const meta = `# OTs abiertas/en proceso — ${ots.length} registro(s) — ${vencidasSla} con SLA vencido (${format(ahora, 'dd/MM/yyyy HH:mm', { locale: es })})`

  return [meta, headers.join(','), ...rows].join('\n')
}
