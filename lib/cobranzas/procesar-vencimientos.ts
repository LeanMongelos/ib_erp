import { prisma } from '@/lib/prisma'
import type { EstadoFactura } from '@prisma/client'
import { enviarAvisoVencimiento } from '@/lib/cobranzas/notify-vencimiento'

const ESTADOS_FACTURA_COBRABLE: EstadoFactura[] = [
  'BORRADOR',
  'PENDIENTE',
  'PENDIENTE_CAE',
  'EMITIDA',
  'VENCIDA',
  'RECHAZADA',
]

/** Revisa vencimientos del día y envía avisos a cobranzas (Guillermo + Lucas). */
export async function procesarVencimientosDelDia(): Promise<{ enviados: number; revisados: number }> {
  const ahora = new Date()

  const pendientes = await prisma.vencimientoCobranza.findMany({
    where: {
      estado: 'PENDIENTE',
      fechaVencimiento: { lte: ahora },
      factura: { estado: { in: ESTADOS_FACTURA_COBRABLE } },
    },
    include: {
      factura: {
        include: { cliente: { select: { nombre: true } } },
      },
    },
    orderBy: [{ fechaVencimiento: 'asc' }, { numeroCuota: 'asc' }],
  })

  let enviados = 0
  for (const v of pendientes) {
    const ok = await enviarAvisoVencimiento(v)
    if (ok) {
      await prisma.vencimientoCobranza.update({
        where: { id: v.id },
        data: { estado: 'AVISO_ENVIADO', avisoEnviadoEn: new Date() },
      })
      enviados++
      console.log(
        `[cobranzas] Aviso enviado — ${v.factura.numero} cuota ${v.numeroCuota} (día ${v.diasDesdeEmision})`,
      )
    } else {
      console.warn(
        `[cobranzas] No se pudo enviar aviso — ${v.factura.numero} cuota ${v.numeroCuota}`,
      )
    }
  }

  return { enviados, revisados: pendientes.length }
}
