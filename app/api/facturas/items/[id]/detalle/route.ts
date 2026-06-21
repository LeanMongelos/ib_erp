import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission, handleApiError, ApiError } from '@/lib/api-auth'
import { plain } from '@/lib/serialize'

/** Detalle de ítem facturado para historial CRM (producto + kit + equipo instalado). */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission('crm.read', 'clientes.read', 'inventario.read')
    const { id } = await params

    const item = await prisma.itemFactura.findUnique({
      where: { id },
      include: {
        factura: {
          select: {
            id: true,
            numero: true,
            fechaEmision: true,
            moneda: true,
            clienteId: true,
            cliente: { select: { id: true, nombre: true } },
          },
        },
        inventario: {
          include: {
            alicuotaIva: { select: { porcentaje: true, nombre: true } },
            kitComoEquipo: {
              orderBy: { orden: 'asc' },
              include: {
                hijo: {
                  select: {
                    id: true,
                    nombre: true,
                    sku: true,
                    categoria: true,
                    tipoArticulo: true,
                  },
                },
              },
            },
          },
        },
        equipoGenerado: {
          include: {
            sucursal: { select: { id: true, nombre: true, ciudad: true } },
            accesorios: {
              orderBy: { nombre: 'asc' },
              include: {
                inventario: { select: { id: true, nombre: true, sku: true, categoria: true } },
              },
            },
            componentes: {
              where: { activo: true },
              orderBy: { venceEn: 'asc' },
            },
          },
        },
        sucursalInstalacion: { select: { id: true, nombre: true, ciudad: true } },
      },
    })

    if (!item) throw new ApiError(404, 'Ítem no encontrado')

    return NextResponse.json(plain({
      item: {
        id: item.id,
        descripcion: item.descripcion,
        descripcionLarga: item.descripcionLarga,
        codigo: item.codigo,
        cantidad: item.cantidad,
        precioUnit: Number(item.precioUnit),
        subtotal: Number(item.subtotal),
        numeroSerie: item.numeroSerie,
        proximoPreventivo: item.proximoPreventivo,
        factura: {
          id: item.factura.id,
          numero: item.factura.numero,
          fechaEmision: item.factura.fechaEmision,
          moneda: item.factura.moneda ?? 'ARS',
          cliente: item.factura.cliente,
        },
        sucursalInstalacion: item.sucursalInstalacion,
      },
      inventario: item.inventario
        ? {
            id: item.inventario.id,
            nombre: item.inventario.nombre,
            sku: item.inventario.sku,
            tipoArticulo: item.inventario.tipoArticulo,
            marca: item.inventario.marca,
            modelo: item.inventario.modelo,
            descripcion: item.inventario.descripcion,
            categoria: item.inventario.categoria,
            precioUnit: item.inventario.precioUnit,
            moneda: item.inventario.moneda ?? 'ARS',
            stock: item.inventario.stock,
            esSerializado: item.inventario.esSerializado,
            requierePreventivo: item.inventario.requierePreventivo,
            intervaloPreventivoDias: item.inventario.intervaloPreventivoDias,
            alicuotaIva: item.inventario.alicuotaIva,
            kit: item.inventario.kitComoEquipo.map((k) => ({
              id: k.id,
              nombre: k.nombre,
              tipoItem: k.tipoItem,
              tipoComponente: k.tipoComponente,
              cantidad: k.cantidad,
              obligatorio: k.obligatorio,
              mesesVencimiento: k.mesesVencimiento,
              notas: k.notas,
              hijo: k.hijo,
            })),
          }
        : null,
      equipo: item.equipoGenerado
        ? {
            id: item.equipoGenerado.id,
            nombre: item.equipoGenerado.nombre,
            marca: item.equipoGenerado.marca,
            modelo: item.equipoGenerado.modelo,
            modeloExacto: item.equipoGenerado.modeloExacto,
            numeroSerie: item.equipoGenerado.numeroSerie,
            codigoInterno: item.equipoGenerado.codigoInterno,
            estado: item.equipoGenerado.estado,
            garantiaHasta: item.equipoGenerado.garantiaHasta,
            fechaInstalacion: item.equipoGenerado.fechaInstalacion,
            pisoSala: item.equipoGenerado.pisoSala,
            contactoResponsable: item.equipoGenerado.contactoResponsable,
            notasTecnicas: item.equipoGenerado.notasTecnicas,
            firmwareVersion: item.equipoGenerado.firmwareVersion,
            softwareVersion: item.equipoGenerado.softwareVersion,
            direccionUbicacion: item.equipoGenerado.direccionUbicacion,
            sucursal: item.equipoGenerado.sucursal,
            accesorios: item.equipoGenerado.accesorios.map((a) => ({
              id: a.id,
              nombre: a.nombre,
              cantidad: a.cantidad,
              obligatorio: a.obligatorio,
              notas: a.notas,
              inventario: a.inventario,
            })),
            componentes: item.equipoGenerado.componentes.map((c) => ({
              id: c.id,
              tipo: c.tipo,
              descripcion: c.descripcion,
              numeroSerie: c.numeroSerie,
              instaladoEn: c.instaladoEn,
              venceEn: c.venceEn,
              notas: c.notas,
            })),
          }
        : null,
    }))
  } catch (error) {
    return handleApiError(error)
  }
}
