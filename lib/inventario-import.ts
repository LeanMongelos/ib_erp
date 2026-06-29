/**
 * Persistencia de filas importadas desde Excel.
 */
import { prisma } from '@/lib/prisma'
import { registrarMovimientoStock } from '@/lib/inventario'
import type { InventarioImportRow, KitImportRow } from '@/lib/inventario-excel'

export interface ResultadoImportInventario {
  creados: number
  actualizados: number
  kitsCreados: number
  errores: { fila: number; mensaje: string }[]
}

async function resolverAlicuotaId(pct: number | null | undefined): Promise<string | null> {
  if (pct == null) return null
  const alicuota = await prisma.alicuotaIva.findFirst({
    where: { porcentaje: pct, activo: true },
  })
  return alicuota?.id ?? null
}

export async function importarFilasKit(
  filas: KitImportRow[],
  resultado: ResultadoImportInventario,
): Promise<void> {
  for (let i = 0; i < filas.length; i++) {
    const fila = filas[i]
    const n = i + 2
    try {
      const padre = await prisma.inventario.findUnique({ where: { sku: fila.parentSku } })
      if (!padre) {
        resultado.errores.push({ fila: n, mensaje: `Equipo padre SKU ${fila.parentSku} no encontrado` })
        continue
      }
      if (padre.tipoArticulo !== 'EQUIPO') {
        resultado.errores.push({ fila: n, mensaje: `${fila.parentSku} no es tipo EQUIPO` })
        continue
      }

      let hijoId: string | null = null
      if (fila.childSku) {
        const hijo = await prisma.inventario.findUnique({ where: { sku: fila.childSku } })
        hijoId = hijo?.id ?? null
      }

      const existente = await prisma.inventarioKitItem.findFirst({
        where: {
          inventarioPadreId: padre.id,
          nombre: fila.nombre,
          inventarioHijoId: hijoId,
        },
      })

      if (existente) {
        await prisma.inventarioKitItem.update({
          where: { id: existente.id },
          data: {
            cantidad: fila.cantidad,
            tipoItem: fila.tipoItem,
            tipoComponente: fila.tipoComponente ?? null,
            inventarioHijoId: hijoId,
          },
        })
      } else {
        const maxOrden = await prisma.inventarioKitItem.aggregate({
          where: { inventarioPadreId: padre.id },
          _max: { orden: true },
        })
        await prisma.inventarioKitItem.create({
          data: {
            inventarioPadreId: padre.id,
            inventarioHijoId: hijoId,
            nombre: fila.nombre,
            tipoItem: fila.tipoItem,
            tipoComponente: fila.tipoComponente ?? null,
            cantidad: fila.cantidad,
            orden: (maxOrden._max.orden ?? -1) + 1,
          },
        })
      }
      resultado.kitsCreados++
    } catch (e) {
      resultado.errores.push({
        fila: n,
        mensaje: e instanceof Error ? e.message : 'Error desconocido en kit',
      })
    }
  }
}

export async function importarFilasInventario(
  filas: InventarioImportRow[],
  usuarioId?: string,
  kits: KitImportRow[] = [],
): Promise<ResultadoImportInventario> {
  const resultado: ResultadoImportInventario = { creados: 0, actualizados: 0, kitsCreados: 0, errores: [] }

  for (let i = 0; i < filas.length; i++) {
    const fila = filas[i]
    const n = i + 2
    try {
      const alicuotaIvaId = await resolverAlicuotaId(fila.alicuotaIvaPct ?? null)
      const dataBase = {
        nombre: fila.nombre,
        descripcion: fila.descripcion ?? null,
        sku: fila.sku?.trim() || null,
        categoria: fila.categoria ?? null,
        tipoArticulo: fila.tipoArticulo,
        marca: fila.marca ?? null,
        modelo: fila.modelo ?? null,
        esSerializado: fila.esSerializado,
        requierePreventivo: fila.requierePreventivo,
        intervaloPreventivoDias: fila.intervaloPreventivoDias ?? null,
        stockMinimo: fila.stockMinimo,
        stockMaximo: fila.stockMaximo ?? null,
        puntoPedido: fila.puntoPedido ?? null,
        precioUnit: fila.precioUnit ?? null,
        alicuotaIvaId,
        codigoBarras: fila.codigoBarras ?? null,
        sinonimo: fila.sinonimo ?? null,
        descuentoPct: fila.descuentoPct ?? 0,
        perfil: fila.perfil ?? null,
        archivoRef: fila.archivoRef ?? null,
        activo: fila.activo ?? true,
      }

      if (fila.sku) {
        const existente = await prisma.inventario.findUnique({ where: { sku: fila.sku } })
        if (existente) {
          const stockAnterior = existente.stock
          await prisma.inventario.update({
            where: { id: existente.id },
            data: dataBase,
          })
          if (fila.stock !== stockAnterior) {
            const delta = fila.stock - stockAnterior
            await registrarMovimientoStock({
              inventarioId: existente.id,
              tipo: delta >= 0 ? 'ENTRADA' : 'SALIDA',
              cantidad: Math.abs(delta),
              motivo: 'Ajuste por importación Excel',
              referencia: `import:${fila.sku}`,
              usuarioId,
            })
          }
          resultado.actualizados++
          continue
        }
      }

      const creado = await prisma.inventario.create({
        data: { ...dataBase, stock: 0 },
      })
      if (fila.stock > 0) {
        await registrarMovimientoStock({
          inventarioId: creado.id,
          tipo: 'ENTRADA',
          cantidad: fila.stock,
          motivo: 'Stock inicial — importación Excel',
          referencia: `import:${creado.id}`,
          usuarioId,
        })
      }
      resultado.creados++
    } catch (e) {
      resultado.errores.push({
        fila: n,
        mensaje: e instanceof Error ? e.message : 'Error desconocido',
      })
    }
  }

  if (kits.length > 0) {
    await importarFilasKit(kits, resultado)
  }

  return resultado
}
