/** Etiquetas legibles para acciones de auditoría. */
export const ACCION_AUDITORIA_LABEL: Record<string, string> = {
  'login.success': 'Inicio de sesión',
  'login.rate_limited': 'Bloqueo por intentos fallidos',
  'usuario.create': 'Usuario creado',
  'usuario.update': 'Usuario actualizado',
  'usuario.deactivate': 'Usuario desactivado',
  'emisor.create': 'Emisor creado',
  'emisor.update': 'Emisor actualizado',
  'factura.create': 'Factura creada',
  'factura.emitir': 'Factura emitida AFIP',
  'presupuesto.create': 'Presupuesto creado',
  'presupuesto.update': 'Presupuesto actualizado',
  'mantenimiento.create': 'Plan preventivo creado',
  'cobranza.create': 'Cobranza registrada',
  'inventario.create': 'Producto de inventario creado',
  'config.seguridad.update': 'Política de seguridad actualizada',
  'config.catalogos.update': 'Catálogo maestro actualizado',
  'config.notificaciones.update': 'Notificación actualizada',
}

export function etiquetaAccion(accion: string): string {
  return ACCION_AUDITORIA_LABEL[accion] ?? accion.replace(/\./g, ' · ')
}

export const NIVEL_LOG_LABEL: Record<string, string> = {
  ERROR: 'Error',
  WARN: 'Advertencia',
  INFO: 'Info',
}

export const ORIGEN_LOG_LABEL: Record<string, string> = {
  api: 'API',
  'worker-afip': 'Worker AFIP',
  'worker-crm': 'Worker CRM',
  'worker-cobranzas': 'Worker Cobranzas',
  page: 'Página',
}

export function etiquetaNivelLog(nivel: string): string {
  return NIVEL_LOG_LABEL[nivel] ?? nivel
}

export function etiquetaOrigenLog(origen: string): string {
  return ORIGEN_LOG_LABEL[origen] ?? origen
}

export const EVENTOS_NOTIFICACION: { value: string; label: string }[] = [
  { value: 'cobranza.vencida', label: 'Factura de cobranza vencida' },
  { value: 'cobranza.proximo', label: 'Vencimiento de cobranza próximo' },
  { value: 'ot.sla_proximo', label: 'OT cerca del límite SLA' },
  { value: 'ot.vencida', label: 'OT vencida' },
  { value: 'preventivo.proximo', label: 'Preventivo programado' },
  { value: 'preventivo.vencido', label: 'Preventivo vencido' },
  { value: 'equipo.componente_vence', label: 'Componente de equipo por vencer' },
  { value: 'presupuesto.por_vencer', label: 'Presupuesto por vencer' },
  { value: 'stock.bajo_minimo', label: 'Stock bajo mínimo' },
  { value: 'crm.conversacion_sin_leer', label: 'Mensajes CRM sin leer' },
]

export const CANALES_NOTIFICACION: { value: string; label: string }[] = [
  { value: 'SISTEMA', label: 'Campana en ERP' },
  { value: 'EMAIL', label: 'Correo electrónico' },
  { value: 'WHATSAPP', label: 'WhatsApp (integración)' },
]
