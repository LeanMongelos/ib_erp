import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { registrarEventoOC } from '@/lib/compras/oc-workflow/eventos'
import type { RecepcionItemInput } from '@/lib/compras/recepcionar-oc'

type Db = Prisma.TransactionClient

export async function registrarEventoRecepcionOc(
  ordenCompraId: string,
  ocNumero: string,
  usuarioId: string,
  itemsActualizados: Array<{ id: string; descripcion: string; cantidad: number; cantidadRecibida: number }>,
  recepciones: RecepcionItemInput[],
  totalmenteRecibida: boolean,
  db: Db,
) {
  const payload = {
    items: recepciones.map((rec) => {
      const item = itemsActualizados.find((i) => i.id === rec.id)
      return {
        itemId: rec.id,
        descripcion: item?.descripcion,
        delta: rec.cantidad,
        cantidadRecibida: item?.cantidadRecibida,
        cantidadPedida: item?.cantidad,
      }
    }),
  }

  await registrarEventoOC(
    {
      ordenCompraId,
      tipo: totalmenteRecibida ? 'OC_RECEPCION_COMPLETA' : 'OC_RECEPCION_PARCIAL',
      usuarioId,
      referencia: ocNumero,
      payload,
    },
    db,
  )
}

export async function registrarEventoFcOc(
  ordenCompraId: string | null | undefined,
  fcNumero: string,
  fcId: string,
  total: number,
  tipo: 'OC_FC_REGISTRADA' | 'OC_FC_ANULADA',
  usuarioId: string,
  db: Db = prisma,
) {
  if (!ordenCompraId) return
  await registrarEventoOC(
    {
      ordenCompraId,
      tipo,
      usuarioId,
      referencia: fcNumero,
      payload: { facturaCompraId: fcId, total },
    },
    db,
  )
}

export async function registrarEventoPagoOc(
  ordenCompraId: string | null | undefined,
  pagoId: string,
  monto: number,
  usuarioId: string,
  completo: boolean,
  db: Db = prisma,
) {
  if (!ordenCompraId) return
  await registrarEventoOC(
    {
      ordenCompraId,
      tipo: completo ? 'OC_PAGO_COMPLETO' : 'OC_PAGO_PARCIAL',
      usuarioId,
      referencia: pagoId,
      payload: { monto, pagoProveedorId: pagoId },
    },
    db,
  )
}

export async function saldoApPendienteOc(ordenCompraId: string, db: Db = prisma): Promise<number> {
  const vencimientos = await db.vencimientoPago.findMany({
    where: {
      facturaCompra: { ordenCompraId, estado: 'REGISTRADA' },
      pagado: false,
    },
    select: { saldo: true },
  })
  return vencimientos.reduce((a, v) => a + v.saldo, 0)
}

export async function evaluarPagoCompletoOc(ordenCompraId: string, db: Db = prisma): Promise<boolean> {
  const pendiente = await saldoApPendienteOc(ordenCompraId, db)
  return pendiente <= 0.01
}
