/**
 * Emisión mínima de remito PDF (sin entidad Remito en BD).
 */

import { prisma } from '@/lib/prisma'
import { ApiError } from '@/lib/api-auth'
import { claveRemito, reservarSiguienteNumero } from '@/lib/numeracion'
import { getPlantillaConfig } from '@/lib/plantillas/build-datos'
import { renderDocumentoPDF } from '@/lib/plantillas/render-documento'
import {
  buildDatosRemitoDesdeFactura,
  buildDatosRemitoDesdeOT,
} from '@/lib/remitos/build-datos'

async function emisorPredeterminado() {
  const emisor = await prisma.emisor.findFirst({ where: { predeterminado: true, activo: true } })
  if (!emisor) throw new ApiError(400, 'No hay emisor predeterminado configurado')
  return emisor
}

export async function emitirRemitoDesdeOT(otId: string, opts?: { preview?: boolean }) {
  const ot = await prisma.ordenTrabajo.findUnique({
    where: { id: otId },
    include: {
      cliente: true,
      repuestos: {
        include: { inventario: { select: { sku: true } } },
      },
    },
  })
  if (!ot) throw new ApiError(404, 'Orden de trabajo no encontrada')

  const emisor = await emisorPredeterminado()
  const numero = opts?.preview
    ? `PREVIEW-${ot.numero}`
    : await reservarSiguienteNumero(claveRemito())

  const datos = buildDatosRemitoDesdeOT(
    numero,
    ot,
    emisor,
    {
      nombre: ot.cliente.nombre,
      direccion: [ot.cliente.direccion, ot.cliente.ciudad].filter(Boolean).join(', ') || null,
      cuit: ot.cliente.cuit,
      condicionIva: ot.cliente.condicionIva,
    },
  )

  const cfg = await getPlantillaConfig(null, 'REMITO')
  const pdf = await renderDocumentoPDF(cfg, datos)

  return { pdf, numero, filename: `remito-${numero.replace(/\//g, '-')}.pdf` }
}

export async function emitirRemitoDesdeFactura(facturaId: string, opts?: { preview?: boolean }) {
  const factura = await prisma.factura.findUnique({
    where: { id: facturaId },
    include: { cliente: true, items: true, emisor: true },
  })
  if (!factura) throw new ApiError(404, 'Factura no encontrada')

  const emisor = factura.emisor ?? (await emisorPredeterminado())
  const numero = opts?.preview
    ? `PREVIEW-${factura.numero}`
    : await reservarSiguienteNumero(claveRemito())

  const datos = buildDatosRemitoDesdeFactura(
    numero,
    factura,
    emisor,
    {
      nombre: factura.cliente.nombre,
      direccion: [factura.cliente.direccion, factura.cliente.ciudad].filter(Boolean).join(', ') || null,
      cuit: factura.cliente.cuit,
      condicionIva: factura.cliente.condicionIva,
    },
  )

  const cfg = await getPlantillaConfig(null, 'REMITO')
  const pdf = await renderDocumentoPDF(cfg, datos)

  return { pdf, numero, filename: `remito-${numero.replace(/\//g, '-')}.pdf` }
}
