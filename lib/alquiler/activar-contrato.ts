import { prisma } from '@/lib/prisma'
import { calcularVencimientoCuota, formatPeriodo } from '@/lib/alquiler/periodo'
import { resolverUbicacionLineaAlquiler } from '@/lib/alquiler/resolver-ubicacion-linea'
import { aplicarKitYPreventivoEquipo } from '@/lib/equipos/aplicar-kit-preventivo-equipo'
import { crearAsignacionEquipo } from '@/lib/equipos/asignaciones'

export async function activarContratoAlquiler(contratoId: string, usuarioId?: string | null) {
  return prisma.$transaction(async (tx) => {
    const contrato = await tx.contratoAlquiler.findUniqueOrThrow({
      where: { id: contratoId },
      include: {
        cliente: {
          select: {
            lat: true,
            lng: true,
            sucursales: {
              where: { activo: true, lat: { not: null }, lng: { not: null } },
              orderBy: { creadoEn: 'asc' },
              take: 3,
              select: { lat: true, lng: true, nombre: true },
            },
          },
        },
        lineas: {
          where: { activa: true },
          include: {
            inventarioUnidad: {
              include: {
                inventario: {
                  include: {
                    kitComoEquipo: { orderBy: { orden: 'asc' }, include: { hijo: true } },
                  },
                },
                equipo: true,
              },
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

      const inv = unidad.inventario
      if (inv.tipoArticulo !== 'ALQUILER') {
        throw new Error(`«${inv.nombre}» no es producto de alquiler (tipo ALQUILER / código ALQ*)`)
      }

      const ubicacion = await resolverUbicacionLineaAlquiler(linea, contrato.cliente)
      const { lat, lng } = ubicacion

      if (linea.lat !== lat || linea.lng !== lng) {
        await tx.lineaAlquiler.update({
          where: { id: linea.id },
          data: { lat, lng },
        })
      }

      let equipoId = linea.equipoId ?? unidad.equipoId

      if (equipoId) {
        await tx.equipo.update({
          where: { id: equipoId },
          data: {
            clienteId: contrato.clienteId,
            origen: 'ALQUILER',
            ubicacionLat: lat,
            ubicacionLng: lng,
            direccionUbicacion: linea.domicilio ?? undefined,
            contactoResponsable: linea.beneficiarioNombre ?? undefined,
            fechaInstalacion: linea.fechaEntrega ?? fechaInicio,
          },
        })
        await crearAsignacionEquipo(
          {
            equipoId,
            clienteId: contrato.clienteId,
            tipo: 'ALQUILER',
            vigenciaDesde: linea.fechaEntrega ?? fechaInicio,
            lineaAlquilerId: linea.id,
            motivo: `Contrato ${contrato.numero}`,
            usuarioId,
          },
          tx,
        )
      } else {
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

        await aplicarKitYPreventivoEquipo({
          db: tx,
          equipoId: nuevoEquipo.id,
          clienteId: contrato.clienteId,
          inventario: inv,
          referencia: `contrato alquiler ${contrato.numero}`,
          fechaBase: linea.fechaEntrega ?? fechaInicio,
        })

        await tx.historiaClinicaEntrada.create({
          data: {
            equipoId: nuevoEquipo.id,
            tipo: 'INSTALACION',
            titulo: `Equipo en alquiler — ${contrato.numero}`,
            contenido: `Alta desde parque ALQ${unidad.numeroSerie ? ` · Serie ${unidad.numeroSerie}` : ''}`,
            referenciaId: contrato.id,
            usuarioId: usuarioId ?? null,
          },
        })

        await tx.inventarioUnidad.update({
          where: { id: unidad.id },
          data: { equipoId: nuevoEquipo.id },
        })
        await tx.lineaAlquiler.update({
          where: { id: linea.id },
          data: { equipoId: nuevoEquipo.id },
        })

        await crearAsignacionEquipo(
          {
            equipoId: nuevoEquipo.id,
            clienteId: contrato.clienteId,
            tipo: 'ALQUILER',
            vigenciaDesde: linea.fechaEntrega ?? fechaInicio,
            lineaAlquilerId: linea.id,
            motivo: `Contrato ${contrato.numero}`,
            usuarioId,
            reemplazarActiva: false,
          },
          tx,
        )
      }

      await tx.inventarioUnidad.update({
        where: { id: unidad.id },
        data: { estado: 'EN_ALQUILER' },
      })

      const notaFuente =
        ubicacion.fuente === 'linea_guardada'
          ? 'ubicación confirmada en contrato'
          : ubicacion.fuente === 'geocodificacion_domicilio'
            ? 'geocodificación domicilio'
            : ubicacion.fuente === 'geocodificacion_localidad'
              ? 'geocodificación localidad (aprox.)'
              : ubicacion.fuente === 'sucursal_cliente'
                ? 'sucursal del cliente (aprox.)'
                : ubicacion.fuente === 'cliente'
                  ? 'ubicación del cliente (aprox.)'
                  : 'depósito IB (revisar domicilio)'

      await tx.eventoTracking.create({
        data: {
          equipoId: equipoId!,
          tipo: 'INSTALADO',
          lat,
          lng,
          direccion: linea.domicilio,
          nota: `Alquiler activo — ${linea.beneficiarioNombre ?? 'N/D'} · ${notaFuente}`,
          usuarioId: usuarioId ?? null,
        },
      })

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
