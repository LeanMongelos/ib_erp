/**
 * lib/validation.ts
 * Esquemas Zod compartidos para validar la entrada de todos los endpoints.
 *
 * La validación vive en un único lugar para mantener coherencia entre las
 * rutas de API y, llegado el caso, los formularios del cliente.
 */

import { z } from 'zod'
import { codigoInternoOpcionalSchema, codigoInternoSchema } from '@/lib/inventario/codigo-interno'
import '@/lib/zod-es'
import { monedaDocumentoEnum } from '@/lib/moneda'
import { validarListaSucursales } from '@/lib/clientes/validar-sucursales'
import { telefonoEsValido } from '@/lib/telefono'

// ============ ENUMS ============

export const tipoClienteEnum = z.enum([
  'HOSPITAL',
  'CLINICA',
  'CONSULTORIO',
  'SANATORIO',
  'ORGANISMO_PUBLICO',
  'OTRO',
])

export const sucursalClienteSchema = z.object({
  nombre: z.string().trim().min(2, 'El nombre de la sucursal debe tener al menos 2 caracteres').max(120),
  direccion: z.string().trim().max(200).optional().nullable(),
  numero: z.string().trim().max(20).optional().nullable(),
  ciudad: z.string().trim().max(100).optional().nullable(),
  lat: z.number().optional().nullable(),
  lng: z.number().optional().nullable(),
  notas: z.string().trim().max(500).optional().nullable(),
})

/** POST /api/clientes/[id]/sucursales — misma forma que sucursalClienteSchema + activo. */
export const sucursalInstalacionCreateSchema = sucursalClienteSchema.extend({
  activo: z.boolean().optional(),
})

/** PATCH /api/clientes/[id]/sucursales/[sucursalId] */
export const sucursalInstalacionUpdateSchema = sucursalInstalacionCreateSchema
  .partial()
  .refine((d) => Object.keys(d).length > 0, { message: 'Nada para actualizar' })
export const estadoOTEnum = z.enum(['ABIERTA', 'EN_PROCESO', 'CERRADA', 'VENCIDA', 'CANCELADA'])
export const prioridadEnum = z.enum(['BAJA', 'NORMAL', 'ALTA', 'URGENTE'])
export const tipoFacturaEnum = z.enum(['A', 'B', 'C'])
export const estadoFacturaEnum = z.enum([
  'BORRADOR', 'PENDIENTE', 'PENDIENTE_CAE', 'EMITIDA', 'RECHAZADA', 'PAGADA', 'VENCIDA', 'ANULADA',
])
export const estadoPresupuestoEnum = z.enum(['BORRADOR', 'ENVIADO', 'APROBADO', 'RECHAZADO', 'VENCIDO', 'CONVERTIDO'])
export const medioPagoEnum = z.enum(['TRANSFERENCIA', 'EFECTIVO', 'CHEQUE', 'TARJETA', 'OTRO'])

// Email opcional que acepta cadena vacía o ausente
const emailOpcional = z
  .string()
  .trim()
  .optional()
  .refine((v) => v === undefined || v === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), {
    message: 'Email inválido',
  })

const telefonoOpcional = z
  .string()
  .trim()
  .max(40)
  .optional()
  .refine((v) => telefonoEsValido(v), { message: 'Teléfono inválido' })

const telefonoNullable = z
  .string()
  .trim()
  .max(40)
  .optional()
  .nullable()
  .refine((v) => telefonoEsValido(v ?? ''), { message: 'Teléfono inválido' })

// ============ CLIENTE ============

const clienteFieldsSchema = z.object({
  nombre:        z.string().trim().min(2, 'El nombre debe tener al menos 2 caracteres'),
  tipo:          tipoClienteEnum,
  cuit:          z.string().trim().max(20).optional(),
  direccion:     z.string().trim().max(200).optional(),
  ciudad:        z.string().trim().max(100).optional(),
  telefono:      telefonoOpcional,
  email:         emailOpcional,
  contacto:      z.string().trim().max(120).optional(),
  // Ficha 360°: datos fiscales y comerciales
  condicionIva:  z.string().trim().max(60).optional(),
  condicionPago: z.string().trim().max(60).optional(),
  limiteCredito: z.number().nonnegative('El límite de crédito no puede ser negativo').optional().nullable(),
  segmento:      z.string().trim().max(40).optional(),
  sitioWeb:      z.string().trim().max(200).optional(),
  notas:         z.string().trim().max(1000).optional(),
  alicuotaIvaId: z.string().min(1).optional().nullable(),
  listaPreciosId: z.string().min(1).optional().nullable(),
  esMayorista: z.boolean().optional(),
  monedaPreferida: z.enum(['ARS', 'USD']).optional().nullable(),
  sucursales:    z.array(sucursalClienteSchema).optional(),
})

function validarSucursalesCliente(
  data: { sucursales?: z.infer<typeof sucursalClienteSchema>[] },
  ctx: z.RefinementCtx,
) {
  const sucursales = data.sucursales ?? []
  if (sucursales.length === 0) return
  const err = validarListaSucursales(sucursales)
  if (err) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: err,
      path: ['sucursales'],
    })
  }
}

export const clienteCreateSchema = clienteFieldsSchema.superRefine(validarSucursalesCliente)

// Para PATCH: todos los campos opcionales + posibilidad de (des)activar
// (Zod v4 no permite .partial() sobre esquemas con refinements — aplicar refine después)
export const clienteUpdateSchema = clienteFieldsSchema.partial().extend({
  activo: z.boolean().optional(),
}).superRefine(validarSucursalesCliente)

// ============ ORDEN DE TRABAJO ============

export const tipoOTEnum = z.enum(['CORRECTIVO', 'PREVENTIVO', 'INSTALACION', 'CALIBRACION', 'GARANTIA'])

export const equipoNuevoOtSchema = z.object({
  nombre:        z.string().trim().min(2, 'El nombre del equipo debe tener al menos 2 caracteres'),
  marca:         z.string().trim().max(80).optional().nullable(),
  modelo:        z.string().trim().max(80).optional().nullable(),
  numeroSerie:   z.string().trim().max(80).optional().nullable(),
  notasTecnicas: z.string().trim().max(2000).optional().nullable(),
})

/** POST /api/clientes/[id]/equipos — alta externa en ficha del cliente (origen EXTERNO). */
export const equipoClienteCreateSchema = equipoNuevoOtSchema

export const otCreateSchema = z
  .object({
    descripcion: z.string().trim().min(5, 'La descripción debe tener al menos 5 caracteres'),
    clienteId:   z.string().min(1, 'El cliente es obligatorio'),
    equipoId:    z.string().min(1).optional().nullable(),
    equipoNuevo: equipoNuevoOtSchema.optional().nullable(),
    tecnicoId:   z.string().min(1).optional().nullable(),
    prioridad:   prioridadEnum.default('NORMAL'),
    slaHoras:    z.number().int().positive().max(24 * 30).default(48),
    tipo:        tipoOTEnum.default('CORRECTIVO'),
  })
  .refine((d) => !(d.equipoId && d.equipoNuevo), {
    message: 'Indicá un equipo existente o cargá uno nuevo, no ambos',
    path: ['equipoId'],
  })

/** Webhook n8n — mismas reglas que POST /api/ots + conversacionId opcional. */
export const otN8nCreateSchema = otCreateSchema.extend({
  conversacionId: z.string().min(1).optional(),
})

// ============ CRM / n8n ============

/** Contenido de mensaje saliente — misma regla UI y webhooks n8n. */
export const crmMensajeContenidoSchema = z
  .object({
    contenido: z.string().trim().max(4000).optional(),
    adjuntoUrl: z
      .string()
      .trim()
      .optional()
      .refine(
        (v) => !v || v.startsWith('/api/crm/media/') || /^https?:\/\//i.test(v),
        { message: 'URL de adjunto inválida' },
      ),
  })
  .refine(
    (d) => (d.contenido && d.contenido.length >= 1) || d.adjuntoUrl,
    { message: 'Debés escribir un mensaje o adjuntar un archivo' },
  )

export const crmSnippetCreateSchema = z.object({
  titulo: z.string().trim().min(2).max(80),
  cuerpo: z.string().trim().min(1).max(4000),
  activo: z.boolean().optional(),
  orden: z.number().int().nonnegative().optional(),
})

export const crmSnippetUpdateSchema = crmSnippetCreateSchema.partial().refine(
  (d) => Object.keys(d).length > 0,
  { message: 'Debés enviar al menos un campo' },
)

/** Webhook n8n responder — POST /api/n8n/responder (solo texto). */
export const mensajeN8nResponderSchema = z.object({
  conversacionId: z.string().min(1),
  contenido: z.string().trim().min(1).max(4000),
})

/** Webhook n8n etiquetar — POST /api/n8n/etiquetar. */
export const conversacionEtiquetasN8nSchema = z.object({
  conversacionId: z.string().min(1),
  etiquetas: z.array(z.string().trim().min(1)).min(1),
  modo: z.enum(['agregar', 'reemplazar']).default('agregar'),
})

/** Webhook n8n crear lead — POST /api/n8n/crear-lead (cliente mínimo tipo OTRO). */
export const leadN8nCreateSchema = z.object({
  nombre: z.string().trim().min(2),
  email: emailOpcional,
  telefono: telefonoOpcional,
  notas: z.string().trim().max(1000).optional(),
  conversacionId: z.string().min(1).optional(),
})

// ============ CRM EMBUDO ============

export const etapaEmbudoEnum = z.enum([
  'ENTRADA', 'CONTACTO', 'DOCUMENTACION', 'PROPUESTA', 'SEGUIMIENTO', 'ANALISIS', 'ENTREGA', 'CIERRE', 'PERDIDO',
])

export const urgenciaEmbudoEnum = z.enum(['NORMAL', 'URGENTE'])

/** POST /api/crm/embudo — crear negocio en el embudo. */
export const embudoNegocioCreateSchema = z.object({
  nombre: z.string().min(1),
  cliente: z.string().min(1),
  clienteId: z.string().min(1).optional().nullable(),
  productoServicio: z
    .string()
    .optional()
    .nullable()
    .transform((v) => {
      const t = v?.trim() ?? ''
      return t === '' ? null : t
    }),
  inventarioId: z.string().min(1).optional().nullable(),
  conversacionId: z.string().min(1).optional().nullable(),
  monto: z.number().optional(),
  vendedor: z.string().min(1),
  urgencia: urgenciaEmbudoEnum.optional(),
  notas: z.string().optional(),
}).transform((d) => ({ ...d, etapa: 'ENTRADA' as const }))

/** PATCH /api/crm/embudo/[id] — actualizar negocio. */
export const embudoNegocioPatchSchema = z.object({
  nombre: z.string().min(1).optional(),
  cliente: z.string().min(1).optional(),
  clienteId: z.string().min(1).optional().nullable(),
  productoServicio: z.string().optional(),
  monto: z.number().optional(),
  vendedor: z.string().optional(),
  urgencia: urgenciaEmbudoEnum.optional(),
  notas: z.string().optional(),
  proximaAccionFecha: z.string().optional().nullable(),
  presupuestoId: z.string().min(1).optional().nullable(),
})

/** PATCH /api/crm/embudo/seguimiento/[id] — editar registro (solo SUPERADMIN). */
export const embudoSeguimientoPatchSchema = z.object({
  notas: z.string().max(2000).optional().nullable(),
  datos: z.record(z.string(), z.unknown()).optional(),
}).refine((d) => d.notas !== undefined || d.datos !== undefined, {
  message: 'Indicá al menos un campo para actualizar',
})

/** POST /api/crm/embudo/[id]/mover — transición de etapa. */
export const embudoMoverSchema = z.object({
  etapaHasta: etapaEmbudoEnum,
  retroceso: z.boolean().optional(),
  datos: z.record(z.string(), z.unknown()).optional(),
})

export const otUpdateSchema = z
  .object({
    estado:      estadoOTEnum.optional(),
    nota:        z.string().trim().max(500).optional(),
    diagnostico: z.string().trim().max(2000).optional(),
    checklistSolucion: z.array(z.object({
      tarea: z.string().trim().min(1).max(200),
      completado: z.boolean(),
    })).optional(),
    tecnicoId:   z.string().min(1).optional().nullable(),
    crearPlanPreventivo: z.boolean().optional(),
    repuestos: z.array(z.object({
      descripcion: z.string().trim().min(1, 'La descripción del repuesto es obligatoria'),
      cantidad:    z.number().int().positive(),
      precioUnit:  z.number().nonnegative(),
      inventarioId: z.string().min(1).optional().nullable(),
    })).optional(),
  })
  .refine(
    (data) => Object.values(data).some((v) => v !== undefined),
    { message: 'Debés enviar al menos un campo para actualizar' },
  )

// ============ FACTURA ============

// URL de foto (ruta interna del ERP o URL absoluta)
const fotoUrlOpcional = z
  .string()
  .trim()
  .optional()
  .refine(
    (v) => !v || v === '' || v.startsWith('/api/') || /^https?:\/\//i.test(v),
    { message: 'URL de foto inválida' },
  )

export const itemFacturaSchema = z.object({
  codigo:           z.string().trim().max(40).optional(),
  descripcion:      z.string().trim().min(1, 'La descripción del ítem es obligatoria'),
  descripcionLarga: z.string().trim().max(2000).optional(),
  fotoUrl:          fotoUrlOpcional.or(z.literal('')),
  cantidad:         z.number().int().positive('La cantidad debe ser mayor a 0'),
  precioUnit:       z.number().nonnegative('El precio no puede ser negativo'),
  bonificacionPct:  z.number().min(0).max(100).optional(),
  inventarioId:     z.string().min(1).optional().nullable(),
  /** Solo validación UI↔API; no se persiste en FacturaItem. */
  tipoArticulo:     z.enum(['REPUESTO', 'CONSUMIBLE', 'ACCESORIO', 'BATERIA', 'EQUIPO']).optional().nullable(),
  alicuotaIvaPct:   z.number().min(0).max(100).optional().nullable(),
  numeroSerie:      z.string().trim().max(80).optional().nullable(),
  proximoPreventivo: z.coerce.date().optional().nullable(),
  sucursalInstalacionId: z.string().min(1).optional().nullable(),
  inventarioUnidadId: z.string().min(1).optional().nullable(),
})

/** Ítems de presupuesto: sin sucursal (se exige al facturar, invariante Pr1). */
export const itemPresupuestoSchema = itemFacturaSchema.omit({ sucursalInstalacionId: true })

/** @deprecated Usar itemFacturaSchema o itemPresupuestoSchema según el documento. */
export const itemDocumentoSchema = itemFacturaSchema

export const facturaCreateSchema = z.object({
  clienteId:       z.string().min(1, 'El cliente es obligatorio'),
  emisorId:        z.string().min(1).optional().nullable(),
  plantillaId:     z.string().min(1).optional().nullable(),
  tipo:            tipoFacturaEnum,
  estado:          estadoFacturaEnum.default('BORRADOR'),
  moneda:          monedaDocumentoEnum.default('ARS'),
  cotizacionUsd:   z.number().positive().optional().nullable(),
  otId:            z.string().min(1).optional().nullable(),
  presupuestoId:   z.string().min(1).optional().nullable(),
  condicionPago:   z.string().trim().max(60).optional(),
  plazosCobranza:  z.array(z.number().int().positive().max(730)).min(1).max(12).optional(),
  observaciones:   z.string().trim().max(2000).optional(),
  bonificacionPct: z.number().min(0).max(100).optional(),
  alicuotaIvaPct:  z.number().min(0).max(100).optional(),
  items:           z.array(itemFacturaSchema).min(1, 'La factura debe tener al menos un ítem'),
})

/** PATCH /api/facturas/[id] — edición borrador/rechazada. */
export const facturaUpdateSchema = z.object({
  emisorId:        z.string().min(1).optional().nullable(),
  plantillaId:     z.string().min(1).optional().nullable(),
  tipo:            tipoFacturaEnum.optional(),
  condicionPago:   z.string().trim().max(60).optional(),
  observaciones:   z.string().trim().max(2000).optional(),
  bonificacionPct: z.number().min(0).max(100).optional(),
  items:           z.array(itemFacturaSchema).min(1).optional(),
}).refine((d) => Object.keys(d).length > 0, { message: 'Nada para actualizar' })

export const presupuestoCreateSchema = z.object({
  clienteId:             z.string().min(1),
  otId:                  z.string().min(1).optional().nullable(),
  emisorId:              z.string().min(1).optional().nullable(),
  plantillaId:           z.string().min(1).optional().nullable(),
  moneda:                monedaDocumentoEnum.default('ARS'),
  cotizacionUsd:         z.number().positive().optional().nullable(),
  condicionPago:         z.string().trim().max(60).optional(),
  plazosCobranza:        z.array(z.number().int().positive().max(730)).min(1).max(12).optional(),
  tasaFinanciacionPct:   z.number().min(0).max(100).optional(),
  interesFinanciacion:   z.number().min(0).optional(),
  vigenciaDias:          z.number().int().positive().default(15),
  observaciones:         z.string().trim().max(2000).optional(),
  formaPago:             z.string().trim().max(120).optional(),
  plazoEntrega:          z.string().trim().max(120).optional(),
  garantia:              z.string().trim().max(120).optional(),
  bonificacionPct:       z.number().min(0).max(100).optional(),
  alicuotaIvaPct:        z.number().min(0).max(100).optional(),
  items:                 z.array(itemPresupuestoSchema).min(1),
})

export const presupuestoUpdateSchema = z.object({
  estado:          estadoPresupuestoEnum.optional(),
  moneda:          monedaDocumentoEnum.optional(),
  cotizacionUsd:   z.number().positive().optional().nullable(),
  condicionPago:   z.string().trim().max(60).optional(),
  vigenciaDias:    z.number().int().positive().optional(),
  observaciones:   z.string().trim().max(2000).optional(),
  formaPago:       z.string().trim().max(120).optional(),
  plazoEntrega:    z.string().trim().max(120).optional(),
  garantia:        z.string().trim().max(120).optional(),
  items:           z.array(itemPresupuestoSchema).min(1).optional(),
}).refine((d) => Object.keys(d).length > 0, { message: 'Nada para actualizar' })

export const chequeDatosSchema = z.object({
  numero: z.string().trim().min(1).max(40),
  banco: z.string().trim().max(80).optional(),
  titular: z.string().trim().max(120).optional(),
  fechaVencimiento: z.string().min(1),
})

export const pagoCreateSchema = z.object({
  clienteId: z.string().min(1),
  monto:     z.number().positive(),
  medio:     medioPagoEnum.default('TRANSFERENCIA'),
  referencia: z.string().trim().max(80).optional(),
  notas:     z.string().trim().max(500).optional(),
  cuentaTesoreriaId: z.string().min(1).optional(),
  cheque:    chequeDatosSchema.optional(),
  imputaciones: z.array(z.object({
    facturaId: z.string().min(1),
    monto:     z.number().positive(),
  })).min(1),
}).refine(
  (d) => d.medio !== 'CHEQUE' || !!d.cheque,
  { message: 'Completá los datos del cheque', path: ['cheque'] },
).refine(
  (d) => d.medio !== 'TARJETA' || (d.referencia?.trim().length ?? 0) > 0,
  { message: 'Indicá el N° de cupón o lote de la tarjeta', path: ['referencia'] },
)

export const chequeDepositoSchema = z.object({
  accion: z.enum(['depositar', 'rechazar', 'anular']),
})

export const pagoAccionSchema = z.object({
  accion: z.enum(['anular', 'conciliar']),
})

const tipoCuentaTesoreriaEnum = z.enum(['BANCO', 'CAJA'])
const tipoMovimientoTesoreriaManualEnum = z.enum(['INGRESO', 'EGRESO', 'AJUSTE'])

export const cuentaTesoreriaCreateSchema = z.object({
  nombre: z.string().trim().min(2).max(120),
  tipo: tipoCuentaTesoreriaEnum,
  banco: z.string().trim().max(120).optional(),
  cbu: z.string().trim().max(22).optional(),
  alias: z.string().trim().max(40).optional(),
  moneda: z.string().trim().max(8).default('ARS'),
  planCuentaId: z.string().min(1).optional().nullable(),
  predeterminada: z.boolean().optional(),
})

export const cuentaTesoreriaUpdateSchema = z.object({
  nombre: z.string().trim().min(2).max(120).optional(),
  banco: z.string().trim().max(120).optional().nullable(),
  cbu: z.string().trim().max(22).optional().nullable(),
  alias: z.string().trim().max(40).optional().nullable(),
  moneda: z.string().trim().max(8).optional(),
  planCuentaId: z.string().min(1).optional().nullable(),
  activa: z.boolean().optional(),
  predeterminada: z.boolean().optional(),
})

export const saldoInicialTesoreriaSchema = z.object({
  fecha: z.coerce.date(),
  monto: z.number().positive(),
})

export const movimientoTesoreriaCreateSchema = z.object({
  cuentaTesoreriaId: z.string().min(1),
  fecha: z.coerce.date(),
  tipo: tipoMovimientoTesoreriaManualEnum,
  monto: z.number(),
  descripcion: z.string().trim().min(2).max(500),
  referencia: z.string().trim().max(120).optional(),
})

export const conciliarMovimientoSchema = z.object({
  extractoRef: z.string().trim().max(120).optional(),
  notaConciliacion: z.string().trim().max(500).optional(),
})

export const transferenciaTesoreriaSchema = z.object({
  cuentaOrigenId: z.string().min(1),
  cuentaDestinoId: z.string().min(1),
  monto: z.number().positive(),
  fecha: z.coerce.date(),
  descripcion: z.string().trim().min(2).max(500).optional(),
})

export const conciliarExtractoSchema = z.object({
  matches: z.array(z.object({
    movimientoId: z.string().min(1),
    extractoRef: z.string().trim().min(1).max(120),
  })).min(1),
})

export const cuotaPagoSchema = z.object({
  numeroCuota: z.number().int().positive(),
  fecha: z.coerce.date(),
  monto: z.number().positive(),
})

export function validarCuotasConTotal(cuotas: { monto: number }[], total: number): boolean {
  const sum = Math.round(cuotas.reduce((a, c) => a + c.monto, 0) * 100) / 100
  return Math.abs(sum - total) <= 0.01
}

export const clasificacionOrigenOcEnum = z.enum([
  'REPUESTO_OT',
  'STOCK_REPOSICION',
  'EQUIPO_VENTA',
  'SHOWROOM_MUESTRA',
  'GASTO_EDILICIO',
  'ALQUILER',
  'SERVICIO',
  'OTRO',
])

export const ordenCompraItemSchema = z.object({
  inventarioId: z.string().min(1).optional().nullable(),
  concepto:     z.string().trim().max(120).optional().nullable(),
  descripcion:  z.string().trim().min(1, 'La descripción es obligatoria'),
  cantidad:     z.number().int().positive('La cantidad debe ser mayor a 0'),
  precioUnit:   z.number().nonnegative('El precio no puede ser negativo'),
  precioLista:  z.number().nonnegative().optional().nullable(),
  bonificacionPct: z.number().min(0).max(100).optional(),
  depositoDestinoId: z.string().min(1).optional().nullable(),
})

export const ordenCompraCreateSchema = z.object({
  proveedorId: z.string().min(1, 'El proveedor es obligatorio'),
  observaciones: z.string().trim().max(1000).optional(),
  solicitanteId: z.string().min(1).optional().nullable(),
  justificacion: z.string().trim().max(2000).optional().nullable(),
  clasificacionOrigen: clasificacionOrigenOcEnum.optional().nullable(),
  ordenTrabajoId: z.string().min(1).optional().nullable(),
  presupuestoId: z.string().min(1).optional().nullable(),
  clienteId: z.string().min(1).optional().nullable(),
  depositoDestinoDefaultId: z.string().min(1).optional().nullable(),
  moneda: z.string().trim().min(1).optional(),
  cotizacionUsd: z.number().positive().optional().nullable(),
  plantillaOcId: z.string().min(1).optional().nullable(),
  items: z.array(ordenCompraItemSchema).min(1, 'Agregá al menos un ítem'),
})

export const ordenCompraUpdateSchema = ordenCompraCreateSchema

export const ordenCompraRecibirItemSchema = z.object({
  id: z.string().min(1),
  cantidad: z.number().int().positive(),
  depositoId: z.string().min(1).optional(),
  ubicacionDetalle: z.string().trim().max(200).optional(),
  unidades: z.array(z.object({
    numeroSerie: z.string().trim().max(120).optional(),
    lote: z.string().trim().max(120).optional(),
  })).optional(),
})

export const ordenCompraRecibirSchema = z.object({
  items: z.array(ordenCompraRecibirItemSchema).min(1),
})

export const plantillaOcItemSchema = z.object({
  descripcion: z.string().trim().min(1),
  concepto: z.string().trim().max(120).optional().nullable(),
  cantidad: z.number().int().positive(),
  precioUnit: z.number().nonnegative(),
  inventarioId: z.string().min(1).optional().nullable(),
})

export const plantillaOcCreateSchema = z.object({
  nombre: z.string().trim().min(1),
  clasificacionOrigen: clasificacionOrigenOcEnum,
  proveedorId: z.string().min(1),
  descripcionDefault: z.string().trim().max(1000).optional().nullable(),
  justificacionDefault: z.string().trim().max(2000).optional().nullable(),
  moneda: z.string().trim().min(1).optional(),
  activa: z.boolean().optional(),
  recordatorioDiaMes: z.number().int().min(1).max(28).optional().nullable(),
  items: z.array(plantillaOcItemSchema).min(1),
})

export const plantillaOcUpdateSchema = plantillaOcCreateSchema.partial().extend({
  items: z.array(plantillaOcItemSchema).min(1).optional(),
})

export const ordenCompraRechazarSchema = z.object({
  motivo: z.string().trim().min(3, 'Indicá el motivo del rechazo').max(500),
})

// ============ FACTURAS DE COMPRA ============

export const tipoFacturaCompraEnum = z.enum(['REMITO', 'CONCEPTOS'])

export const estadoFacturaCompraEnum = z.enum(['BORRADOR', 'REGISTRADA', 'ANULADA'])

export const facturaCompraItemSchema = z.object({
  descripcion: z.string().trim().min(1, 'La descripción es obligatoria'),
  concepto: z.string().trim().max(120).optional().nullable(),
  cantidad: z.number().positive('La cantidad debe ser mayor a 0'),
  precioUnitario: z.number().nonnegative('El precio no puede ser negativo'),
  precioLista: z.number().nonnegative().optional().nullable(),
  bonificacionPct: z.number().min(0).max(100).optional(),
  alicuotaIvaPct: z.number().min(0).max(100).optional(),
  inventarioId: z.string().min(1).optional().nullable(),
  itemOrdenCompraId: z.string().min(1).optional().nullable(),
})

const facturaCompraBodySchema = z.object({
  proveedorId: z.string().min(1, 'El proveedor es obligatorio'),
  tipo: tipoFacturaCompraEnum,
  fecha: z.coerce.date(),
  fechaVencimiento: z.coerce.date().optional().nullable(),
  puntoVenta: z.number().int().min(1).max(99999),
  numeroComprobante: z.number().int().min(1),
  tipoComprobanteAfipId: z.string().min(1).optional().nullable(),
  moneda: z.string().trim().min(1).max(8).optional(),
  ordenCompraId: z.string().min(1).optional().nullable(),
  fcSinRecepcion: z.boolean().optional(),
  notaFcSinRecepcion: z.string().trim().max(500).optional().nullable(),
  notaMonedaOc: z.string().trim().max(500).optional().nullable(),
  cae: z.string().trim().max(20).optional().nullable(),
  caeVencimiento: z.coerce.date().optional().nullable(),
  items: z.array(facturaCompraItemSchema).min(1, 'Agregá al menos un ítem'),
  cuotas: z.array(cuotaPagoSchema).min(1).optional(),
})

function validarCuotasEnFc(
  data: z.infer<typeof facturaCompraBodySchema>,
  ctx: z.RefinementCtx,
) {
  if (!data.cuotas?.length) return
  const netoItems = data.items.reduce((acc, it) => {
    const n = it.cantidad * it.precioUnitario
    const iva = n * ((it.alicuotaIvaPct ?? 21) / 100)
    return acc + n + iva
  }, 0)
  const totalEst = Math.round(netoItems * 100) / 100
  if (!validarCuotasConTotal(data.cuotas, totalEst)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'La suma de cuotas debe coincidir con el total de la factura',
      path: ['cuotas'],
    })
  }
}

export const facturaCompraCreateSchema = facturaCompraBodySchema
  .extend({ registrar: z.boolean().optional() })
  .superRefine(validarCuotasEnFc)

export const facturaCompraUpdateSchema = facturaCompraBodySchema.superRefine(validarCuotasEnFc)

export const facturaCompraDesdeOcSchema = z.object({
  ordenCompraId: z.string().min(1, 'La orden de compra es obligatoria'),
  tipo: tipoFacturaCompraEnum.optional(),
  fecha: z.coerce.date().optional(),
  puntoVenta: z.number().int().min(1).max(99999).optional(),
  numeroComprobante: z.number().int().min(1).optional(),
  tipoComprobanteAfipId: z.string().min(1).optional().nullable(),
  registrar: z.boolean().optional(),
})

export const libroComprasQuerySchema = z.object({
  desde: z.coerce.date(),
  hasta: z.coerce.date(),
  proveedorId: z.string().min(1).optional(),
  formato: z.enum(['json', 'csv']).optional(),
})

export const pagoProveedorCreateSchema = z.object({
  proveedorId: z.string().min(1),
  monto: z.number().positive(),
  moneda: z.string().trim().min(1).max(8).optional(),
  fecha: z.coerce.date().optional(),
  medio: medioPagoEnum.default('TRANSFERENCIA'),
  cuentaTesoreriaId: z.string().min(1).optional(),
  referencia: z.string().trim().max(80).optional(),
  notas: z.string().trim().max(500).optional(),
  facturaCompraId: z.string().min(1).optional(),
  imputaciones: z.array(z.object({
    vencimientoPagoId: z.string().min(1),
    monto: z.number().positive(),
  })).min(1),
  cheque: z.object({
    numero: z.string().trim().min(1),
    banco: z.string().trim().max(80).optional(),
    fechaEmision: z.coerce.date().optional(),
    fechaDebito: z.coerce.date().optional(),
  }).optional(),
}).refine(
  (d) => d.medio !== 'CHEQUE' || !!d.cheque,
  { message: 'Completá los datos del cheque', path: ['cheque'] },
).refine(
  (d) => !!d.cuentaTesoreriaId,
  { message: 'Seleccioná la cuenta de tesorería', path: ['cuentaTesoreriaId'] },
)

export const chequeEmitidoDebitarSchema = z.object({
  fechaDebito: z.coerce.date().optional(),
})

export const chequeEmitidoCreateSchema = z.object({
  proveedorId: z.string().min(1),
  numero: z.string().trim().min(1),
  banco: z.string().trim().max(80).optional(),
  monto: z.number().positive(),
  fechaEmision: z.coerce.date().optional(),
  fechaDebito: z.coerce.date().optional(),
  cuentaTesoreriaId: z.string().min(1),
  pagoProveedorId: z.string().min(1).optional(),
})

export const alertaCompraDismissSchema = z.object({
  alertKey: z.string().trim().min(1),
})

/** POST /api/inventario/generar-oc — solo proveedor; ítems se resuelven en servidor. */
export const generarOcFaltantesSchema = z.object({
  proveedorId: z.string().min(1, 'El proveedor es obligatorio'),
})

export const planMantenimientoCreateSchema = z.object({
  equipoId:        z.string().min(1),
  descripcion:     z.string().trim().min(3),
  intervaloDias:   z.number().int().positive().default(180),
  proximoServicio: z.coerce.date().optional(),
  tecnicoId:       z.string().min(1).optional().nullable(),
  notas:           z.string().trim().max(500).optional(),
})

// ============ INVENTARIO ============

export const inventarioKitItemSchema = z.object({
  id:               z.string().optional(),
  nombre:           z.string().trim().min(1),
  tipoItem:         z.enum(['ACCESORIO_ESPECIFICO', 'ACCESORIO_GENERICO', 'BATERIA', 'COMPONENTE', 'REPUESTO_INCLUIDO']),
  tipoComponente:   z.enum(['BATERIA', 'FILTRO', 'CALIBRACION', 'SENSOR', 'OTRO']).optional().nullable(),
  inventarioHijoId: z.string().min(1).optional().nullable(),
  obligatorio:      z.boolean().default(false),
  cantidad:         z.number().int().positive().default(1),
  mesesVencimiento: z.number().int().positive().optional().nullable(),
  notas:            z.string().trim().max(200).optional().nullable(),
  orden:            z.number().int().nonnegative().optional(),
})

export const inventarioCreateSchema = z.object({
  nombre:       z.string().trim().min(2, 'El nombre debe tener al menos 2 caracteres'),
  descripcion:  z.string().trim().max(300).optional(),
  sku:          codigoInternoSchema,
  tipoArticulo: z.enum(['REPUESTO', 'CONSUMIBLE', 'ACCESORIO', 'BATERIA', 'EQUIPO']).default('REPUESTO'),
  marca:        z.string().trim().max(80).optional().nullable(),
  modelo:       z.string().trim().max(80).optional().nullable(),
  esSerializado: z.boolean().default(false),
  requierePreventivo: z.boolean().default(false),
  intervaloPreventivoDias: z.number().int().positive().optional().nullable(),
  modoTrazabilidad: z.enum(['NINGUNA', 'SERIE', 'LOTE', 'SERIE_Y_LOTE']).default('NINGUNA'),
  stock:        z.number().int().nonnegative('El stock no puede ser negativo').default(0),
  stockMinimo:  z.number().int().nonnegative('El stock mínimo no puede ser negativo').default(5),
  stockMaximo:  z.number().int().positive().optional().nullable(),
  puntoPedido:  z.number().int().nonnegative().optional().nullable(),
  precioUnit:   z.number().nonnegative('El precio no puede ser negativo').optional().nullable(),
  moneda:       monedaDocumentoEnum.default('ARS'),
  categoria:    z.string().trim().max(60).optional(),
  alicuotaIvaId: z.string().min(1).optional().nullable(),
  kitItems:     z.array(inventarioKitItemSchema).optional(),
})

export const inventarioAjusteSchema = z.object({
  cantidad: z.number().int().positive('La cantidad debe ser mayor a 0'),
  tipo:     z.enum(['ENTRADA', 'SALIDA', 'AJUSTE']),
  motivo:   z.string().trim().max(200).optional(),
  depositoId: z.string().min(1).optional(),
  ubicacionDetalle: z.string().trim().max(200).optional().nullable(),
})

export const inventarioTransferenciaSchema = z
  .object({
    depositoOrigenId: z.string().min(1, 'Seleccioná depósito de origen'),
    depositoDestinoId: z.string().min(1, 'Seleccioná depósito de destino'),
    cantidad: z.number().int().positive('La cantidad debe ser mayor a 0').optional(),
    unidadIds: z.array(z.string().min(1)).optional(),
    ubicacionDetalleDestino: z.string().trim().max(200).optional().nullable(),
    motivo: z.string().trim().max(200).optional(),
  })
  .refine((d) => d.depositoOrigenId !== d.depositoDestinoId, {
    message: 'Origen y destino deben ser distintos',
    path: ['depositoDestinoId'],
  })
  .refine((d) => (d.cantidad != null && d.cantidad > 0) || (d.unidadIds != null && d.unidadIds.length > 0), {
    message: 'Indicá cantidad o seleccioná unidades',
    path: ['cantidad'],
  })

export const inventarioUpdateSchema = inventarioCreateSchema.partial().extend({
  activo: z.boolean().optional(),
  sku: codigoInternoOpcionalSchema.optional(),
  kitItems: z.array(inventarioKitItemSchema).optional(),
})

export const inventarioUnidadCreateSchema = z.object({
  numeroSerie: z.string().trim().max(80).optional().nullable(),
  lote:        z.string().trim().max(80).optional().nullable(),
  notas:       z.string().trim().max(500).optional().nullable(),
  fechaIngreso: z.coerce.date().optional(),
  depositoId: z.string().min(1).optional().nullable(),
  ubicacionDetalle: z.string().trim().max(200).optional().nullable(),
})

export const inventarioUnidadUpdateSchema = inventarioUnidadCreateSchema.partial().extend({
  estado: z.enum(['EN_STOCK', 'RESERVADO', 'EN_ALQUILER', 'VENDIDO', 'BAJA']).optional(),
})

// ============ USUARIOS ============

const usuarioPasswordFieldsSchema = z
  .object({
    password: z.string().min(1, 'Ingresá una contraseña').optional(),
    confirmarPassword: z.string().optional(),
    exigirCambioPassword: z.boolean().optional(),
  })
  .refine(
    (d) => !d.password || d.password === d.confirmarPassword,
    { message: 'Las contraseñas no coinciden', path: ['confirmarPassword'] },
  )

export const usuarioCreateSchema = z
  .object({
    nombre:   z.string().trim().min(2, 'El nombre debe tener al menos 2 caracteres'),
    email:    z.string().trim().email('Email inválido').toLowerCase(),
    telefono: telefonoOpcional,
    roles:    z.array(z.string().min(1)).min(1, 'Asigná al menos un rol'),
  })
  .merge(usuarioPasswordFieldsSchema)

export const usuarioUpdateSchema = z
  .object({
    nombre:   z.string().trim().min(2).optional(),
    telefono: telefonoNullable,
    roles:    z.array(z.string().min(1)).min(1).optional(),
    activo:   z.boolean().optional(),
  })
  .merge(usuarioPasswordFieldsSchema)
  .refine((d) => Object.keys(d).length > 0, { message: 'Nada para actualizar' })

export const rolePermisosUpdateSchema = z.object({
  permisos: z.array(z.string().min(1)).min(1, 'El rol debe tener al menos un permiso'),
})

// ============ PERFIL (edición propia) ============

export const perfilUpdateSchema = z
  .object({
    nombre:    z.string().trim().min(2).optional(),
    telefono:  telefonoNullable,
    avatarUrl: z
      .string()
      .trim()
      .max(500)
      .optional()
      .nullable()
      .or(z.literal(''))
      .refine(
        (v) => !v || v.startsWith('https://') || v.startsWith('/api/perfil/media/'),
        'URL de avatar inválida',
      ),
  })
  .refine((d) => Object.keys(d).length > 0, { message: 'Nada para actualizar' })

export const cambiarPasswordSchema = z.object({
  actual: z.string().optional(),
  nueva:  z.string().min(1, 'Ingresá la nueva contraseña'),
})

// ============ EMISORES ============

export const emisorCreateSchema = z.object({
  razonSocial:       z.string().trim().min(2, 'La razón social es obligatoria'),
  cuit:              z.string().trim().regex(/^\d{2}-?\d{8}-?\d$/, 'CUIT inválido (formato 20-12345678-9)'),
  condicionIva:      z.string().trim().min(2).default('Responsable Inscripto'),
  ingresosBrutos:    z.string().trim().max(40).optional(),
  inicioActividades: z.coerce.date().optional(),
  domicilio:         z.string().trim().max(200).optional(),
  ciudad:            z.string().trim().max(100).optional(),
  telefono:          telefonoOpcional,
  email:             z.string().trim().email('Email inválido').optional().or(z.literal('')),
  certificadoAlias:  z.string().trim().max(120).optional(),
  ambiente:          z.enum(['HOMOLOGACION', 'PRODUCCION']).default('HOMOLOGACION'),
  puntoVenta:        z.number().int().positive().default(1),
  predeterminado:    z.boolean().default(false),
  confirmarProduccion: z.boolean().optional(),
})

export const emisorUpdateSchema = emisorCreateSchema.partial().extend({
  activo: z.boolean().optional(),
})

// ============ PROVEEDORES ============

export const origenProveedorEnum = z.enum(['NACIONAL', 'IMPORTADO'])

export const tipoCompraProveedorEnum = z.enum(['REMITO', 'CONCEPTOS', 'AMBOS'])

export const estadoOrdenCompraEnum = z.enum([
  'BORRADOR',
  'PENDIENTE_APROBACION',
  'APROBADA',
  'RECHAZADA',
  'ENVIADA',
  'PARCIAL',
  'RECIBIDA',
  'CANCELADA',
])

export const contactoProveedorSchema = z.object({
  nombre:    z.string().trim().min(2, 'El nombre del contacto es obligatorio'),
  cargo:     z.string().trim().max(80).optional(),
  email:     emailOpcional,
  telefono:  telefonoOpcional,
  whatsapp:  z.string().trim().max(40).optional(),
  principal: z.boolean().optional().default(false),
})

export const condicionProveedorSchema = z.object({
  descripcion:  z.string().trim().min(1, 'La descripción es obligatoria').max(80),
  plazoDias:    z.number().int().nonnegative('El plazo no puede ser negativo').default(0),
  recargoPct:   z.number().min(-100).max(1000).default(0),
  descuentoPct: z.number().min(-100).max(100).default(0),
})

export const productoProveedorSchema = z.object({
  inventarioId:   z.string().min(1).optional().nullable(),
  nombreProducto: z.string().trim().min(1, 'El nombre del producto es obligatorio').max(160),
  costo:          z.number().nonnegative('El costo no puede ser negativo'),
  bonificacionPct: z.number().min(0).max(100).optional(),
  moneda:         z.string().trim().max(6).default('ARS'),
  leadTimeDias:   z.number().int().nonnegative().optional().nullable(),
  garantiaMeses:  z.number().int().nonnegative().optional().nullable(),
  vigenteDesde:   z.coerce.date().optional(),
})

export const proveedorCreateSchema = z.object({
  razonSocial:      z.string().trim().min(2, 'La razón social es obligatoria'),
  cuit:             z.string().trim().max(20).optional(),
  condicionIva:     z.string().trim().max(60).optional(),
  rubro:            z.string().trim().max(80).optional(),
  origen:           origenProveedorEnum.default('NACIONAL'),
  tipoCompra:       tipoCompraProveedorEnum.default('AMBOS'),
  moneda:           z.string().trim().max(6).default('ARS'),
  email:            emailOpcional,
  telefono:         telefonoOpcional,
  sitioWeb:         z.string().trim().max(200).optional(),
  direccion:        z.string().trim().max(200).optional(),
  ciudad:           z.string().trim().max(100).optional(),
  marcas:           z.string().trim().max(300).optional(),
  condicionPago:    z.string().trim().max(60).optional(),
  financiacionPct:  z.number().min(-100).max(1000).optional().nullable(),
  plazoEntregaDias: z.number().int().nonnegative().optional().nullable(),
  minimoCompra:     z.number().nonnegative('El mínimo de compra no puede ser negativo').optional().nullable(),
  notas:            z.string().trim().max(1000).optional(),
  // Entidades de apoyo (opcionales). En PATCH, si se envían, reemplazan al set actual.
  contactos:   z.array(contactoProveedorSchema).optional(),
  condiciones: z.array(condicionProveedorSchema).optional(),
  productos:   z.array(productoProveedorSchema).optional(),
})

export const proveedorUpdateSchema = proveedorCreateSchema.partial().extend({
  activo: z.boolean().optional(),
})

// ============ TRACKING (Fase 8) ============

export const tipoEventoTrackingEnum = z.enum([
  'RECEPCION', 'DEPOSITO', 'EN_TRANSITO', 'INSTALADO', 'EN_SERVICIO', 'RETIRO', 'BAJA',
])

export const eventoTrackingCreateSchema = z.object({
  equipoId: z.string().min(1),
  tipo: tipoEventoTrackingEnum,
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  direccion: z.string().trim().max(300).optional(),
  nota: z.string().trim().max(500).optional(),
  otId: z.string().min(1).optional().nullable(),
  fecha: z.coerce.date().optional(),
})

// ============ LISTAS DE PRECIOS ============

export const tipoListaPreciosEnum = z.enum([
  'MINORISTA', 'MAYORISTA', 'INSTITUCIONAL', 'PROMOCION', 'ESPECIAL',
])

export const listaPreciosCreateSchema = z.object({
  codigo: z.string().trim().min(2, 'El código debe tener al menos 2 caracteres').max(20),
  nombre: z.string().trim().min(2, 'El nombre debe tener al menos 2 caracteres').max(120),
  tipo: tipoListaPreciosEnum,
  moneda: monedaDocumentoEnum.default('ARS'),
  ajusteGlobalPct: z.number().min(-100).max(100).default(0),
  vigenciaDesde: z.coerce.date().optional().nullable(),
  vigenciaHasta: z.coerce.date().optional().nullable(),
  notas: z.string().trim().max(500).optional().nullable(),
  predeterminada: z.boolean().default(false),
  activo: z.boolean().default(true),
})

export const listaPreciosUpdateSchema = listaPreciosCreateSchema.partial()

export const listaPreciosItemSchema = z.object({
  inventarioId: z.string().min(1),
  precioUnit: z.number().nonnegative('El precio no puede ser negativo'),
  bonificacionPct: z.number().min(0).max(100).default(0),
  vigenciaDesde: z.coerce.date().optional().nullable(),
  vigenciaHasta: z.coerce.date().optional().nullable(),
})

export const listaPreciosItemUpdateSchema = z.object({
  precioUnit: z.number().nonnegative().optional(),
  bonificacionPct: z.number().min(0).max(100).optional(),
  vigenciaDesde: z.coerce.date().optional().nullable(),
  vigenciaHasta: z.coerce.date().optional().nullable(),
})

// ---- Alquiler de equipos ----

export const estadoContratoAlquilerEnum = z.enum([
  'BORRADOR', 'ACTIVO', 'SUSPENDIDO', 'FINALIZADO', 'CANCELADO',
])

export const lineaAlquilerSchema = z.object({
  inventarioUnidadId: z.string().min(1, 'Seleccioná una unidad'),
  montoMensual: z.number().positive('El monto mensual debe ser mayor a 0'),
  beneficiarioNombre: z.string().trim().max(120).optional().nullable(),
  beneficiarioDocumento: z.string().trim().max(30).optional().nullable(),
  beneficiarioTelefono: telefonoOpcional,
  beneficiarioEmail: emailOpcional,
  domicilio: z.string().trim().max(200).optional().nullable(),
  localidad: z.string().trim().max(100).optional().nullable(),
  provincia: z.string().trim().max(80).optional().nullable(),
  codigoPostal: z.string().trim().max(12).optional().nullable(),
  lat: z.number().optional().nullable(),
  lng: z.number().optional().nullable(),
  fechaEntrega: z.coerce.date().optional().nullable(),
  observaciones: z.string().trim().max(500).optional().nullable(),
})

export const contratoAlquilerCreateSchema = z.object({
  clienteId: z.string().min(1, 'Seleccioná el cliente pagador'),
  fechaInicio: z.coerce.date().optional().nullable(),
  fechaFin: z.coerce.date().optional().nullable(),
  diaFacturacion: z.number().int().min(1).max(28).default(1),
  observaciones: z.string().trim().max(1000).optional().nullable(),
  lineas: z.array(lineaAlquilerSchema).min(1, 'Agregá al menos una línea'),
})

export const contratoAlquilerUpdateSchema = z.object({
  clienteId: z.string().min(1).optional(),
  fechaInicio: z.coerce.date().optional().nullable(),
  fechaFin: z.coerce.date().optional().nullable(),
  diaFacturacion: z.number().int().min(1).max(28).optional(),
  observaciones: z.string().trim().max(1000).optional().nullable(),
})

export const facturarCuotasAlquilerSchema = z.object({
  periodo: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  cuotaIds: z.array(z.string().min(1)).optional(),
  tipo: tipoFacturaEnum.default('B'),
  observaciones: z.string().trim().max(500).optional().nullable(),
})
