import { randomUUID } from 'crypto'
import { prisma } from '@/lib/prisma'
import { ApiError } from '@/lib/api-auth'
import { calcularSaldo } from '@/lib/tesoreria/saldo'

export interface CrearTransferenciaInput {
  cuentaOrigenId: string
  cuentaDestinoId: string
  monto: number
  fecha: Date
  descripcion: string
  creadoPorId: string
}

export async function crearTransferencia(input: CrearTransferenciaInput) {
  if (input.cuentaOrigenId === input.cuentaDestinoId) {
    throw new ApiError(400, 'La cuenta origen y destino deben ser distintas')
  }
  if (input.monto <= 0) throw new ApiError(400, 'El monto debe ser mayor a cero')
  if (Number.isNaN(input.fecha.getTime())) throw new ApiError(400, 'Fecha inválida')

  const [origen, destino] = await Promise.all([
    prisma.cuentaTesoreria.findUnique({ where: { id: input.cuentaOrigenId } }),
    prisma.cuentaTesoreria.findUnique({ where: { id: input.cuentaDestinoId } }),
  ])

  if (!origen) throw new ApiError(404, 'Cuenta origen no encontrada')
  if (!destino) throw new ApiError(404, 'Cuenta destino no encontrada')
  if (!origen.activa || !destino.activa) {
    throw new ApiError(400, 'Ambas cuentas deben estar activas')
  }
  if (origen.moneda !== destino.moneda) {
    throw new ApiError(400, 'Las cuentas deben tener la misma moneda')
  }

  const saldo = await calcularSaldo(input.cuentaOrigenId)
  if (saldo - input.monto < -0.01) {
    throw new ApiError(400, 'Saldo insuficiente en la cuenta origen')
  }

  const transferenciaId = randomUUID()
  const desc = input.descripcion.trim() || 'Transferencia entre cuentas'

  return prisma.$transaction(async (tx) => {
    const egreso = await tx.movimientoTesoreria.create({
      data: {
        cuentaTesoreriaId: input.cuentaOrigenId,
        fecha: input.fecha,
        tipo: 'EGRESO',
        monto: input.monto,
        descripcion: `${desc} → ${destino.nombre}`,
        referencia: transferenciaId,
        transferenciaId,
        creadoPorId: input.creadoPorId,
      },
    })

    const ingreso = await tx.movimientoTesoreria.create({
      data: {
        cuentaTesoreriaId: input.cuentaDestinoId,
        fecha: input.fecha,
        tipo: 'INGRESO',
        monto: input.monto,
        descripcion: `${desc} ← ${origen.nombre}`,
        referencia: transferenciaId,
        transferenciaId,
        creadoPorId: input.creadoPorId,
      },
    })

    return {
      transferenciaId,
      monto: input.monto,
      fecha: input.fecha,
      descripcion: desc,
      origen: { id: origen.id, nombre: origen.nombre },
      destino: { id: destino.id, nombre: destino.nombre },
      movimientos: [egreso, ingreso],
    }
  })
}

export async function listarTransferenciasRecientes(limit = 20) {
  const movs = await prisma.movimientoTesoreria.findMany({
    where: {
      transferenciaId: { not: null },
      tipo: 'EGRESO',
      anuladoEn: null,
    },
    orderBy: [{ fecha: 'desc' }, { creadoEn: 'desc' }],
    take: limit,
    include: {
      cuentaTesoreria: { select: { id: true, nombre: true } },
    },
  })

  const ids = [...new Set(movs.map((m) => m.transferenciaId).filter(Boolean))] as string[]
  const pares = await prisma.movimientoTesoreria.findMany({
    where: { transferenciaId: { in: ids }, anuladoEn: null },
    include: {
      cuentaTesoreria: { select: { id: true, nombre: true } },
    },
  })

  const byTx = new Map<string, typeof pares>()
  for (const m of pares) {
    if (!m.transferenciaId) continue
    const list = byTx.get(m.transferenciaId) ?? []
    list.push(m)
    byTx.set(m.transferenciaId, list)
  }

  return movs.map((egreso) => {
    const grupo = byTx.get(egreso.transferenciaId!) ?? [egreso]
    const ingreso = grupo.find((m) => m.tipo === 'INGRESO')
    return {
      transferenciaId: egreso.transferenciaId,
      fecha: egreso.fecha,
      monto: egreso.monto,
      descripcion: egreso.descripcion.replace(/\s→.*$/, ''),
      cuentaOrigen: egreso.cuentaTesoreria,
      cuentaDestino: ingreso?.cuentaTesoreria ?? null,
      movimientoOrigenId: egreso.id,
      movimientoDestinoId: ingreso?.id ?? null,
    }
  })
}
