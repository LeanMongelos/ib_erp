import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission, handleApiError, ApiError } from '@/lib/api-auth'
import { pagoCreateSchema } from '@/lib/validation'
import { plain } from '@/lib/serialize'
import { registrarAuditoria, getIp } from '@/lib/audit'
import { imputarPagoAVencimientos } from '@/lib/cobranzas/vencimientos'
import { sincronizarCuotasAlquilerFacturaPagada } from '@/lib/alquiler/sincronizar-cuota-cobrada'
import { crearChequeConPago } from '@/lib/cobranzas/cheques'
import { validarImputacionesContraFacturas } from '@/lib/cobranzas/validar-pago'
import { registrarIngresoDesdePago } from '@/lib/tesoreria/registrar-ingreso-pago'
import { resolverCuentaTesoreriaParaPago } from '@/lib/tesoreria/cuenta-default'

export async function GET() {
  try {
    await requirePermission('cobranzas.read')
    const pagos = await prisma.pago.findMany({
      where: { anuladoEn: null },
      orderBy: { fecha: 'desc' },
      include: {
        cliente: { select: { nombre: true } },
        imputaciones: {
          include: { factura: { select: { numero: true, total: true } } },
        },
      },
    })
    return NextResponse.json(plain(pagos))
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requirePermission('cobranzas.register_payment')
    const data = pagoCreateSchema.parse(await req.json())

    if (data.medio === 'CHEQUE') {
      await requirePermission('cobranzas.cheques.manage')
    }

    const montoImputado = data.imputaciones.reduce((a, i) => a + i.monto, 0)
    if (Math.abs(montoImputado - data.monto) > 0.01) {
      throw new ApiError(400, 'La suma de imputaciones debe coincidir con el monto del pago')
    }

    const facturaIds = data.imputaciones.map((i) => i.facturaId)
    const facturas = await prisma.factura.findMany({
      where: { id: { in: facturaIds }, clienteId: data.clienteId },
      include: {
        pagos: {
          where: { pago: { anuladoEn: null } },
          select: { monto: true },
        },
      },
    })
    if (facturas.length !== facturaIds.length) {
      throw new ApiError(400, 'Una o más facturas no pertenecen al cliente')
    }

    validarImputacionesContraFacturas(facturas, data.imputaciones)

    if (data.medio !== 'CHEQUE' && data.cuentaTesoreriaId) {
      await resolverCuentaTesoreriaParaPago(data.medio, data.cuentaTesoreriaId)
    }

    const pago = await prisma.$transaction(async (tx) => {
      if (data.medio === 'CHEQUE' && data.cheque) {
        const fechaVenc = new Date(data.cheque.fechaVencimiento)
        if (Number.isNaN(fechaVenc.getTime())) {
          throw new ApiError(400, 'Fecha de vencimiento del cheque inválida')
        }
        return crearChequeConPago(
          {
            clienteId: data.clienteId,
            monto: data.monto,
            referencia: data.referencia,
            notas: data.notas,
            imputaciones: data.imputaciones,
            cheque: {
              numero: data.cheque.numero,
              banco: data.cheque.banco,
              titular: data.cheque.titular,
              fechaVencimiento: fechaVenc,
            },
          },
          tx,
        )
      }

      const nuevo = await tx.pago.create({
        data: {
          clienteId: data.clienteId,
          monto: data.monto,
          medio: data.medio,
          referencia: data.referencia ?? null,
          notas: data.notas ?? null,
          cuentaTesoreriaId: data.medio !== 'CHEQUE' ? data.cuentaTesoreriaId ?? null : null,
          imputaciones: {
            create: data.imputaciones.map((i) => ({
              facturaId: i.facturaId,
              monto: i.monto,
            })),
          },
        },
        include: {
          cliente: true,
          imputaciones: { include: { factura: true } },
        },
      })

      for (const imp of data.imputaciones) {
        const factura = facturas.find((f) => f.id === imp.facturaId)!
        const pagadoPrevio = factura.pagos.reduce((a, p) => a + Number(p.monto), 0)
        const pagadoTotal = pagadoPrevio + imp.monto

        await imputarPagoAVencimientos(imp.facturaId, imp.monto, tx)

        if (pagadoTotal >= Number(factura.total) - 0.01) {
          await tx.factura.update({
            where: { id: imp.facturaId },
            data: { estado: 'PAGADA', fechaPago: new Date() },
          })
          await sincronizarCuotasAlquilerFacturaPagada(imp.facturaId, tx)
        }
      }

      if (data.medio !== 'CHEQUE') {
        await registrarIngresoDesdePago(nuevo.id, actor.id, tx, data.cuentaTesoreriaId)
      }

      return nuevo
    })

    await registrarAuditoria({
      usuarioId: actor.id,
      accion: data.medio === 'CHEQUE' ? 'cheque.register' : 'cobranza.register',
      entidad: 'Pago',
      entidadId: pago.id,
      ip: getIp(req),
    })

    return NextResponse.json(plain(pago), { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
