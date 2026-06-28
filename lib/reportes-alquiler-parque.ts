import { prisma } from '@/lib/prisma'

export async function obtenerParqueAlquilerActivo() {
  return prisma.lineaAlquiler.findMany({
    where: {
      activa: true,
      contrato: { estado: { in: ['ACTIVO', 'SUSPENDIDO'] } },
    },
    include: {
      contrato: {
        select: {
          numero: true,
          estado: true,
          diaFacturacion: true,
          fechaInicio: true,
          cliente: { select: { nombre: true, cuit: true } },
        },
      },
      inventarioUnidad: {
        select: {
          numeroSerie: true,
          inventario: { select: { nombre: true, marca: true, modelo: true } },
        },
      },
    },
    orderBy: [{ contrato: { numero: 'asc' } }, { creadoEn: 'asc' }],
  })
}

function escCsv(val: string | number | null | undefined): string {
  const s = val == null ? '' : String(val)
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

export function parqueAlquilerToCsv(
  lineas: Awaited<ReturnType<typeof obtenerParqueAlquilerActivo>>,
): string {
  const headers = [
    'Contrato',
    'Estado contrato',
    'Cliente pagador',
    'CUIT',
    'Equipo',
    'Serie',
    'Beneficiario',
    'Domicilio',
    'Localidad',
    'Monto mensual',
    'Inicio contrato',
  ]

  const rows = lineas.map((l) =>
    [
      l.contrato.numero,
      l.contrato.estado,
      l.contrato.cliente.nombre,
      l.contrato.cliente.cuit ?? '',
      l.inventarioUnidad.inventario.nombre,
      l.inventarioUnidad.numeroSerie ?? '',
      l.beneficiarioNombre ?? '',
      l.domicilio ?? '',
      l.localidad ?? '',
      l.montoMensual.toFixed(2),
      l.contrato.fechaInicio ? l.contrato.fechaInicio.toISOString().slice(0, 10) : '',
    ]
      .map(escCsv)
      .join(','),
  )

  return [headers.join(','), ...rows].join('\n')
}
