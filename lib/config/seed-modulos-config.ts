/**
 * Seed idempotente de catálogos, plantillas y reglas de notificación.
 */
import { prisma } from '@/lib/prisma'

const CATEGORIAS = [
  { codigo: 'MONITOREO', nombre: 'Monitoreo', orden: 1 },
  { codigo: 'DIAGNOSTICO', nombre: 'Diagnóstico', orden: 2 },
  { codigo: 'RESPIRATORIO', nombre: 'Respiratorio', orden: 3 },
  { codigo: 'LABORATORIO', nombre: 'Laboratorio', orden: 4 },
  { codigo: 'IMAGENOLOGIA', nombre: 'Imagenología', orden: 5 },
  { codigo: 'ACCESORIOS', nombre: 'Accesorios', orden: 6 },
  { codigo: 'REPUESTOS', nombre: 'Repuestos', orden: 7 },
  { codigo: 'CONSUMIBLES', nombre: 'Consumibles', orden: 8 },
  { codigo: 'EQUIPOS', nombre: 'Equipos', orden: 9 },
  { codigo: 'OTROS', nombre: 'Otros', orden: 10 },
]

const PLANTILLAS = [
  {
    codigo: 'COBRANZA_VENCIDA',
    nombre: 'Cobranza vencida',
    canal: 'SISTEMA',
    asunto: 'Factura vencida — {{numero}}',
    cuerpo: 'La factura {{numero}} del cliente {{cliente}} venció el {{fecha}}. Monto pendiente: {{monto}}.',
  },
  {
    codigo: 'OT_SLA',
    nombre: 'OT próxima a vencer SLA',
    canal: 'SISTEMA',
    asunto: 'SLA — OT {{numero}}',
    cuerpo: 'La orden {{numero}} ({{cliente}}) vence en {{horas}} h. Prioridad: {{prioridad}}.',
  },
  {
    codigo: 'PREVENTIVO_PROXIMO',
    nombre: 'Preventivo programado',
    canal: 'SISTEMA',
    asunto: 'Preventivo — {{equipo}}',
    cuerpo: 'Mantenimiento preventivo de {{equipo}} ({{cliente}}) programado para {{fecha}}.',
  },
  {
    codigo: 'COMPONENTE_VENCE',
    nombre: 'Componente por vencer',
    canal: 'SISTEMA',
    asunto: 'Vencimiento — {{componente}}',
    cuerpo: 'El componente «{{componente}}» del equipo {{equipo}} vence el {{fecha}}.',
  },
  {
    codigo: 'FACTURA_EMITIDA',
    nombre: 'Factura emitida al cliente',
    canal: 'EMAIL',
    asunto: 'Comprobante {{numero}} — {{emisor}}',
    cuerpo: 'Estimado/a {{cliente}},\n\nAdjuntamos el comprobante fiscal {{numero}} emitido el {{fecha}}.\nCAE: {{cae}}\nImporte total: {{total}}\n\n— {{emisor}}',
  },
  {
    codigo: 'COBRANZA_RECORDATORIO',
    nombre: 'Recordatorio de pago al cliente',
    canal: 'EMAIL',
    asunto: 'Recordatorio de pago — Factura {{numero}}',
    cuerpo:
      'Estimado/a {{cliente}},\n\nLe recordamos que la cuota {{cuota}} de la factura {{numero}} está {{situacion}} ({{fecha}}).\nMonto de la cuota: {{monto}}\n\n— Ingeniería Biomédica',
  },
]

const REGLAS = [
  { codigo: 'REGLA_COBRANZA', nombre: 'Aviso factura vencida', evento: 'cobranza.vencida', diasAnticipacion: 0, plantillaCodigo: 'COBRANZA_VENCIDA' },
  { codigo: 'REGLA_COBRANZA_PROXIMO', nombre: 'Recordatorio cuota próxima', evento: 'cobranza.proximo', diasAnticipacion: 3, plantillaCodigo: 'COBRANZA_RECORDATORIO' },
  { codigo: 'REGLA_OT_SLA', nombre: 'Aviso SLA de OT', evento: 'ot.sla_proximo', diasAnticipacion: 1, plantillaCodigo: 'OT_SLA' },
  { codigo: 'REGLA_PREVENTIVO', nombre: 'Aviso preventivo', evento: 'preventivo.proximo', diasAnticipacion: 7, plantillaCodigo: 'PREVENTIVO_PROXIMO' },
  { codigo: 'REGLA_COMPONENTE', nombre: 'Aviso componente', evento: 'equipo.componente_vence', diasAnticipacion: 30, plantillaCodigo: 'COMPONENTE_VENCE' },
]

export async function seedModulosConfigIfEmpty() {
  if ((await prisma.categoriaInventarioCat.count()) === 0) {
    for (const c of CATEGORIAS) {
      await prisma.categoriaInventarioCat.create({ data: c })
    }
  }

  await prisma.politicaSeguridad.upsert({
    where: { id: 'default' },
    update: {},
    create: { id: 'default' },
  })

  if ((await prisma.plantillaNotificacion.count()) === 0) {
    const plantillaIds = new Map<string, string>()
    for (const p of PLANTILLAS) {
      const row = await prisma.plantillaNotificacion.create({ data: p })
      plantillaIds.set(p.codigo, row.id)
    }
    for (const r of REGLAS) {
      await prisma.reglaNotificacion.create({
        data: {
          codigo: r.codigo,
          nombre: r.nombre,
          evento: r.evento,
          diasAnticipacion: r.diasAnticipacion,
          plantillaId: plantillaIds.get(r.plantillaCodigo) ?? null,
        },
      })
    }
  }

  for (const codigo of ['FACTURA_EMITIDA', 'COBRANZA_RECORDATORIO'] as const) {
    const plantilla = PLANTILLAS.find((p) => p.codigo === codigo)
    if (plantilla) {
      await prisma.plantillaNotificacion.upsert({
        where: { codigo },
        update: {},
        create: plantilla,
      })
    }
  }

  const reglaProximo = REGLAS.find((r) => r.codigo === 'REGLA_COBRANZA_PROXIMO')
  if (reglaProximo) {
    const plantilla = await prisma.plantillaNotificacion.findUnique({
      where: { codigo: reglaProximo.plantillaCodigo },
      select: { id: true },
    })
    await prisma.reglaNotificacion.upsert({
      where: { codigo: reglaProximo.codigo },
      update: {},
      create: {
        codigo: reglaProximo.codigo,
        nombre: reglaProximo.nombre,
        evento: reglaProximo.evento,
        diasAnticipacion: reglaProximo.diasAnticipacion,
        plantillaId: plantilla?.id ?? null,
      },
    })
  }
}

export async function listarCategoriasInventarioActivas() {
  await seedModulosConfigIfEmpty()
  return prisma.categoriaInventarioCat.findMany({
    where: { activo: true },
    orderBy: [{ orden: 'asc' }, { nombre: 'asc' }],
  })
}
