/**
 * lib/validation.ts
 * Esquemas Zod compartidos para validar la entrada de todos los endpoints.
 *
 * La validación vive en un único lugar para mantener coherencia entre las
 * rutas de API y, llegado el caso, los formularios del cliente.
 */

import { z } from 'zod'
import '@/lib/zod-es'
import { monedaDocumentoEnum } from '@/lib/moneda'

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

// ============ CLIENTE ============

const clienteFieldsSchema = z.object({
  nombre:        z.string().trim().min(2, 'El nombre debe tener al menos 2 caracteres'),
  tipo:          tipoClienteEnum,
  cuit:          z.string().trim().max(20).optional(),
  direccion:     z.string().trim().max(200).optional(),
  ciudad:        z.string().trim().max(100).optional(),
  telefono:      z.string().trim().max(40).optional(),
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
  sucursales.forEach((s, i) => {
    if (!s.direccion?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Indicá la calle o dirección de la sucursal',
        path: ['sucursales', i, 'direccion'],
      })
    }
    if (!s.numero?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Indicá el número de calle de la sucursal',
        path: ['sucursales', i, 'numero'],
      })
    }
    if (!s.ciudad?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Indicá la ciudad de la sucursal',
        path: ['sucursales', i, 'ciudad'],
      })
    }
  })
}

export const clienteCreateSchema = clienteFieldsSchema.superRefine(validarSucursalesCliente)

// Para PATCH: todos los campos opcionales + posibilidad de (des)activar
// (Zod v4 no permite .partial() sobre esquemas con refinements — aplicar refine después)
export const clienteUpdateSchema = clienteFieldsSchema.partial().extend({
  activo: z.boolean().optional(),
}).superRefine(validarSucursalesCliente)

// ============ ORDEN DE TRABAJO ============

export const tipoOTEnum = z.enum(['CORRECTIVO', 'PREVENTIVO', 'INSTALACION', 'CALIBRACION', 'GARANTIA'])

export const otCreateSchema = z.object({
  descripcion: z.string().trim().min(5, 'La descripción debe tener al menos 5 caracteres'),
  clienteId:   z.string().min(1, 'El cliente es obligatorio'),
  equipoId:    z.string().min(1).optional().nullable(),
  tecnicoId:   z.string().min(1).optional().nullable(),
  prioridad:   prioridadEnum.default('NORMAL'),
  slaHoras:    z.number().int().positive().max(24 * 30).default(48),
  tipo:        tipoOTEnum.default('CORRECTIVO'),
})

export const otUpdateSchema = z
  .object({
    estado:      estadoOTEnum.optional(),
    nota:        z.string().trim().max(500).optional(),
    diagnostico: z.string().trim().max(2000).optional(),
    tecnicoId:   z.string().min(1).optional().nullable(),
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

export const itemFacturaSchema = z.object({
  codigo:           z.string().trim().max(40).optional(),
  descripcion:      z.string().trim().min(1, 'La descripción del ítem es obligatoria'),
  descripcionLarga: z.string().trim().max(2000).optional(),
  fotoUrl:          z.string().trim().url().optional().or(z.literal('')),
  cantidad:         z.number().int().positive('La cantidad debe ser mayor a 0'),
  precioUnit:       z.number().nonnegative('El precio no puede ser negativo'),
  bonificacionPct:  z.number().min(0).max(100).optional(),
  inventarioId:     z.string().min(1).optional().nullable(),
  alicuotaIvaPct:   z.number().min(0).max(100).optional().nullable(),
  numeroSerie:      z.string().trim().max(80).optional().nullable(),
  proximoPreventivo: z.coerce.date().optional().nullable(),
  sucursalInstalacionId: z.string().min(1).optional().nullable(),
})

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
  items:                 z.array(itemDocumentoSchema).min(1),
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
  items:           z.array(itemDocumentoSchema).min(1).optional(),
}).refine((d) => Object.keys(d).length > 0, { message: 'Nada para actualizar' })

export const pagoCreateSchema = z.object({
  clienteId: z.string().min(1),
  monto:     z.number().positive(),
  medio:     medioPagoEnum.default('TRANSFERENCIA'),
  referencia: z.string().trim().max(80).optional(),
  notas:     z.string().trim().max(500).optional(),
  imputaciones: z.array(z.object({
    facturaId: z.string().min(1),
    monto:     z.number().positive(),
  })).min(1),
})

export const ordenCompraCreateSchema = z.object({
  proveedorId: z.string().min(1),
  observaciones: z.string().trim().max(1000).optional(),
  items: z.array(z.object({
    inventarioId: z.string().min(1).optional().nullable(),
    descripcion:  z.string().trim().min(1),
    cantidad:     z.number().int().positive(),
    precioUnit:   z.number().nonnegative(),
  })).min(1),
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
  sku:          z.string().trim().max(40).optional(),
  tipoArticulo: z.enum(['REPUESTO', 'CONSUMIBLE', 'ACCESORIO', 'BATERIA', 'EQUIPO']).default('REPUESTO'),
  marca:        z.string().trim().max(80).optional().nullable(),
  modelo:       z.string().trim().max(80).optional().nullable(),
  esSerializado: z.boolean().default(false),
  requierePreventivo: z.boolean().default(false),
  intervaloPreventivoDias: z.number().int().positive().optional().nullable(),
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
})

export const inventarioUpdateSchema = inventarioCreateSchema.partial().extend({
  activo: z.boolean().optional(),
  kitItems: z.array(inventarioKitItemSchema).optional(),
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
    telefono: z.string().trim().max(40).optional(),
    roles:    z.array(z.string().min(1)).min(1, 'Asigná al menos un rol'),
  })
  .merge(usuarioPasswordFieldsSchema)

export const usuarioUpdateSchema = z
  .object({
    nombre:   z.string().trim().min(2).optional(),
    telefono: z.string().trim().max(40).optional().nullable(),
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
    telefono:  z.string().trim().max(40).optional().nullable(),
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
  telefono:          z.string().trim().max(40).optional(),
  email:             z.string().trim().email('Email inválido').optional().or(z.literal('')),
  certificadoAlias:  z.string().trim().max(120).optional(),
  ambiente:          z.enum(['HOMOLOGACION', 'PRODUCCION']).default('HOMOLOGACION'),
  puntoVenta:        z.number().int().positive().default(1),
  predeterminado:    z.boolean().default(false),
})

export const emisorUpdateSchema = emisorCreateSchema.partial().extend({
  activo: z.boolean().optional(),
})

// ============ PROVEEDORES ============

export const origenProveedorEnum = z.enum(['NACIONAL', 'IMPORTADO'])

export const contactoProveedorSchema = z.object({
  nombre:    z.string().trim().min(2, 'El nombre del contacto es obligatorio'),
  cargo:     z.string().trim().max(80).optional(),
  email:     emailOpcional,
  telefono:  z.string().trim().max(40).optional(),
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
  moneda:           z.string().trim().max(6).default('ARS'),
  email:            emailOpcional,
  telefono:         z.string().trim().max(40).optional(),
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
