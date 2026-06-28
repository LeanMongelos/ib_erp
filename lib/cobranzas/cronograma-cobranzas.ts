import { prisma } from '@/lib/prisma'

export type CronogramaItemFactura = {
  tipo: 'FACTURA'
  id: string
  numeroCuota: number
  diasDesdeEmision: number
  fechaVencimiento: string
  monto: number
  estadoVencimiento: string
  factura: {
    id: string
    numero: string
    total: number
    estado: string
    condicionPago: string | null
    clienteId: string
    clienteNombre: string
  }
}

export type CronogramaItemAlquiler = {
  tipo: 'ALQUILER'
  id: string
  contratoId: string
  contratoNumero: string
  periodo: string
  fechaVencimiento: string
  monto: number
  cantidadCuotas: number
  estado: string
  clienteId: string
  clienteNombre: string
}

export type CronogramaCobranzasItem = CronogramaItemFactura | CronogramaItemAlquiler

export async function obtenerCronogramaCobranzas(opts: {
  dias?: number
  soloPendientes?: boolean
  origen?: 'TODOS' | 'FACTURA' | 'ALQUILER'
}) {
  const dias = opts.dias ?? 120
  const soloPendientes = opts.soloPendientes !== false
  const origen = opts.origen ?? 'TODOS'

  const hasta = new Date()
  hasta.setDate(hasta.getDate() + dias)

  const items: CronogramaCobranzasItem[] = []

  if (origen === 'TODOS' || origen === 'FACTURA') {
    const vencimientos = await prisma.vencimientoCobranza.findMany({
      where: {
        ...(soloPendientes ? { estado: { in: ['PENDIENTE', 'AVISO_ENVIADO'] } } : {}),
        fechaVencimiento: { lte: hasta },
        factura: { estado: { notIn: ['PAGADA', 'ANULADA'] } },
      },
      include: {
        factura: {
          select: {
            id: true,
            numero: true,
            total: true,
            condicionPago: true,
            estado: true,
            clienteId: true,
            cliente: { select: { nombre: true } },
          },
        },
      },
      orderBy: [{ fechaVencimiento: 'asc' }, { numeroCuota: 'asc' }],
      take: 120,
    })

    for (const v of vencimientos) {
      items.push({
        tipo: 'FACTURA',
        id: v.id,
        numeroCuota: v.numeroCuota,
        diasDesdeEmision: v.diasDesdeEmision,
        fechaVencimiento: v.fechaVencimiento.toISOString(),
        monto: v.monto,
        estadoVencimiento: v.estado,
        factura: {
          id: v.factura.id,
          numero: v.factura.numero,
          total: v.factura.total,
          estado: v.factura.estado,
          condicionPago: v.factura.condicionPago,
          clienteId: v.factura.clienteId,
          clienteNombre: v.factura.cliente.nombre,
        },
      })
    }
  }

  if (origen === 'TODOS' || origen === 'ALQUILER') {
    const cuotas = await prisma.cuotaAlquiler.findMany({
      where: {
        facturaId: null,
        estado: { in: ['PENDIENTE', 'VENCIDA'] },
        vencimiento: { lte: hasta },
        contrato: { estado: { in: ['ACTIVO', 'SUSPENDIDO'] } },
      },
      include: {
        contrato: {
          select: {
            id: true,
            numero: true,
            clienteId: true,
            cliente: { select: { nombre: true } },
          },
        },
      },
      orderBy: [{ vencimiento: 'asc' }, { periodo: 'asc' }],
    })

    const grupos = new Map<string, typeof cuotas>()
    for (const c of cuotas) {
      const key = `${c.contratoId}:${c.periodo}`
      const arr = grupos.get(key) ?? []
      arr.push(c)
      grupos.set(key, arr)
    }

    for (const [, grupo] of grupos) {
      const first = grupo[0]!
      const vencimiento = grupo.reduce(
        (max, c) => (c.vencimiento > max ? c.vencimiento : max),
        first.vencimiento,
      )
      const peorEstado = grupo.some((c) => c.estado === 'VENCIDA') ? 'VENCIDA' : 'PENDIENTE'

      items.push({
        tipo: 'ALQUILER',
        id: `${first.contratoId}:${first.periodo}`,
        contratoId: first.contratoId,
        contratoNumero: first.contrato.numero,
        periodo: first.periodo,
        fechaVencimiento: vencimiento.toISOString(),
        monto: grupo.reduce((s, c) => s + c.monto, 0),
        cantidadCuotas: grupo.length,
        estado: peorEstado,
        clienteId: first.contrato.clienteId,
        clienteNombre: first.contrato.cliente.nombre,
      })
    }
  }

  items.sort(
    (a, b) => new Date(a.fechaVencimiento).getTime() - new Date(b.fechaVencimiento).getTime(),
  )

  return items.slice(0, 150)
}
