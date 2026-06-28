import { prisma } from '@/lib/prisma'
import { geocodificarDireccion } from '@/lib/geocoding'
import { calcularVencimientoCuota, formatPeriodo } from '@/lib/alquiler/periodo'

export async function activarContratoAlquiler(contratoId: string, usuarioId?: string | null) {
  return prisma.$transaction(async (tx) => {
    const contrato = await tx.contratoAlquiler.findUniqueOrThrow({
      where: { id: contratoId },
      include: {
        lineas: {
          where: { activa: true },
          include: {
            inventarioUnidad: {
              include: { inventario: true, equipo: true },
            },
          },
        },
      },
    })

    if (contrato.estado !== 'BORRADOR') {
      throw new Error('Solo se pueden activar contratos en borrador')
    }
    if (contrato.lineas.length === 0) {
      throw new Error('El contrato debe tener al menos una línea activa')
    }

    const fechaInicio = contrato.fechaInicio ?? new Date()
    const periodo = formatPeriodo(fechaInicio)
    const vencimiento = calcularVencimientoCuota(fechaInicio, contrato.diaFacturacion)

    for (const linea of contrato.lineas) {
      const unidad = linea.inventarioUnidad
      if (!['EN_STOCK', 'RESERVADO'].includes(unidad.estado)) {
        const serie = unidad.numeroSerie ?? unidad.id.slice(-6)
        throw new Error(`La unidad ${serie} no está disponible (${unidad.estado})`)
      }

      const enOtroContrato = await tx.lineaAlquiler.findFirst({
        where: {
          inventarioUnidadId: unidad.id,
          activa: true,
          contrato: { estado: { in: ['ACTIVO', 'SUSPENDIDO'] } },
        },
      })
      if (enOtroContrato) {
        const serie = unidad.numeroSerie ?? unidad.id.slice(-6)
        throw new Error(`La unidad ${serie} ya está en un contrato activo`)
      }

      let lat = linea.lat
      let lng = linea.lng
      if (lat == null || lng == null) {
        const geo = await geocodificarDireccion(linea.domicilio, linea.localidad)
        if (geo) {
          lat = geo.lat
          lng = geo.lng
          await tx.lineaAlquiler.update({
            where: { id: linea.id },
            data: { lat, lng },
          })
        }
      }

      let equipoId = linea.equipoId ?? unidad.equipoId

      if (equipoId) {
        await tx.equipo.update({
          where: { id: equipoId },
          data: {
            clienteId: contrato.clienteId,
            origen: 'ALQUILER',
            ubicacionLat: lat ?? undefined,
            ubicacionLng: lng ?? undefined,
            direccionUbicacion: linea.domicilio ?? undefined,
            contactoResponsable: linea.beneficiarioNombre ?? undefined,
            fechaInstalacion: linea.fechaEntrega ?? fechaInicio,
          },
        })
      } else {
        const inv = unidad.inventario
        const nuevoEquipo = await tx.equipo.create({
          data: {
            nombre: inv.nombre,
            marca: inv.marca,
            modelo: inv.modelo,
            numeroSerie: unidad.numeroSerie,
            clienteId: contrato.clienteId,
            origen: 'ALQUILER',
            inventarioId: inv.id,
            ubicacionLat: lat,
            ubicacionLng: lng,
            direccionUbicacion: linea.domicilio,
            contactoResponsable: linea.beneficiarioNombre,
            fechaInstalacion: linea.fechaEntrega ?? fechaInicio,
          },
        })
        equipoId = nuevoEquipo.id
        await tx.inventarioUnidad.update({
          where: { id: unidad.id },
          data: { equipoId: nuevoEquipo.id },
        })
        await tx.lineaAlquiler.update({
          where: { id: linea.id },
          data: { equipoId: nuevoEquipo.id },
        })
      }

      await tx.inventarioUnidad.update({
        where: { id: unidad.id },
        data: { estado: 'EN_ALQUILER' },
      })

      if (lat != null && lng != null && equipoId) {
        await tx.eventoTracking.create({
          data: {
            equipoId,
            tipo: 'INSTALADO',
            lat,
            lng,
            direccion: linea.domicilio,
            nota: `Alquiler activo — beneficiario: ${linea.beneficiarioNombre ?? 'N/D'}`,
            usuarioId: usuarioId ?? null,
          },
        })
      }

      const cuotaExistente = await tx.cuotaAlquiler.findUnique({
        where: { lineaId_periodo: { lineaId: linea.id, periodo } },
      })
      if (!cuotaExistente) {
        await tx.cuotaAlquiler.create({
          data: {
            contratoId: contrato.id,
            lineaId: linea.id,
            periodo,
            monto: linea.montoMensual,
            vencimiento,
            estado: 'PENDIENTE',
          },
        })
      }
    }

    return tx.contratoAlquiler.update({
      where: { id: contratoId },
      data: {
        estado: 'ACTIVO',
        fechaInicio,
      },
      include: {
        cliente: { select: { id: true, nombre: true } },
        lineas: {
          include: {
            inventarioUnidad: {
              select: { id: true, numeroSerie: true, estado: true },
            },
            equipo: { select: { id: true, nombre: true, numeroSerie: true } },
          },
        },
        cuotas: true,
      },
    })
  })
}
