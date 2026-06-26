/**
 * Creación de OT con soporte para equipo existente o alta manual (MANUAL_ST).
 */
import { addHours } from 'date-fns'
import { prisma } from '@/lib/prisma'
import { ApiError } from '@/lib/api-auth'
import { otCreateSchema } from '@/lib/validation'
import { siguienteNumeroOT, crearConNumeroUnico } from '@/lib/sequences'
import { crearEquipoCliente } from '@/lib/equipos/crear-equipo-cliente'
import type { z } from 'zod'

export type OtCreateInput = z.infer<typeof otCreateSchema>

export async function crearOrdenTrabajo(
  input: OtCreateInput,
  opts?: { notaHistorial?: string; usuarioId?: string | null },
) {
  const data = otCreateSchema.parse(input)
  const slaVence = addHours(new Date(), data.slaHoras)

  return prisma.$transaction(async (tx) => {
    let equipoId: string | null = null

    if (data.equipoId) {
      const equipo = await tx.equipo.findFirst({
        where: { id: data.equipoId, clienteId: data.clienteId },
        select: { id: true },
      })
      if (!equipo) throw new ApiError(400, 'El equipo seleccionado no pertenece al cliente')
      equipoId = equipo.id
    } else if (data.equipoNuevo) {
      const equipo = await crearEquipoCliente(
        data.clienteId,
        data.equipoNuevo,
        { origen: 'MANUAL_ST', usuarioId: opts?.usuarioId },
        tx,
      )
      equipoId = equipo.id
    }

    return crearConNumeroUnico(siguienteNumeroOT, (numero) =>
      tx.ordenTrabajo.create({
        data: {
          numero,
          tipo: data.tipo,
          descripcion: data.descripcion,
          clienteId: data.clienteId,
          equipoId,
          tecnicoId: data.tecnicoId ?? null,
          prioridad: data.prioridad,
          slaHoras: data.slaHoras,
          slaVence,
          estado: 'ABIERTA',
          historial: {
            create: { estado: 'ABIERTA', nota: opts?.notaHistorial ?? 'OT creada' },
          },
        },
        include: { cliente: true, equipo: true, tecnico: true },
      }),
    )
  })
}
