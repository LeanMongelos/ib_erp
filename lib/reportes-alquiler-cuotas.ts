import { prisma } from '@/lib/prisma'

export async function obtenerCuotasAlquilerReporte(opts?: { periodo?: string; estado?: string }) {
  return prisma.cuotaAlquiler.findMany({
    where: {
      ...(opts?.periodo && { periodo: opts.periodo }),
      ...(opts?.estado && { estado: opts.estado as 'PENDIENTE' | 'FACTURADA' | 'COBRADA' | 'VENCIDA' | 'ANULADA' }),
    },
    include: {
      contrato: {
        select: {
          numero: true,
          cliente: { select: { nombre: true } },
        },
      },
      linea: {
        select: {
          beneficiarioNombre: true,
          inventarioUnidad: {
            select: {
              numeroSerie: true,
              inventario: { select: { nombre: true } },
            },
          },
        },
      },
      factura: { select: { numero: true, estado: true } },
    },
    orderBy: [{ periodo: 'desc' }, { vencimiento: 'asc' }],
  })
}

function escCsv(val: string | number | null | undefined): string {
  const s = val == null ? '' : String(val)
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

export function cuotasAlquilerToCsv(
  cuotas: Awaited<ReturnType<typeof obtenerCuotasAlquilerReporte>>,
): string {
  const headers = [
    'Contrato',
    'Cliente',
    'Período',
    'Equipo',
    'Serie',
    'Beneficiario',
    'Vencimiento',
    'Estado',
    'Monto',
    'Factura',
    'Estado factura',
  ]

  const rows = cuotas.map((c) =>
    [
      c.contrato.numero,
      c.contrato.cliente.nombre,
      c.periodo,
      c.linea.inventarioUnidad.inventario.nombre,
      c.linea.inventarioUnidad.numeroSerie ?? '',
      c.linea.beneficiarioNombre ?? '',
      c.vencimiento.toISOString().slice(0, 10),
      c.estado,
      c.monto.toFixed(2),
      c.factura?.numero ?? '',
      c.factura?.estado ?? '',
    ]
      .map(escCsv)
      .join(','),
  )

  return [headers.join(','), ...rows].join('\n')
}
