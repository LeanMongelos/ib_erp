import type { Prisma } from '@prisma/client'

export const ocInclude = {
  proveedor: { select: { id: true, razonSocial: true, tipoCompra: true, moneda: true } },
  creadoPor: { select: { id: true, nombre: true } },
  solicitante: { select: { id: true, nombre: true } },
  aprobadoPor: { select: { id: true, nombre: true } },
  rechazadoPor: { select: { id: true, nombre: true } },
  ordenTrabajo: { select: { id: true, numero: true } },
  presupuesto: { select: { id: true, numero: true } },
  cliente: { select: { id: true, nombre: true } },
  depositoDestinoDefault: { select: { id: true, nombre: true, tipo: true } },
  plantillaOc: { select: { id: true, nombre: true } },
  items: {
    include: {
      inventario: { select: { id: true, nombre: true, modoTrazabilidad: true, esSerializado: true } },
      depositoDestino: { select: { id: true, nombre: true } },
    },
  },
} satisfies Prisma.OrdenCompraInclude
