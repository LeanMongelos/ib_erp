/**
 * Valores por defecto del ACTA de entrega (sin Prisma — usable en cliente).
 */
import { formatPeriodo, formatPeriodoLegible } from '@/lib/alquiler/periodo'

export interface ActaEntregaDefaultsInput {
  clienteNombre: string
  clienteTelefono?: string | null
  linea: {
    beneficiarioNombre?: string | null
    beneficiarioDocumento?: string | null
    beneficiarioTelefono?: string | null
    domicilio?: string | null
    localidad?: string | null
    provincia?: string | null
    montoMensual: number
    inventarioUnidad: {
      numeroSerie?: string | null
      inventario: { nombre: string; marca?: string | null; modelo?: string | null }
    }
    equipo?: { nombre: string; numeroSerie?: string | null } | null
  }
  periodo?: string
  facturaId?: string | null
}

export interface ActaEntregaFormValues {
  clienteNombre: string
  clienteDni: string
  clienteDireccion: string
  clienteTelefono: string
  equipoNombre: string
  numeroSerie: string
  fechaActa: string
  lugar: string
  montoAlquiler: number
  periodoAlquiler: string
  montoDepositoGarantia: number
  observaciones: string
  facturaId: string
}

function nombreEquipoCompleto(linea: ActaEntregaDefaultsInput['linea']): string {
  const inv = linea.inventarioUnidad.inventario
  const partes = [inv.nombre]
  if (inv.marca) partes.push(inv.marca)
  if (inv.modelo) partes.push(inv.modelo)
  if (linea.equipo?.nombre && linea.equipo.nombre !== inv.nombre) {
    return linea.equipo.nombre
  }
  return partes.join(' ')
}

function direccionLinea(linea: ActaEntregaDefaultsInput['linea']): string {
  return [linea.domicilio, linea.localidad, linea.provincia].filter(Boolean).join(', ')
}

export function buildActaEntregaDefaults(input: ActaEntregaDefaultsInput): ActaEntregaFormValues {
  const { linea } = input
  const periodo = input.periodo ?? formatPeriodo(new Date())
  const hoy = new Date()
  hoy.setHours(12, 0, 0, 0)

  return {
    clienteNombre: linea.beneficiarioNombre?.trim() || input.clienteNombre,
    clienteDni: linea.beneficiarioDocumento?.trim() ?? '',
    clienteDireccion: direccionLinea(linea),
    clienteTelefono: linea.beneficiarioTelefono?.trim() || input.clienteTelefono?.trim() || '',
    equipoNombre: nombreEquipoCompleto(linea),
    numeroSerie:
      linea.inventarioUnidad.numeroSerie?.trim()
      || linea.equipo?.numeroSerie?.trim()
      || '',
    fechaActa: hoy.toISOString().slice(0, 10),
    lugar: 'Formosa',
    montoAlquiler: linea.montoMensual,
    periodoAlquiler: formatPeriodoLegible(periodo),
    montoDepositoGarantia: 0,
    observaciones: '',
    facturaId: input.facturaId ?? '',
  }
}

export function actaEquipoConSerie(equipoNombre: string, numeroSerie: string): string {
  const serie = numeroSerie.trim()
  return serie ? `${equipoNombre} — S/N ${serie}` : equipoNombre
}
