/**
 * Exportación CSV de clientes (sin Prisma en tests de formato).
 */
import { prisma } from '@/lib/prisma'

function escaparCsv(val: string): string {
  if (/[",\n\r;]/.test(val)) {
    return `"${val.replace(/"/g, '""')}"`
  }
  return val
}

export function filasToCsv(filas: string[][]): string {
  return filas.map((f) => f.map(escaparCsv).join(',')).join('\n')
}

export async function exportarClientesCsv(): Promise<string> {
  const clientes = await prisma.cliente.findMany({
    where: { activo: true },
    orderBy: { nombre: 'asc' },
    select: {
      nombre: true,
      tipo: true,
      cuit: true,
      email: true,
      telefono: true,
      ciudad: true,
      contacto: true,
      direccion: true,
    },
  })

  const header = ['razonSocial', 'tipo', 'cuit', 'email', 'telefono', 'ciudad', 'contacto', 'direccion']
  const filas = clientes.map((c) => [
    c.nombre,
    c.tipo,
    c.cuit ?? '',
    c.email ?? '',
    c.telefono ?? '',
    c.ciudad ?? '',
    c.contacto ?? '',
    c.direccion ?? '',
  ])

  return filasToCsv([header, ...filas])
}
