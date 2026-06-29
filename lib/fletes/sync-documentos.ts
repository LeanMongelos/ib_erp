import { prisma } from '@/lib/prisma'
import { crearConNumeroUnico, siguienteNumeroFlete } from '@/lib/sequences'
import { calcularEstado, fleteInclude } from '@/lib/fletes/crud'
import { defaultsDesdeOC, defaultsDesdeRemito } from '@/lib/fletes/defaults'

function camposSyncDesdeDocumentos(
  existente: {
    guiaSeguimiento: string | null
    transportista: string | null
    importe: number | null
  },
  defaults: ReturnType<typeof defaultsDesdeRemito> | ReturnType<typeof defaultsDesdeOC>,
) {
  return {
    ...defaults,
    guiaSeguimiento: existente.guiaSeguimiento,
    transportista: existente.transportista,
    importe: existente.importe,
  }
}

export async function ensureFleteDesdeRemito(remitoId: string) {
  const existente = await prisma.seguimientoFlete.findUnique({
    where: { remitoVentaId: remitoId },
    include: fleteInclude,
  })

  const remito = await prisma.remitoVenta.findUnique({
    where: { id: remitoId },
    include: {
      cliente: { select: { id: true, nombre: true } },
      factura: { select: { id: true, numero: true } },
    },
  })
  if (!remito) return null

  const defaults = defaultsDesdeRemito(remito)

  if (existente) {
    const data = { ...defaults, ...camposSyncDesdeDocumentos(existente, defaults) }
    const estado = calcularEstado({ ...existente, ...data, estado: existente.estado })
    return prisma.seguimientoFlete.update({
      where: { id: existente.id },
      data: {
        clienteId: data.clienteId,
        clienteNombre: data.clienteNombre,
        facturaId: 'facturaId' in data ? data.facturaId : existente.facturaId,
        fechaEnvio: existente.fechaEnvio ?? data.fechaEnvio,
        estado,
      },
      include: fleteInclude,
    })
  }

  const estado = calcularEstado({ ...defaults, estado: 'BORRADOR' })
  return crearConNumeroUnico(siguienteNumeroFlete, (numero) =>
    prisma.seguimientoFlete.create({
      data: {
        numero,
        ...defaults,
        estado,
      },
      include: fleteInclude,
    }),
  )
}

export async function ensureFleteDesdeOC(ocId: string) {
  const existente = await prisma.seguimientoFlete.findUnique({
    where: { ordenCompraId: ocId },
    include: fleteInclude,
  })

  const oc = await prisma.ordenCompra.findUnique({
    where: { id: ocId },
    include: {
      proveedor: { select: { id: true, razonSocial: true } },
      cliente: { select: { id: true, nombre: true } },
    },
  })
  if (!oc) return null

  const defaults = defaultsDesdeOC(oc)

  if (existente) {
    const data = { ...defaults, ...camposSyncDesdeDocumentos(existente, defaults) }
    const estado = calcularEstado({ ...existente, ...data, estado: existente.estado })
    return prisma.seguimientoFlete.update({
      where: { id: existente.id },
      data: {
        proveedorOrigenId:
          'proveedorOrigenId' in data ? data.proveedorOrigenId : existente.proveedorOrigenId,
        proveedorOrigenNombre:
          'proveedorOrigenNombre' in data
            ? data.proveedorOrigenNombre
            : existente.proveedorOrigenNombre,
        clienteId: data.clienteId,
        clienteNombre: data.clienteNombre,
        fechaEnvio: existente.fechaEnvio ?? data.fechaEnvio,
        estado,
      },
      include: fleteInclude,
    })
  }

  const estado = calcularEstado({ ...defaults, estado: 'BORRADOR' })
  return crearConNumeroUnico(siguienteNumeroFlete, (numero) =>
    prisma.seguimientoFlete.create({
      data: {
        numero,
        ...defaults,
        estado,
      },
      include: fleteInclude,
    }),
  )
}
