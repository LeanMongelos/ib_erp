import type { OrdenCompra, RemitoVenta, Cliente, Proveedor } from '@prisma/client'
import type { TipoFlete } from '@prisma/client'

type RemitoConCliente = RemitoVenta & {
  cliente: Pick<Cliente, 'id' | 'nombre'>
  factura?: { id: string; numero: string } | null
}

type OcConProveedor = OrdenCompra & {
  proveedor: Pick<Proveedor, 'id' | 'razonSocial'>
  cliente?: Pick<Cliente, 'id' | 'nombre'> | null
}

export function defaultsDesdeRemito(remito: RemitoConCliente) {
  return {
    tipo: 'SALIDA' as TipoFlete,
    remitoVentaId: remito.id,
    clienteId: remito.clienteId,
    clienteNombre: remito.cliente.nombre,
    fechaEnvio: remito.fechaEmision,
    facturaId: remito.factura?.id ?? null,
  }
}

export function defaultsDesdeOC(oc: OcConProveedor) {
  return {
    tipo: 'ENTRADA' as TipoFlete,
    ordenCompraId: oc.id,
    proveedorOrigenId: oc.proveedorId,
    proveedorOrigenNombre: oc.proveedor.razonSocial,
    clienteId: oc.clienteId,
    clienteNombre: oc.cliente?.nombre ?? null,
    fechaEnvio: oc.ultimaRecepcionEn ?? oc.fechaEntrega ?? new Date(),
  }
}
