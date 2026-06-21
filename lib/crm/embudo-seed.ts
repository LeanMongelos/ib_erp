import type { PrismaClient } from '@prisma/client'
import type { EtapaEmbudo, UrgenciaEmbudo } from '@prisma/client'

const DEMO_NEGOCIOS: Array<{
  numero: number
  nombre: string
  cliente: string
  monto: number
  etapa: EtapaEmbudo
  vendedor: string
  urgencia: UrgenciaEmbudo
  productoServicio?: string
}> = [
  { numero: 533, nombre: 'Rayos X portátil Jade DGREM', cliente: 'EMI SRL Emergencia Médica', monto: 52800, etapa: 'PROPUESTA', vendedor: 'GA', urgencia: 'NORMAL', productoServicio: 'Rayos X portátil' },
  { numero: 620, nombre: 'Servicio de Cardiología', cliente: 'NEA Diagnóstica SRL', monto: 14735000, etapa: 'SEGUIMIENTO', vendedor: 'LB', urgencia: 'URGENTE', productoServicio: 'Servicio cardiología' },
  { numero: 745, nombre: 'Sierra corta yeso', cliente: 'Ministerio de Desarrollo Humano', monto: 8793388, etapa: 'ANALISIS', vendedor: 'GA', urgencia: 'NORMAL', productoServicio: 'Sierra corta yeso' },
  { numero: 546, nombre: 'VAC Saldivar Lucas', cliente: 'Ministerio de Desarrollo Humano', monto: 2479338, etapa: 'ENTREGA', vendedor: 'GA', urgencia: 'NORMAL', productoServicio: 'VAC' },
  { numero: 806, nombre: 'Columna de techo fija de gases', cliente: 'Sanatorio Formosa SRL', monto: 5776711, etapa: 'CIERRE', vendedor: 'LB', urgencia: 'URGENTE', productoServicio: 'Columna gases' },
  { numero: 535, nombre: '10 placas pacientes', cliente: 'Soc. Beneficencia Formosa Maternidad', monto: 619834, etapa: 'PROPUESTA', vendedor: 'GA', urgencia: 'NORMAL', productoServicio: 'Placas pacientes' },
  { numero: 539, nombre: 'UVP', cliente: 'CUIT Genérico', monto: 694, etapa: 'PROPUESTA', vendedor: 'GA', urgencia: 'NORMAL', productoServicio: 'UVP' },
  { numero: 536, nombre: 'Mantenimiento planta de gases', cliente: 'Asociación Mutual Policía de Formosa', monto: 1090909, etapa: 'PROPUESTA', vendedor: 'GA', urgencia: 'NORMAL', productoServicio: 'Mantenimiento planta gases' },
]

export async function seedEmbudoIfEmpty(prisma: PrismaClient): Promise<number> {
  const count = await prisma.negocioEmbudo.count()
  if (count > 0) return 0

  const diasAtras = [3, 5, 12, 8, 20, 6, 2, 4]
  for (let i = 0; i < DEMO_NEGOCIOS.length; i++) {
    const n = DEMO_NEGOCIOS[i]
    const etapaDesde = new Date()
    etapaDesde.setDate(etapaDesde.getDate() - diasAtras[i])

    const cerradoEn = n.etapa === 'CIERRE' ? new Date() : null

    await prisma.negocioEmbudo.create({
      data: {
        numero: n.numero,
        nombre: n.nombre,
        cliente: n.cliente,
        productoServicio: n.productoServicio,
        monto: n.monto,
        vendedor: n.vendedor,
        urgencia: n.urgencia,
        etapa: n.etapa,
        etapaDesde,
        cerradoEn,
        notas: 'Negocio de ejemplo',
      },
    })
  }

  return DEMO_NEGOCIOS.length
}

export async function nextNumeroNegocio(prisma: PrismaClient): Promise<number> {
  const max = await prisma.negocioEmbudo.aggregate({ _max: { numero: true } })
  return (max._max.numero ?? 500) + 1
}
