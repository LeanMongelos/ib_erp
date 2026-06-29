/**
 * lib/sequences.ts
 * Generación de números correlativos únicos para OTs, facturas, presupuestos, etc.
 */

import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import {
  claveActaAlquiler,
  claveFactura,
  claveNotaCredito,
  clavePresupuesto,
  claveRemito,
  parseCorrelativo,
  reservarSiguienteNumero,
} from '@/lib/numeracion'

export async function siguienteNumeroOT(): Promise<string> {
  const año = new Date().getFullYear()
  const prefijo = `OT-${año}-`

  const ultimas = await prisma.ordenTrabajo.findMany({
    where: { numero: { startsWith: prefijo } },
    select: { numero: true },
  })

  const maximo = ultimas.reduce((max, { numero }) => Math.max(max, parseCorrelativo(numero)), 0)
  return `${prefijo}${String(maximo + 1).padStart(4, '0')}`
}

export async function siguienteNumeroFactura(tipo: string): Promise<string> {
  return reservarSiguienteNumero(claveFactura(tipo))
}

export async function siguienteNumeroNotaCredito(tipo: string): Promise<string> {
  return reservarSiguienteNumero(claveNotaCredito(tipo))
}

export async function crearConNumeroUnico<T>(
  generarNumero: () => Promise<string>,
  crear: (numero: string) => Promise<T>,
  maxIntentos = 5,
): Promise<T> {
  for (let intento = 0; intento < maxIntentos; intento++) {
    const numero = await generarNumero()
    try {
      return await crear(numero)
    } catch (error) {
      const esColision =
        error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'
      if (esColision && intento < maxIntentos - 1) continue
      throw error
    }
  }
  throw new Error('No se pudo generar un número correlativo único')
}

export async function siguienteNumeroPresupuesto(): Promise<string> {
  return reservarSiguienteNumero(clavePresupuesto())
}

export async function siguienteNumeroRemito(): Promise<string> {
  return reservarSiguienteNumero(claveRemito())
}

export async function siguienteNumeroActaAlquiler(): Promise<string> {
  return reservarSiguienteNumero(claveActaAlquiler())
}

export async function siguienteNumeroContratoAlquiler(): Promise<string> {
  const año = new Date().getFullYear()
  const prefijo = `ALQ-${año}-`
  const ultimos = await prisma.contratoAlquiler.findMany({
    where: { numero: { startsWith: prefijo } },
    select: { numero: true },
  })
  const maximo = ultimos.reduce((max, { numero }) => Math.max(max, parseCorrelativo(numero)), 0)
  return `${prefijo}${String(maximo + 1).padStart(4, '0')}`
}

export async function siguienteNumeroOC(): Promise<string> {
  const año = new Date().getFullYear()
  const prefijo = `OC-${año}-`
  const ultimas = await prisma.ordenCompra.findMany({
    where: { numero: { startsWith: prefijo } },
    select: { numero: true },
  })
  const maximo = ultimas.reduce((max, { numero }) => Math.max(max, parseCorrelativo(numero)), 0)
  return `${prefijo}${String(maximo + 1).padStart(4, '0')}`
}

export async function siguienteNumeroFacturaCompra(): Promise<string> {
  const año = new Date().getFullYear()
  const prefijo = `FC-${año}-`
  const ultimas = await prisma.facturaCompra.findMany({
    where: { numero: { startsWith: prefijo } },
    select: { numero: true },
  })
  const maximo = ultimas.reduce((max, { numero }) => Math.max(max, parseCorrelativo(numero)), 0)
  return `${prefijo}${String(maximo + 1).padStart(4, '0')}`
}

export async function siguienteNumeroFlete(): Promise<string> {
  const año = new Date().getFullYear()
  const prefijo = `FLT-${año}-`
  const ultimos = await prisma.seguimientoFlete.findMany({
    where: { numero: { startsWith: prefijo } },
    select: { numero: true },
  })
  const maximo = ultimos.reduce((max, { numero }) => Math.max(max, parseCorrelativo(numero)), 0)
  return `${prefijo}${String(maximo + 1).padStart(4, '0')}`
}

export { parseCorrelativo }
