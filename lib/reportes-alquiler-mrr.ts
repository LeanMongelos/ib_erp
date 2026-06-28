import { prisma } from '@/lib/prisma'

export async function obtenerMrrAlquiler() {
  const lineas = await prisma.lineaAlquiler.findMany({
    where: {
      activa: true,
      contrato: { estado: 'ACTIVO' },
    },
    include: {
      contrato: {
        select: {
          numero: true,
          cliente: { select: { nombre: true, cuit: true } },
        },
      },
      inventarioUnidad: {
        select: { inventario: { select: { nombre: true } } },
      },
    },
    orderBy: [{ contrato: { cliente: { nombre: 'asc' } } }, { montoMensual: 'desc' }],
  })

  const porCliente = new Map<string, { cliente: string; cuit: string; lineas: number; mrr: number }>()
  for (const l of lineas) {
    const key = l.contrato.cliente.nombre
    const prev = porCliente.get(key) ?? {
      cliente: l.contrato.cliente.nombre,
      cuit: l.contrato.cliente.cuit ?? '',
      lineas: 0,
      mrr: 0,
    }
    prev.lineas += 1
    prev.mrr += l.montoMensual
    porCliente.set(key, prev)
  }

  const totalMrr = lineas.reduce((s, l) => s + l.montoMensual, 0)

  return { lineas, porCliente: Array.from(porCliente.values()), totalMrr }
}

function escCsv(val: string | number | null | undefined): string {
  const s = val == null ? '' : String(val)
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

export function mrrAlquilerToCsv(data: Awaited<ReturnType<typeof obtenerMrrAlquiler>>): string {
  const headers = ['Cliente', 'CUIT', 'Líneas activas', 'MRR (ARS/mes)']
  const rows = data.porCliente.map((r) =>
    [r.cliente, r.cuit, r.lineas, r.mrr.toFixed(2)].map(escCsv).join(','),
  )
  const total = ['TOTAL', '', data.lineas.length, data.totalMrr.toFixed(2)].map(escCsv).join(',')
  return [headers.join(','), ...rows, total].join('\n')
}
