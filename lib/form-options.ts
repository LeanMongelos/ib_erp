/** Opciones compartidas para selects y comboboxes del ERP. */

export interface FormOption {
  value: string
  label: string
}

export const FORMA_PAGO: FormOption[] = [
  { value: 'Contado', label: 'Contado' },
  { value: 'Transferencia bancaria', label: 'Transferencia bancaria' },
  { value: 'Cheque', label: 'Cheque' },
  { value: 'Efectivo', label: 'Efectivo' },
  { value: 'Tarjeta de crédito', label: 'Tarjeta de crédito' },
  { value: 'Tarjeta de débito', label: 'Tarjeta de débito' },
  { value: '30 días', label: '30 días' },
  { value: '60 días', label: '60 días' },
  { value: '50% adelanto / 50% entrega', label: '50% adelanto / 50% entrega' },
]

export const PLAZO_ENTREGA: FormOption[] = [
  { value: 'Inmediato', label: 'Inmediato' },
  { value: '15 días', label: '15 días' },
  { value: '30 días', label: '30 días' },
  { value: '45 días', label: '45 días' },
  { value: '60 días', label: '60 días' },
  { value: '90 días', label: '90 días' },
  { value: 'A confirmar', label: 'A confirmar' },
]

export const GARANTIA: FormOption[] = [
  { value: '6 meses', label: '6 meses' },
  { value: '12 meses', label: '12 meses' },
  { value: '18 meses', label: '18 meses' },
  { value: '24 meses', label: '24 meses' },
  { value: '36 meses', label: '36 meses' },
  { value: 'Según fabricante', label: 'Según fabricante' },
  { value: 'Sin garantía', label: 'Sin garantía' },
]

export const VIGENCIA_DIAS: FormOption[] = [
  { value: '7', label: '7 días' },
  { value: '15', label: '15 días' },
  { value: '30', label: '30 días' },
  { value: '45', label: '45 días' },
  { value: '60', label: '60 días' },
  { value: '90', label: '90 días' },
]

export const MEDIO_PAGO: FormOption[] = [
  { value: 'TRANSFERENCIA', label: 'Transferencia' },
  { value: 'EFECTIVO', label: 'Efectivo' },
  { value: 'CHEQUE', label: 'Cheque' },
  { value: 'TARJETA', label: 'Tarjeta' },
  { value: 'OTRO', label: 'Otro' },
]

export const CONDICION_IVA: FormOption[] = [
  { value: 'Responsable Inscripto', label: 'Responsable Inscripto' },
  { value: 'Monotributo', label: 'Monotributo' },
  { value: 'Exento en IVA', label: 'Exento en IVA' },
  { value: 'Consumidor Final', label: 'Consumidor Final' },
  { value: 'Responsable No Inscripto', label: 'Responsable No Inscripto' },
  { value: 'Cliente del Exterior', label: 'Cliente del Exterior' },
]

export const TIPO_CLIENTE: FormOption[] = [
  { value: 'HOSPITAL', label: 'Hospital' },
  { value: 'CLINICA', label: 'Clínica' },
  { value: 'SANATORIO', label: 'Sanatorio' },
  { value: 'CONSULTORIO', label: 'Consultorio' },
  { value: 'ORGANISMO_PUBLICO', label: 'Organismo público (Ministerio, municipalidad…)' },
  { value: 'OTRO', label: 'Otro' },
]

export const PRIORIDAD_OT: FormOption[] = [
  { value: 'BAJA', label: 'Baja' },
  { value: 'NORMAL', label: 'Normal' },
  { value: 'ALTA', label: 'Alta' },
  { value: 'URGENTE', label: 'Urgente' },
]

export const SLA_HORAS: FormOption[] = [
  { value: '24', label: '24 h (urgente)' },
  { value: '48', label: '48 h (estándar)' },
  { value: '72', label: '72 h' },
  { value: '120', label: '120 h (5 días)' },
  { value: '168', label: '168 h (7 días)' },
]

export const MONEDA: FormOption[] = [
  { value: 'ARS', label: 'ARS — Peso argentino' },
  { value: 'USD', label: 'USD — Dólar' },
  { value: 'EUR', label: 'EUR — Euro' },
]

export const ORIGEN_PROVEEDOR: FormOption[] = [
  { value: 'NACIONAL', label: 'Nacional' },
  { value: 'IMPORTADO', label: 'Importado' },
]

export const TIPO_COMPRA_PROVEEDOR: FormOption[] = [
  { value: 'REMITO', label: 'Remito / stock' },
  { value: 'CONCEPTOS', label: 'Conceptos / gastos' },
  { value: 'AMBOS', label: 'Ambos' },
]

export const CATEGORIAS_INVENTARIO: FormOption[] = [
  { value: 'Monitoreo', label: 'Monitoreo' },
  { value: 'Diagnóstico', label: 'Diagnóstico' },
  { value: 'Respiratorio', label: 'Respiratorio' },
  { value: 'Laboratorio', label: 'Laboratorio' },
  { value: 'Imagenología', label: 'Imagenología' },
  { value: 'Accesorios', label: 'Accesorios' },
  { value: 'Repuestos', label: 'Repuestos' },
  { value: 'Consumibles', label: 'Consumibles' },
  { value: 'Otros', label: 'Otros' },
]

export const CONDICION_PAGO: FormOption[] = [
  { value: 'Contado', label: 'Contado' },
  { value: '30 días', label: '30 días' },
  { value: '60 días', label: '60 días' },
  { value: '90 días', label: '90 días' },
  { value: '50% adelanto / 50% entrega', label: '50% adelanto / 50% entrega' },
]
