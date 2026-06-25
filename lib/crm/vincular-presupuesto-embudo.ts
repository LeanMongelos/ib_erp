import { prisma } from '@/lib/prisma'
import { ApiError } from '@/lib/api-auth'
import { registrarEventoEmbudo } from '@/lib/crm/embudo-historial'

/** Vincula un presupuesto creado manualmente al negocio del embudo. */
export async function vincularPresupuestoNegocioEmbudo(
  negocioId: string,
  presupuestoId: string,
  usuarioId?: string,
) {
  const [negocio, presupuesto] = await Promise.all([
    prisma.negocioEmbudo.findUnique({ where: { id: negocioId } }),
    prisma.presupuesto.findUnique({
      where: { id: presupuestoId },
      select: { id: true, numero: true, clienteId: true, total: true },
    }),
  ])
  if (!negocio) throw new ApiError(404, 'Negocio no encontrado')
  if (!negocio.activo) throw new ApiError(400, 'El negocio no está activo')
  if (!presupuesto) throw new ApiError(404, 'Presupuesto no encontrado')
  if (negocio.presupuestoId && negocio.presupuestoId !== presupuestoId) {
    throw new ApiError(400, 'El negocio ya tiene otro presupuesto vinculado')
  }
  if (negocio.clienteId && negocio.clienteId !== presupuesto.clienteId) {
    throw new ApiError(400, 'El presupuesto pertenece a otro cliente')
  }

  await prisma.negocioEmbudo.update({
    where: { id: negocioId },
    data: {
      presupuestoId,
      clienteId: negocio.clienteId ?? presupuesto.clienteId,
      monto: negocio.monto > 0 ? negocio.monto : presupuesto.total,
    },
  })

  if (!negocio.presupuestoId) {
    await registrarEventoEmbudo({
      negocioId,
      tipo: 'EDICION',
      etapaDesde: negocio.etapa,
      datos: { presupuestoId, numeroPresupuesto: presupuesto.numero, vinculadoManual: true },
      notas: `Presupuesto ${presupuesto.numero} vinculado`,
      usuarioId: usuarioId ?? null,
    })
  }
}
