import type { ItemOrdenCompra, OrdenCompra } from '@prisma/client'

export interface ValidarEnvioOCInput {
  solicitanteId?: string | null
  justificacion?: string | null
  clasificacionOrigen?: OrdenCompra['clasificacionOrigen']
  items: Pick<ItemOrdenCompra, 'descripcion'>[]
}

export function validarEnvioOC(data: ValidarEnvioOCInput): string | null {
  if (!data.solicitanteId?.trim()) {
    return 'Indicá el solicitante antes de enviar a aprobación'
  }
  if (!data.justificacion?.trim()) {
    return 'La justificación es obligatoria para enviar a aprobación'
  }
  if (!data.clasificacionOrigen) {
    return 'Seleccioná la clasificación de origen'
  }
  const itemsValidos = data.items.filter((i) => i.descripcion?.trim())
  if (itemsValidos.length === 0) {
    return 'Agregá al menos un ítem'
  }
  return null
}
