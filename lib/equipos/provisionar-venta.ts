/**
 * Al emitir / entregar una factura: crea Equipo en cliente, kit clínico y preventivo programado.
 */
import { addDays, addMonths } from 'date-fns'
import { prisma } from '@/lib/prisma'
import { registrarMovimientoStock } from '@/lib/inventario'
import { marcarUnidadVendida, trazabilidadActiva } from '@/lib/inventario/unidades'
import { crearConNumeroUnico, siguienteNumeroOT } from '@/lib/sequences'
import { registrarEntradaHistoria } from '@/lib/equipos/historia-clinica'
import { registrarCicloInstalacionDesdeVenta } from '@/lib/tracking-automation'
import { geocodificarClientePorId } from '@/lib/clientes/geocodificar-cliente'
import type { TipoComponenteEquipo, TipoItemKitEquipo } from '@prisma/client'

export interface ResultadoProvisionVenta {
  equiposCreados: number
  planesCreados: number
  otsCreadas: number
  errores: string[]
}

function mapTipoComponente(tipoItem: TipoItemKitEquipo, explicito?: TipoComponenteEquipo | null): TipoComponenteEquipo {
  if (explicito) return explicito
  if (tipoItem === 'BATERIA') return 'BATERIA'
  if (tipoItem === 'COMPONENTE') return 'OTRO'
  return 'OTRO'
}

export async function provisionarEquiposDesdeFactura(
  facturaId: string,
  usuarioId?: string,
): Promise<ResultadoProvisionVenta> {
  const resultado: ResultadoProvisionVenta = {
    equiposCreados: 0,
    planesCreados: 0,
    otsCreadas: 0,
    errores: [],
  }

  const factura = await prisma.factura.findUnique({
    where: { id: facturaId },
    include: {
      cliente: true,
      items: {
        include: {
          inventarioUnidad: true,
          inventario: {
            include: {
              kitComoEquipo: { orderBy: { orden: 'asc' }, include: { hijo: true } },
            },
          },
        },
      },
    },
  })

  if (!factura) throw new Error('Factura no encontrada')

  await geocodificarClientePorId(factura.clienteId).catch(() => null)

  for (const item of factura.items) {
    const cat = item.inventario
    if (!cat || cat.tipoArticulo !== 'EQUIPO') continue
    if (item.equipoGeneradoId) continue

    if (item.cantidad !== 1) {
      resultado.errores.push(`«${item.descripcion}»: los equipos deben facturarse con cantidad 1 por unidad/serie`)
      continue
    }

    if (cat.esSerializado && !item.numeroSerie?.trim() && !item.inventarioUnidadId) {
      resultado.errores.push(`«${item.descripcion}»: falta número de serie en la línea de factura`)
      continue
    }

    if (trazabilidadActiva(cat.modoTrazabilidad) && !item.inventarioUnidadId) {
      resultado.errores.push(`«${item.descripcion}»: falta unidad de inventario (serie/lote)`)
      continue
    }

    try {
      let numeroSerie = item.numeroSerie?.trim() || item.inventarioUnidad?.numeroSerie?.trim() || null
      if (numeroSerie) {
        const dup = await prisma.equipo.findUnique({ where: { numeroSerie } })
        if (dup) {
          resultado.errores.push(`Serie ${numeroSerie} ya registrada en otro equipo`)
          continue
        }
      }

      const intervalo = cat.intervaloPreventivoDias ?? 180
      const proximoPreventivo = item.proximoPreventivo ?? addDays(new Date(), intervalo)

      let sucursalInstalacion: { id: string; nombre: string; direccion: string | null; ciudad: string | null } | null = null
      if (item.sucursalInstalacionId) {
        sucursalInstalacion = await prisma.clienteSucursal.findFirst({
          where: { id: item.sucursalInstalacionId, clienteId: factura.clienteId, activo: true },
          select: { id: true, nombre: true, direccion: true, ciudad: true },
        })
      }

      const etiquetaSucursal = sucursalInstalacion
        ? [sucursalInstalacion.nombre, sucursalInstalacion.direccion, sucursalInstalacion.ciudad].filter(Boolean).join(' · ')
        : null

      const equipo = await prisma.equipo.create({
        data: {
          nombre: cat.nombre,
          marca: cat.marca,
          modelo: cat.modelo,
          numeroSerie,
          clienteId: factura.clienteId,
          sucursalId: sucursalInstalacion?.id ?? null,
          direccionUbicacion: etiquetaSucursal,
          fechaInstalacion: new Date(),
          referenciaCompra: factura.numero,
          instaladoPorUsuarioId: usuarioId ?? null,
          inventarioId: cat.id,
          origen: 'VENTA',
          estado: 'ACTIVO',
        },
      })

      if (sucursalInstalacion) {
        const { geocodificarSucursalPorId } = await import('@/lib/equipos/resolver-ubicacion-equipo')
        await geocodificarSucursalPorId(sucursalInstalacion.id).catch(() => null)
      }

      for (const k of cat.kitComoEquipo) {
        if (k.tipoItem === 'BATERIA' || k.tipoItem === 'COMPONENTE') {
          const venceEn = k.mesesVencimiento ? addMonths(new Date(), k.mesesVencimiento) : null
          await prisma.equipoComponente.create({
            data: {
              equipoId: equipo.id,
              tipo: mapTipoComponente(k.tipoItem, k.tipoComponente),
              descripcion: k.nombre,
              numeroSerie: k.hijo?.sku ?? null,
              instaladoEn: new Date(),
              venceEn,
              notas: k.notas,
            },
          })
        } else {
          await prisma.equipoAccesorio.create({
            data: {
              equipoId: equipo.id,
              nombre: k.nombre,
              inventarioId: k.inventarioHijoId,
              cantidad: k.cantidad,
              obligatorio: k.obligatorio,
              notas: k.notas ?? (k.tipoItem === 'ACCESORIO_ESPECIFICO' ? 'Accesorio específico del equipo' : 'Accesorio genérico'),
            },
          })
        }
      }

      if (cat.requierePreventivo) {
        await prisma.planMantenimiento.create({
          data: {
            equipoId: equipo.id,
            descripcion: `Preventivo — ${cat.nombre}${cat.marca ? ` ${cat.marca}` : ''}`,
            intervaloDias: intervalo,
            proximoServicio: proximoPreventivo,
            estado: 'PROGRAMADO',
            notas: `Generado automáticamente desde factura ${factura.numero}`,
          },
        })
        resultado.planesCreados++

        await crearConNumeroUnico(siguienteNumeroOT, (numero) =>
          prisma.ordenTrabajo.create({
            data: {
              numero,
              tipo: 'PREVENTIVO',
              descripcion: `Mantenimiento preventivo programado — ${equipo.nombre}`,
              clienteId: factura.clienteId,
              equipoId: equipo.id,
              estado: 'ABIERTA',
              prioridad: 'NORMAL',
              slaHoras: 168,
              slaVence: addDays(proximoPreventivo, 7),
              historial: {
                create: {
                  estado: 'ABIERTA',
                  nota: `OT preventiva generada por venta (factura ${factura.numero}). Fecha objetivo: ${proximoPreventivo.toISOString().slice(0, 10)}`,
                },
              },
            },
          }),
        )
        resultado.otsCreadas++
      }

      await registrarEntradaHistoria(equipo.id, {
        tipo: 'INSTALACION',
        titulo: `Equipo vendido — factura ${factura.numero}`,
        contenido: `Alta automática desde inventario${numeroSerie ? ` · Serie ${numeroSerie}` : ''}`,
        referenciaId: factura.id,
        usuarioId,
      })

      await registrarCicloInstalacionDesdeVenta({
        equipoId: equipo.id,
        clienteId: factura.clienteId,
        usuarioId,
        referencia: `factura ${factura.numero}`,
        fechaBase: new Date(),
      }).catch(() => null)

      if (item.inventarioUnidadId) {
        await marcarUnidadVendida(item.inventarioUnidadId, { equipoId: equipo.id })
      } else if (cat.stock > 0 && !trazabilidadActiva(cat.modoTrazabilidad)) {
        await registrarMovimientoStock({
          inventarioId: cat.id,
          tipo: 'SALIDA',
          cantidad: 1,
          motivo: `Venta factura ${factura.numero}`,
          referencia: `factura:${factura.id}:item:${item.id}`,
          usuarioId,
        })
      }

      await prisma.itemFactura.update({
        where: { id: item.id },
        data: { equipoGeneradoId: equipo.id },
      })

      resultado.equiposCreados++
    } catch (e) {
      resultado.errores.push(e instanceof Error ? e.message : `Error en «${item.descripcion}»`)
    }
  }

  return resultado
}
