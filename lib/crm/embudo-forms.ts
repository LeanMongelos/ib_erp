import type { EtapaKey } from './embudo-constants'
import { transitionKey } from './embudo-constants'

export type FormFieldType =
  | 'text'
  | 'email'
  | 'number'
  | 'date'
  | 'textarea'
  | 'select'
  | 'combobox'
  | 'cliente'
  | 'inventario'
  | 'usuario'
  | 'radio'
  | 'checkbox-group'
  | 'factura'

export interface FormFieldOption {
  value: string
  label: string
}

export interface FormFieldShowIf {
  field: string
  value: string | string[]
}

export interface FormField {
  name: string
  label: string
  type: FormFieldType
  required?: boolean
  options?: FormFieldOption[]
  showIf?: FormFieldShowIf
  /** Si true, el valor actualiza el monto del negocio al confirmar */
  updatesMonto?: boolean
  placeholder?: string
  defaultToday?: boolean
  /** Atributo HTML autocomplete; si no se define, se infiere del nombre en la UI */
  autoComplete?: string
  /** Solo para type combobox: permite valor libre además de las opciones */
  allowCustom?: boolean
}

export interface TransitionFormDef {
  title: string
  hint?: string
  celebratory?: boolean
  fields: FormField[]
}

const PROXIMA_ACCION_OPTS: FormFieldOption[] = [
  { value: 'LLAMADA', label: 'Llamada' },
  { value: 'REUNION', label: 'Reunión' },
  { value: 'EMAIL', label: 'Email' },
  { value: 'WHATSAPP', label: 'WhatsApp' },
]

const SI_NO: FormFieldOption[] = [
  { value: 'SI', label: 'Sí' },
  { value: 'NO', label: 'No' },
]

export const TRANSITION_FORMS: Record<string, TransitionFormDef> = {
  [transitionKey('ENTRADA', 'CONTACTO')]: {
    title: 'Registrar primer contacto',
    fields: [
      { name: 'contactoNombre', label: 'Nombre completo del contacto', type: 'text', required: true, autoComplete: 'name' },
      { name: 'contactoCargo', label: 'Cargo/Rol del contacto', type: 'text', required: true, autoComplete: 'organization-title' },
      { name: 'telefono', label: 'Teléfono', type: 'text', required: true, autoComplete: 'tel' },
      { name: 'email', label: 'Email', type: 'email', required: true, autoComplete: 'email' },
      { name: 'organismo', label: 'Organismo / Institución', type: 'cliente', required: true },
      {
        name: 'tipoOrganismo',
        label: 'Tipo de organismo',
        type: 'select',
        required: true,
        options: [
          { value: 'HOSPITAL_PUBLICO', label: 'Hospital Público' },
          { value: 'CLINICA_PRIVADA', label: 'Clínica Privada' },
          { value: 'MUTUAL', label: 'Mutual' },
          { value: 'MINISTERIO', label: 'Ministerio' },
          { value: 'OTRO', label: 'Otro' },
        ],
      },
      {
        name: 'origenLead',
        label: 'Cómo llegó el lead',
        type: 'select',
        required: true,
        options: [
          { value: 'LICITACION', label: 'Licitación pública' },
          { value: 'LLAMADO', label: 'Llamado entrante' },
          { value: 'REFERIDO', label: 'Referido' },
          { value: 'PROSPECCION', label: 'Prospección' },
          { value: 'WEB', label: 'Web' },
          { value: 'OTRO', label: 'Otro' },
        ],
      },
      { name: 'notasContacto', label: 'Notas del primer contacto', type: 'textarea' },
      { name: 'proximaAccion', label: 'Próxima acción', type: 'select', options: PROXIMA_ACCION_OPTS },
      { name: 'proximaAccionFecha', label: 'Fecha de próxima acción', type: 'date', required: true, defaultToday: true },
    ],
  },
  [transitionKey('CONTACTO', 'DOCUMENTACION')]: {
    title: 'Entrega de documentación técnica',
    fields: [
      {
        name: 'documentosEntregados',
        label: 'Qué documentos se entregaron',
        type: 'checkbox-group',
        options: [
          { value: 'CATALOGO', label: 'Catálogo del producto' },
          { value: 'FICHA_TECNICA', label: 'Ficha técnica' },
          { value: 'CERTIFICADO', label: 'Certificado FDA / CE / ANMAT' },
          { value: 'MANUAL', label: 'Manual de usuario' },
          { value: 'HABILITACIONES', label: 'Habilitaciones del importador' },
          { value: 'REFERENCIAS', label: 'Referencias de otros clientes' },
        ],
      },
      {
        name: 'medioEntrega',
        label: 'Medio de entrega',
        type: 'select',
        required: true,
        options: [
          { value: 'EMAIL', label: 'Email' },
          { value: 'PRESENCIAL', label: 'Reunión presencial' },
          { value: 'WHATSAPP', label: 'WhatsApp' },
          { value: 'CORREO', label: 'Correo físico' },
        ],
      },
      { name: 'realizoDemo', label: '¿Se realizó demo o visita técnica?', type: 'radio', options: SI_NO },
      { name: 'fechaDemo', label: 'Fecha de la demo', type: 'date', showIf: { field: 'realizoDemo', value: 'SI' } },
      { name: 'observacionesTecnicas', label: 'Observaciones técnicas del cliente', type: 'textarea' },
      {
        name: 'interesCliente',
        label: 'Interés del cliente',
        type: 'select',
        options: [
          { value: 'ALTO', label: 'Alto' },
          { value: 'MEDIO', label: 'Medio' },
          { value: 'BAJO', label: 'Bajo' },
        ],
      },
      { name: 'proximaAccion', label: 'Próxima acción', type: 'select', options: PROXIMA_ACCION_OPTS },
      { name: 'proximaAccionFecha', label: 'Fecha de próxima acción', type: 'date', required: true, defaultToday: true },
    ],
  },
  [transitionKey('DOCUMENTACION', 'PROPUESTA')]: {
    title: 'Envío de propuesta económica',
    hint: 'Al confirmar se crea automáticamente el presupuesto en el ERP (numeración correlativa) y queda vinculado a este negocio.',
    fields: [
      { name: 'montoPropuesta', label: 'Monto total de la propuesta en ARS', type: 'number', required: true, updatesMonto: true },
      {
        name: 'tipoVenta',
        label: 'Tipo de venta',
        type: 'select',
        required: true,
        options: [
          { value: 'DIRECTA', label: 'Venta directa' },
          { value: 'LICITACION', label: 'Licitación pública' },
          { value: 'CONTRATACION', label: 'Contratación directa' },
          { value: 'CONVENIO', label: 'Convenio marco' },
        ],
      },
      { name: 'numeroLicitacion', label: 'Número de licitación (si aplica)', type: 'text' },
      { name: 'fechaEnvio', label: 'Fecha de envío de la propuesta', type: 'date', required: true, defaultToday: true },
      { name: 'fechaVencimiento', label: 'Fecha de vencimiento de la propuesta', type: 'date', required: true },
      {
        name: 'condicionPago',
        label: 'Condiciones de pago ofrecidas',
        type: 'select',
        options: [
          { value: 'CONTADO', label: 'Contado' },
          { value: '30', label: '30 días' },
          { value: '60', label: '60 días' },
          { value: 'CUOTAS', label: 'Cuotas' },
          { value: 'A_DEFINIR', label: 'A definir' },
        ],
      },
      { name: 'incluyeGarantia', label: '¿Se incluyó garantía?', type: 'radio', options: SI_NO },
      { name: 'mesesGarantia', label: 'Meses de garantía', type: 'number', showIf: { field: 'incluyeGarantia', value: 'SI' } },
      {
        name: 'plazoEntrega',
        label: 'Plazo de entrega prometido',
        type: 'select',
        options: [
          { value: 'INMEDIATO', label: 'Inmediato' },
          { value: '15', label: '15 días' },
          { value: '30', label: '30 días' },
          { value: '60', label: '60 días' },
          { value: '90', label: '90 días' },
          { value: 'A_CONFIRMAR', label: 'A confirmar' },
        ],
      },
      { name: 'observacionesPropuesta', label: 'Observaciones de la propuesta', type: 'textarea' },
      { name: 'fechaSeguimiento', label: 'Fecha de seguimiento pactado', type: 'date', required: true },
    ],
  },
  [transitionKey('PROPUESTA', 'SEGUIMIENTO')]: {
    title: 'Registrar seguimiento activo',
    fields: [
      {
        name: 'tipoContacto',
        label: 'Tipo de contacto realizado',
        type: 'select',
        required: true,
        options: [
          { value: 'LLAMADA', label: 'Llamada telefónica' },
          { value: 'REUNION', label: 'Reunión presencial' },
          { value: 'EMAIL', label: 'Email' },
          { value: 'WHATSAPP', label: 'WhatsApp' },
          { value: 'VIDEO', label: 'Videollamada' },
        ],
      },
      { name: 'fechaContacto', label: 'Fecha del contacto', type: 'date', required: true, defaultToday: true },
      { name: 'conQuien', label: '¿Con quién se habló?', type: 'text', required: true, autoComplete: 'name' },
      { name: 'resumen', label: 'Resumen de la conversación', type: 'textarea', required: true },
      {
        name: 'estadoPropuesta',
        label: 'Estado de la propuesta según el cliente',
        type: 'select',
        options: [
          { value: 'EVALUACION', label: 'En evaluación' },
          { value: 'AJUSTE_PRECIO', label: 'Piden ajuste de precio' },
          { value: 'CAMBIOS_TECNICOS', label: 'Piden cambios técnicos' },
          { value: 'APROBACION_INTERNA', label: 'Esperando aprobación interna' },
          { value: 'INTERESADOS', label: 'Muy interesados' },
          { value: 'SIN_RESPUESTA', label: 'Sin respuesta aún' },
        ],
      },
      { name: 'hayCompetidores', label: '¿Hay competidores identificados?', type: 'radio', options: SI_NO },
      { name: 'competidor', label: '¿Quién?', type: 'text', showIf: { field: 'hayCompetidores', value: 'SI' } },
      {
        name: 'objecionPrincipal',
        label: 'Objeción principal',
        type: 'select',
        options: [
          { value: 'PRECIO', label: 'Precio muy alto' },
          { value: 'SIN_PRESUPUESTO', label: 'No tiene presupuesto aún' },
          { value: 'OTRA_MARCA', label: 'Prefiere otra marca' },
          { value: 'ADMIN_LENTO', label: 'Proceso administrativo lento' },
          { value: 'SIN_OBJECION', label: 'Sin objeciones' },
          { value: 'OTRA', label: 'Otra' },
        ],
      },
      {
        name: 'probabilidadCierre',
        label: 'Nivel de probabilidad de cierre',
        type: 'select',
        options: [
          { value: 'ALTA', label: '🟢 Alta (>70%)' },
          { value: 'MEDIA', label: '🟡 Media (30-70%)' },
          { value: 'BAJA', label: '🔴 Baja (<30%)' },
        ],
      },
      {
        name: 'proximaAccionConcreta',
        label: 'Próxima acción concreta',
        type: 'select',
        options: [
          { value: 'LLAMADA', label: 'Llamada' },
          { value: 'REUNION', label: 'Reunión' },
          { value: 'REENVIAR', label: 'Reenviar propuesta' },
          { value: 'AJUSTAR_PRECIO', label: 'Ajustar precio' },
          { value: 'OTRA', label: 'Otra' },
        ],
      },
      { name: 'proximaAccionFecha', label: 'Fecha de próxima acción', type: 'date', required: true },
    ],
  },
  [transitionKey('SEGUIMIENTO', 'ANALISIS')]: {
    title: 'El cliente está analizando internamente',
    fields: [
      {
        name: 'quienAnaliza',
        label: '¿Quién está analizando?',
        type: 'select',
        options: [
          { value: 'COMITE', label: 'Comité de compras' },
          { value: 'TECNICA', label: 'Área técnica' },
          { value: 'DIRECCION', label: 'Dirección' },
          { value: 'CONTABLE', label: 'Área contable' },
          { value: 'MULTIPLE', label: 'Múltiples áreas' },
          { value: 'NO_ESPECIFICADO', label: 'No especificado' },
        ],
      },
      { name: 'motivoAnalisis', label: 'Motivo por el que pasó a análisis', type: 'textarea', required: true },
      { name: 'modificoMonto', label: '¿Se modificó el monto de la propuesta?', type: 'radio', options: SI_NO },
      { name: 'nuevoMonto', label: 'Nuevo monto en ARS', type: 'number', showIf: { field: 'modificoMonto', value: 'SI' }, updatesMonto: true },
      { name: 'hayExpediente', label: '¿Hay un expediente o número de trámite?', type: 'radio', options: SI_NO },
      { name: 'numeroExpediente', label: 'Número de expediente', type: 'text', showIf: { field: 'hayExpediente', value: 'SI' } },
      { name: 'fechaResolucionEstimada', label: 'Fecha estimada de resolución del cliente', type: 'date' },
      {
        name: 'riesgoCompetidor',
        label: '¿Hay riesgo de que entre un competidor?',
        type: 'select',
        options: [
          { value: 'SIN_RIESGO', label: 'Sin riesgo' },
          { value: 'BAJO', label: 'Riesgo bajo' },
          { value: 'MEDIO', label: 'Riesgo medio' },
          { value: 'ALTO', label: 'Riesgo alto' },
        ],
      },
      { name: 'accionesRelacion', label: 'Acciones para mantener la relación', type: 'textarea' },
      {
        name: 'frecuenciaSeguimiento',
        label: 'Frecuencia de seguimiento acordada',
        type: 'select',
        options: [
          { value: '2_DIAS', label: 'Cada 2 días' },
          { value: 'SEMANAL', label: 'Semanal' },
          { value: '15_DIAS', label: 'Cada 15 días' },
          { value: 'CUANDO_LLAMEN', label: 'Solo cuando llamen' },
        ],
      },
      { name: 'proximaAccionFecha', label: 'Próxima fecha de contacto', type: 'date', required: true },
    ],
  },
  [transitionKey('ANALISIS', 'ENTREGA')]: {
    title: '¡Negocio ganado! Coordinar entrega',
    celebratory: true,
    fields: [
      { name: 'fechaConfirmacion', label: 'Fecha de confirmación de la venta', type: 'date', required: true, defaultToday: true },
      { name: 'numeroOrdenCompra', label: 'Número de orden de compra / contrato', type: 'text', required: true, autoComplete: 'off' },
      { name: 'montoFinal', label: 'Monto final confirmado en ARS', type: 'number', required: true, updatesMonto: true },
      {
        name: 'condicionPagoAcordada',
        label: 'Condición de pago acordada',
        type: 'select',
        required: true,
        options: [
          { value: 'CONTADO', label: 'Contado' },
          { value: '50_50', label: '50% adelanto 50% entrega' },
          { value: '30', label: '30 días' },
          { value: '60', label: '60 días' },
          { value: 'CUOTAS', label: 'Cuotas' },
        ],
      },
      { name: 'cobroAdelanto', label: '¿Se cobró adelanto?', type: 'radio', options: SI_NO },
      { name: 'montoAdelanto', label: 'Monto del adelanto', type: 'number', showIf: { field: 'cobroAdelanto', value: 'SI' } },
      { name: 'fechaEntregaPactada', label: 'Fecha pactada para la entrega', type: 'date', required: true },
      { name: 'responsableEntrega', label: 'Responsable de la entrega/instalación', type: 'text', autoComplete: 'name' },
      { name: 'direccionEntrega', label: 'Dirección de entrega', type: 'text', required: true, autoComplete: 'street-address' },
      { name: 'requiereInstalacion', label: 'Requiere instalación', type: 'radio', options: SI_NO },
      { name: 'requiereCapacitacion', label: 'Requiere capacitación al personal', type: 'radio', options: SI_NO },
      { name: 'observacionesLogisticas', label: 'Observaciones logísticas', type: 'textarea' },
    ],
  },
  [transitionKey('ENTREGA', 'CIERRE')]: {
    title: 'Confirmar entrega y gestionar cobro',
    fields: [
      { name: 'fechaEntregaReal', label: 'Fecha real de entrega', type: 'date', required: true, defaultToday: true },
      {
        name: 'entregaConforme',
        label: '¿Se entregó conforme?',
        type: 'radio',
        required: true,
        options: [
          { value: 'SI', label: 'Sí' },
          { value: 'NO', label: 'No' },
          { value: 'PARCIAL', label: 'Entrega parcial' },
        ],
      },
      { name: 'descripcionProblema', label: 'Descripción del problema', type: 'textarea', showIf: { field: 'entregaConforme', value: ['NO', 'PARCIAL'] } },
      {
        name: 'actaRecepcion',
        label: '¿Se firmó acta de recepción?',
        type: 'radio',
        options: [
          { value: 'SI', label: 'Sí' },
          { value: 'NO', label: 'No' },
          { value: 'PENDIENTE', label: 'Pendiente' },
        ],
      },
      {
        name: 'capacitacionRealizada',
        label: '¿Se realizó capacitación?',
        type: 'radio',
        options: [
          { value: 'SI', label: 'Sí' },
          { value: 'NO', label: 'No' },
          { value: 'NA', label: 'No aplica' },
        ],
      },
      {
        name: 'estadoCobro',
        label: 'Estado del cobro',
        type: 'select',
        required: true,
        options: [
          { value: 'COBRADO_100', label: 'Cobrado 100%' },
          { value: 'PARCIAL', label: 'Cobrado parcialmente' },
          { value: 'PENDIENTE', label: 'Pendiente de cobro' },
          { value: 'FACTURADO_SIN_COBRAR', label: 'Facturado sin cobrar' },
        ],
      },
      { name: 'montoCobrado', label: 'Monto cobrado hasta ahora', type: 'number' },
      {
        name: 'facturaId',
        label: 'Factura emitida (ERP)',
        type: 'factura',
      },
      { name: 'numeroFactura', label: 'Número de factura (si no está en la lista)', type: 'text' },
      { name: 'fechaCobroEsperada', label: 'Fecha de cobro esperada (si hay saldo)', type: 'date' },
      {
        name: 'satisfaccionCliente',
        label: '¿El cliente quedó satisfecho?',
        type: 'select',
        options: [
          { value: 'MUY', label: 'Muy satisfecho' },
          { value: 'SATISFECHO', label: 'Satisfecho' },
          { value: 'NEUTRAL', label: 'Neutral' },
          { value: 'DISCONFORME', label: 'Disconforme' },
        ],
      },
      { name: 'pidioSoporte', label: '¿Pidió soporte técnico o servicio post-venta?', type: 'radio', options: SI_NO },
      { name: 'observacionesFinales', label: 'Observaciones finales', type: 'textarea' },
      {
        name: 'potencialNuevaVenta',
        label: '¿Potencial de nueva venta?',
        type: 'select',
        options: [
          { value: 'ALTA', label: '🔥 Alta probabilidad' },
          { value: 'POSIBLE', label: 'Posible' },
          { value: 'POCO', label: 'Poco probable' },
          { value: 'NO', label: 'No' },
        ],
      },
    ],
  },
}

export const PERDIDO_FORM: TransitionFormDef = {
  title: 'Marcar negocio como perdido',
  fields: [
    {
      name: 'motivoPerdida',
      label: 'Motivo principal',
      type: 'select',
      required: true,
      options: [
        { value: 'PRECIO', label: 'Precio / presupuesto' },
        { value: 'COMPETIDOR', label: 'Competidor' },
        { value: 'SIN_PRESUPUESTO', label: 'Sin presupuesto del cliente' },
        { value: 'LICITACION', label: 'Licitación caída' },
        { value: 'SIN_RESPUESTA', label: 'Cliente sin respuesta' },
        { value: 'OTRO', label: 'Otro' },
      ],
    },
    { name: 'detallePerdida', label: 'Detalle', type: 'textarea', required: true },
    {
      name: 'recuperableFuturo',
      label: '¿Recuperable a futuro?',
      type: 'radio',
      options: [
        { value: 'SI', label: 'Sí' },
        { value: 'NO', label: 'No' },
        { value: 'TAL_VEZ', label: 'Tal vez' },
      ],
    },
  ],
}

export const RETROCESO_FORM: TransitionFormDef = {
  title: '⚠️ Retroceso de etapa',
  fields: [
    {
      name: 'motivoRetroceso',
      label: 'Motivo del retroceso',
      type: 'select',
      required: true,
      options: [
        { value: 'CAMBIOS_PROPUESTA', label: 'Cliente pidió cambios en la propuesta' },
        { value: 'PROBLEMA_TECNICO', label: 'Problema técnico con el producto' },
        { value: 'SIN_PRESUPUESTO', label: 'Cliente sin presupuesto por ahora' },
        { value: 'LICITACION_CAYO', label: 'Se cayó la licitación' },
        { value: 'COMPETIDOR', label: 'Competidor ganó precio' },
        { value: 'PROBLEMA_INTERNO', label: 'Problema interno de la empresa' },
        { value: 'SIN_RESPUESTA', label: 'Cliente desapareció / sin respuesta' },
        { value: 'OTRO', label: 'Otro' },
      ],
    },
    { name: 'descripcionRetroceso', label: 'Descripción detallada', type: 'textarea', required: true },
    {
      name: 'recuperable',
      label: '¿Se puede recuperar este negocio?',
      type: 'radio',
      options: [
        { value: 'SI', label: 'Sí' },
        { value: 'NO', label: 'No' },
        { value: 'INCIERTO', label: 'Incierto' },
      ],
    },
    { name: 'planRecuperacion', label: 'Plan de acción para recuperarlo', type: 'textarea' },
    { name: 'nuevaFechaSeguimiento', label: 'Nueva fecha de seguimiento', type: 'date' },
  ],
}

export const NUEVO_NEGOCIO_FIELDS: FormField[] = [
  { name: 'nombre', label: 'Nombre del negocio', type: 'text', required: true, autoComplete: 'off' },
  { name: 'cliente', label: 'Cliente/Organismo', type: 'cliente', required: true },
  { name: 'productoServicio', label: 'Producto/Servicio', type: 'inventario', required: true },
  { name: 'monto', label: 'Monto estimado en ARS', type: 'number', updatesMonto: true },
  { name: 'vendedor', label: 'Vendedor asignado', type: 'usuario', required: true },
  {
    name: 'urgencia',
    label: 'Urgencia',
    type: 'select',
    options: [
      { value: 'NORMAL', label: 'Normal' },
      { value: 'URGENTE', label: 'Urgente' },
    ],
  },
  { name: 'notas', label: 'Notas iniciales', type: 'textarea' },
]

export function getTransitionForm(desde: EtapaKey, hasta: EtapaKey, retroceso: boolean): TransitionFormDef | null {
  if (retroceso) return RETROCESO_FORM
  if (hasta === 'PERDIDO') return PERDIDO_FORM
  return TRANSITION_FORMS[transitionKey(desde, hasta)] ?? null
}

export function fieldVisible(field: FormField, values: Record<string, unknown>): boolean {
  if (!field.showIf) return true
  const current = values[field.showIf.field]
  const expected = field.showIf.value
  if (Array.isArray(expected)) return expected.includes(String(current ?? ''))
  return String(current ?? '') === expected
}

export function validateForm(fields: FormField[], values: Record<string, unknown>): string | null {
  for (const f of fields) {
    if (!fieldVisible(f, values)) continue
    if (!f.required) continue
    const v = values[f.name]
    if (f.type === 'checkbox-group') {
      if (!Array.isArray(v) || v.length === 0) return `Completá: ${f.label}`
    } else if (v === undefined || v === null || String(v).trim() === '') {
      return `Completá: ${f.label}`
    }
  }
  return null
}

export function extractMontoFromDatos(fields: FormField[], datos: Record<string, unknown>): number | null {
  for (const f of fields) {
    if (f.updatesMonto && datos[f.name] !== undefined && datos[f.name] !== '') {
      const n = Number(datos[f.name])
      if (Number.isFinite(n)) return n
    }
  }
  return null
}

export function extractProximaAccionFecha(fields: FormField[], datos: Record<string, unknown>): Date | null {
  const keys = ['proximaAccionFecha', 'fechaSeguimiento', 'nuevaFechaSeguimiento']
  for (const k of keys) {
    const field = fields.find((f) => f.name === k)
    if (field && fieldVisible(field, datos) && datos[k]) {
      const d = new Date(String(datos[k]))
      if (!Number.isNaN(d.getTime())) return d
    }
  }
  return null
}

export function defaultFormValues(fields: FormField[]): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const f of fields) {
    if (f.type === 'checkbox-group') out[f.name] = []
    else if (f.defaultToday && f.type === 'date') out[f.name] = new Date().toISOString().slice(0, 10)
    else out[f.name] = ''
  }
  return out
}
