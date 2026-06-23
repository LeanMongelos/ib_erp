/**
 * Seed — Sistema ERP Ingeniería Biomédica
 * Genera datos realistas de prueba para Formosa, Argentina.
 */

import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import bcrypt from 'bcryptjs'
import { addHours, subDays, addDays } from 'date-fns'
import { PERMISSIONS, ROLE_DEFS, ROLE_PERMISSIONS, WILDCARD } from '../lib/rbac'
import { PLANTILLA_FACTURA_DEFAULT, PLANTILLA_PRESUPUESTO_DEFAULT } from '../lib/plantillas/defaults'
import { ensureSecuenciasActuales } from '../lib/numeracion'
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('🌱 Iniciando seed...')

  // ============ RBAC: PERMISOS Y ROLES ============
  for (const p of PERMISSIONS) {
    await prisma.permiso.upsert({
      where: { clave: p.clave },
      update: { modulo: p.modulo, descripcion: p.descripcion },
      create: p,
    })
  }
  console.log(`✅ ${PERMISSIONS.length} permisos`)

  const todosLosPermisos = await prisma.permiso.findMany()
  const permisoPorClave = new Map(todosLosPermisos.map((p) => [p.clave, p.id]))

  for (const [clave, nombre] of Object.entries(ROLE_DEFS)) {
    const rol = await prisma.rolRBAC.upsert({
      where: { clave },
      update: { nombre, sistema: true },
      create: { clave, nombre, sistema: true },
    })

    // Resolver claves de permiso del rol (SUPERADMIN = todos)
    const claves = ROLE_PERMISSIONS[clave]?.includes(WILDCARD)
      ? todosLosPermisos.map((p) => p.clave)
      : ROLE_PERMISSIONS[clave] ?? []

    await prisma.rolPermiso.deleteMany({ where: { rolId: rol.id } })
    await prisma.rolPermiso.createMany({
      data: claves
        .map((c) => permisoPorClave.get(c))
        .filter((id): id is string => Boolean(id))
        .map((permisoId) => ({ rolId: rol.id, permisoId })),
      skipDuplicates: true,
    })
  }
  console.log(`✅ ${Object.keys(ROLE_DEFS).length} roles RBAC`)

  const roles = await prisma.rolRBAC.findMany()
  const rolPorClave = new Map(roles.map((r) => [r.clave, r.id]))

  async function asignarRoles(usuarioId: string, claves: string[]) {
    await prisma.usuarioRol.deleteMany({ where: { usuarioId } })
    await prisma.usuarioRol.createMany({
      data: claves
        .map((c) => rolPorClave.get(c))
        .filter((id): id is string => Boolean(id))
        .map((rolId) => ({ usuarioId, rolId })),
      skipDuplicates: true,
    })
  }

  // ============ USUARIOS (organigrama real) ============
  // Contraseña por defecto para todos (cambiar en el primer ingreso).
  const passDefault = await bcrypt.hash('admin123', 10)

  const organigrama: Array<{ nombre: string; email: string; rol: any; roles: string[] }> = [
    { nombre: 'Leandro Mongelos', email: 'admin@ibiomedica.com',     rol: 'ADMIN',       roles: ['SUPERADMIN'] },
    { nombre: 'Cesar Ramirez',    email: 'cesar@ibiomedica.com',     rol: 'ADMIN',       roles: ['GERENTE'] },
    { nombre: 'Guillermo Aquiles',email: 'guillermo@ibiomedica.com', rol: 'VENTAS',      roles: ['ADMINISTRACION', 'VENTAS', 'FACTURACION'] },
    { nombre: 'Lucas Alloi',      email: 'lucas@ibiomedica.com',     rol: 'FACTURACION', roles: ['FACTURACION', 'CONTABILIDAD', 'VENTAS'] },
    { nombre: 'Nicolás',          email: 'nicolas@ibiomedica.com',   rol: 'TECNICO',     roles: ['TECNICO', 'VENTAS'] },
    { nombre: 'Joaquín',          email: 'joaquin@ibiomedica.com',   rol: 'TECNICO',     roles: ['TECNICO', 'VENTAS'] },
    { nombre: 'Leonardo',         email: 'leonardo@ibiomedica.com',  rol: 'TECNICO',     roles: ['TECNICO', 'VENTAS'] },
  ]

  let admin: any, tecnico: any, tecnico2: any
  for (const u of organigrama) {
    const usuario = await prisma.usuario.upsert({
      where: { email: u.email },
      update: { nombre: u.nombre, rol: u.rol },
      create: { nombre: u.nombre, email: u.email, password: passDefault, rol: u.rol },
    })
    await asignarRoles(usuario.id, u.roles)
    if (u.email === 'admin@ibiomedica.com') admin = usuario
    if (u.email === 'nicolas@ibiomedica.com') tecnico = usuario
    if (u.email === 'joaquin@ibiomedica.com') tecnico2 = usuario
  }
  console.log(`✅ ${organigrama.length} usuarios del organigrama`)

  // ============ EMISORES (multi-CUIT, carga manual editable) ============
  await prisma.emisor.upsert({
    where: { cuit: '20-24440827-4' },
    update: {},
    create: {
      razonSocial: 'INGENIERIA BIOMEDICA',
      cuit: '20-24440827-4',
      condicionIva: 'Responsable Inscripto',
      ingresosBrutos: '20-24440827-4',
      inicioActividades: new Date('2003-08-01'),
      domicilio: 'Eva Perón Nº679',
      ciudad: 'Formosa',
      telefono: '3705 343364',
      email: 'ingenieriabiomedica@hotmail.com',
      ambiente: 'HOMOLOGACION',
      puntoVenta: 1,
      predeterminado: true,
    },
  })
  await prisma.emisor.upsert({
    where: { cuit: '30-70902717-0' },
    update: {},
    create: {
      razonSocial: 'INGENIERIA BIOMEDICA',
      cuit: '30-70902717-0',
      condicionIva: 'Responsable Inscripto',
      inicioActividades: new Date('2003-08-01'),
      domicilio: 'Eva Perón Nº679',
      ciudad: 'Formosa',
      telefono: '3705 343364',
      email: 'ingenieriabiomedica@hotmail.com',
      ambiente: 'HOMOLOGACION',
      puntoVenta: 1,
      predeterminado: false,
    },
  })
  console.log('✅ Emisores cargados')

  // ============ PLANTILLAS DEFAULT (idempotente) ============
  const { PLANTILLA_PRESUPUESTO_DEFAULT, PLANTILLA_FACTURA_DEFAULT } = await import('../lib/plantillas/defaults')
  await prisma.plantillaImpresion.upsert({
    where: { id: 'seed-plantilla-presupuesto' },
    update: {},
    create: {
      id: 'seed-plantilla-presupuesto',
      nombre: 'Presupuesto estándar',
      tipo: 'PRESUPUESTO',
      config: PLANTILLA_PRESUPUESTO_DEFAULT as object,
      predeterminado: true,
    },
  })
  await prisma.plantillaImpresion.upsert({
    where: { id: 'seed-plantilla-factura' },
    update: {},
    create: {
      id: 'seed-plantilla-factura',
      nombre: 'Factura estándar',
      tipo: 'FACTURA',
      config: PLANTILLA_FACTURA_DEFAULT as object,
      predeterminado: true,
    },
  })
  console.log('✅ Plantillas de impresión default')

  await ensureSecuenciasActuales()
  console.log('✅ Secuencias de numeración default')

  // ============ DEPÓSITO CENTRAL (idempotente) ============
  await prisma.deposito.upsert({
    where: { id: 'seed-deposito-central' },
    update: {},
    create: { id: 'seed-deposito-central', nombre: 'Depósito Central', direccion: 'Eva Perón Nº679, Formosa' },
  })
  console.log('✅ Depósito Central')

  // ============ CRM OMNICANAL DEMO (Fase 9) ============
  const tiposCanal = ['WHATSAPP', 'INSTAGRAM', 'FACEBOOK', 'EMAIL_IMAP', 'N8N'] as const
  for (const t of tiposCanal) {
    const nombres: Record<string, string> = {
      WHATSAPP: 'WhatsApp Business',
      INSTAGRAM: 'Instagram Direct',
      FACEBOOK: 'Facebook Messenger',
      EMAIL_IMAP: 'Correo IMAP/SMTP',
      N8N: 'n8n Automatizaciones',
    }
    await prisma.canalIntegracion.upsert({
      where: { tipo: t },
      update: {},
      create: { tipo: t, nombre: nombres[t] },
    })
  }

  if ((await prisma.conversacionCRM.count()) === 0) {
    const canales = await prisma.canalIntegracion.findMany()
    const canalPorTipo = new Map(canales.map((c) => [c.tipo, c.id]))
    const clientesDemo = await prisma.cliente.findMany({ take: 4, orderBy: { nombre: 'asc' } })
    const clinicaSanJuan = await prisma.cliente.findFirst({
      where: {
        OR: [
          { nombre: 'Clínica San Juan' },
          { email: 'administracion@clinicasanjuan.com' },
        ],
      },
    })
    const guillermo = await prisma.usuario.findUnique({ where: { email: 'guillermo@ibiomedica.com' } })

    const demos: Array<{
      tipo: 'WHATSAPP' | 'INSTAGRAM' | 'FACEBOOK' | 'EMAIL_IMAP'
      contactoNombre: string
      contactoHandle: string
      preview: string
      etiquetas: string[]
      sinLeer: number
      mensajes: Array<{ dir: 'ENTRANTE' | 'SALIENTE'; texto: string }>
      clienteIdx?: number
    }> = [
      {
        tipo: 'WHATSAPP',
        contactoNombre: 'Dra. Elena Quiroga',
        contactoHandle: '+54 370 445-2210',
        preview: '¿Tienen repuesto para el sensor SpO2?',
        etiquetas: ['soporte'],
        sinLeer: 2,
        clienteIdx: 0,
        mensajes: [
          { dir: 'ENTRANTE', texto: 'Buenos días, ¿tienen repuesto para el sensor SpO2 del monitor?' },
          { dir: 'ENTRANTE', texto: 'Es urgente, el equipo está fuera de servicio.' },
        ],
      },
      {
        tipo: 'INSTAGRAM',
        contactoNombre: 'Clínica San Juan',
        contactoHandle: '@clinicasanjuan',
        preview: 'Consulta por mantenimiento preventivo',
        etiquetas: ['presupuesto'],
        sinLeer: 1,
        clienteIdx: 2,
        mensajes: [
          { dir: 'ENTRANTE', texto: 'Hola! Queremos cotizar mantenimiento preventivo de 3 incubadoras.' },
        ],
      },
      {
        tipo: 'FACEBOOK',
        contactoNombre: 'Hospital de Clorinda',
        contactoHandle: 'Hospital Distrital Clorinda',
        preview: 'Fallo en respirador — necesitamos técnico',
        etiquetas: ['soporte', 'urgente'],
        sinLeer: 1,
        clienteIdx: 1,
        mensajes: [
          { dir: 'ENTRANTE', texto: 'El respirador Dräger no mantiene la presión. ¿Pueden enviar un técnico?' },
        ],
      },
      {
        tipo: 'EMAIL_IMAP',
        contactoNombre: 'Lic. Graciela Torres',
        contactoHandle: 'administracion@clinicasanjuan.com',
        preview: 'RE: Presupuesto equipamiento 2026',
        etiquetas: ['venta'],
        sinLeer: 0,
        clienteIdx: 2,
        mensajes: [
          { dir: 'ENTRANTE', texto: 'Estimados, adjunto el pedido de cotización para renovación de equipamiento.' },
          { dir: 'SALIENTE', texto: 'Graciela, recibimos su consulta. Le enviamos presupuesto en 24 hs.' },
        ],
      },
    ]

    for (const d of demos) {
      const canalId = canalPorTipo.get(d.tipo)!
      const conv = await prisma.conversacionCRM.create({
        data: {
          canalId,
          contactoNombre: d.contactoNombre,
          contactoHandle: d.contactoHandle,
          preview: d.preview,
          etiquetas: d.etiquetas,
          sinLeer: d.sinLeer,
          estado: d.sinLeer > 0 ? 'ABIERTA' : 'PENDIENTE',
          clienteId:
            d.contactoHandle === 'administracion@clinicasanjuan.com' ||
            d.contactoHandle === '@clinicasanjuan'
              ? clinicaSanJuan?.id ?? null
              : d.clienteIdx != null
                ? clientesDemo[d.clienteIdx]?.id
                : null,
          asignadoId: guillermo?.id,
          ultimoMensajeEn: new Date(),
        },
      })
      for (const m of d.mensajes) {
        await prisma.mensajeCRM.create({
          data: {
            conversacionId: conv.id,
            direccion: m.dir,
            contenido: m.texto,
            usuarioId: m.dir === 'SALIENTE' ? guillermo?.id : null,
            fecha: subDays(new Date(), m.dir === 'ENTRANTE' ? 0 : 1),
          },
        })
      }
    }
    console.log(`✅ ${demos.length} conversaciones CRM demo`)
  }

  // ============ PROVEEDORES (demo idempotente) ============
  // Guard por count: solo se cargan si todavía no hay proveedores.
  if ((await prisma.proveedor.count()) === 0) {
    const inventarioParaLink = await prisma.inventario.findMany({
      where: { sku: { in: ['BAT-12V-001', 'CAB-SPO2-001', 'PAN-TFT-001', 'SEN-NTC-001'] } },
      select: { id: true, sku: true, nombre: true },
    })
    const invPorSku = new Map(inventarioParaLink.map((i) => [i.sku, i]))

    await prisma.proveedor.create({
      data: {
        razonSocial: 'Medical Supplies Argentina S.A.',
        cuit: '30-71234567-8',
        condicionIva: 'Responsable Inscripto',
        rubro: 'Insumos y repuestos médicos',
        origen: 'NACIONAL',
        moneda: 'ARS',
        email: 'ventas@medicalsupplies.com.ar',
        telefono: '+54 11 4555-1200',
        sitioWeb: 'https://medicalsupplies.com.ar',
        ciudad: 'Buenos Aires',
        marcas: 'Nellcor, Mindray',
        condicionPago: '30 días',
        financiacionPct: 0,
        plazoEntregaDias: 5,
        minimoCompra: 50000,
        contactos: {
          create: [
            { nombre: 'Marcelo Ferreyra', cargo: 'Comercial', email: 'mferreyra@medicalsupplies.com.ar', telefono: '+54 11 4555-1201', principal: true },
            { nombre: 'Soporte Técnico', cargo: 'Postventa', email: 'soporte@medicalsupplies.com.ar' },
          ],
        },
        condiciones: {
          create: [
            { descripcion: 'Contado', plazoDias: 0, recargoPct: 0, descuentoPct: 5 },
            { descripcion: '30 días', plazoDias: 30, recargoPct: 0, descuentoPct: 0 },
            { descripcion: '60 días', plazoDias: 60, recargoPct: 4, descuentoPct: 0 },
          ],
        },
        productos: {
          create: [
            { nombreProducto: 'Cable SpO2 adulto Nellcor compatible', costo: 6800, moneda: 'ARS', leadTimeDias: 5, inventarioId: invPorSku.get('CAB-SPO2-001')?.id ?? null },
            { nombreProducto: 'Sensor de temperatura NTC 10K', costo: 4200, moneda: 'ARS', leadTimeDias: 7, inventarioId: invPorSku.get('SEN-NTC-001')?.id ?? null },
          ],
        },
      },
    })

    await prisma.proveedor.create({
      data: {
        razonSocial: 'BioImport Technologies LLC',
        cuit: '33-70999888-9',
        condicionIva: 'Responsable Inscripto',
        rubro: 'Equipamiento importado',
        origen: 'IMPORTADO',
        moneda: 'USD',
        email: 'orders@bioimport.com',
        telefono: '+1 305 555-0199',
        sitioWeb: 'https://bioimport.com',
        ciudad: 'Miami',
        marcas: 'HAEMONETICS, GE',
        condicionPago: '50% anticipo / 50% contra entrega',
        financiacionPct: 0,
        plazoEntregaDias: 30,
        minimoCompra: 1000,
        contactos: {
          create: [
            { nombre: 'Laura Gómez', cargo: 'Export Sales', email: 'lgomez@bioimport.com', whatsapp: '+1 305 555-0200', principal: true },
          ],
        },
        condiciones: {
          create: [
            { descripcion: 'Contado anticipado', plazoDias: 0, recargoPct: 0, descuentoPct: 3 },
            { descripcion: '90 días financiado', plazoDias: 90, recargoPct: 8, descuentoPct: 0 },
          ],
        },
        productos: {
          create: [
            { nombreProducto: 'Pantalla TFT 7" para monitor paciente', costo: 95, moneda: 'USD', leadTimeDias: 30, garantiaMeses: 12, inventarioId: invPorSku.get('PAN-TFT-001')?.id ?? null },
            { nombreProducto: 'Batería 12V 7Ah para desfibrilador', costo: 22, moneda: 'USD', leadTimeDias: 25, inventarioId: invPorSku.get('BAT-12V-001')?.id ?? null },
          ],
        },
      },
    })

    await prisma.proveedor.create({
      data: {
        razonSocial: 'Repuestos del Litoral SRL',
        cuit: '30-70555444-2',
        condicionIva: 'Responsable Inscripto',
        rubro: 'Repuestos electrónicos y mecánicos',
        origen: 'NACIONAL',
        moneda: 'ARS',
        email: 'info@repuestoslitoral.com.ar',
        telefono: '+54 342 455-3300',
        ciudad: 'Santa Fe',
        condicionPago: 'Contado',
        financiacionPct: 0,
        plazoEntregaDias: 3,
        contactos: { create: [{ nombre: 'Diego Sosa', cargo: 'Comercial', telefono: '+54 342 455-3301', principal: true }] },
        condiciones: { create: [{ descripcion: 'Contado', plazoDias: 0, recargoPct: 0, descuentoPct: 8 }] },
        productos: {
          create: [
            { nombreProducto: 'Rodamiento 6202-2RS', costo: 1100, moneda: 'ARS', leadTimeDias: 3 },
            { nombreProducto: 'Fusible 5A 250V cerámico', costo: 110, moneda: 'ARS', leadTimeDias: 2 },
          ],
        },
      },
    })

    console.log('✅ 3 proveedores demo creados')
  } else {
    console.log('ℹ️  Ya existen proveedores; se omite la carga demo de proveedores.')
  }

  // Plan de mantenimiento demo si hay equipos (bases ya pobladas)
  if ((await prisma.planMantenimiento.count()) === 0) {
    const equipoDemo = await prisma.equipo.findFirst({ orderBy: { creadoEn: 'asc' } })
    if (equipoDemo) {
      const { addDays } = await import('date-fns')
      await prisma.planMantenimiento.create({
        data: {
          equipoId: equipoDemo.id,
          descripcion: 'Mantenimiento preventivo semestral',
          intervaloDias: 180,
          proximoServicio: addDays(new Date(), 30),
          estado: 'PROGRAMADO',
        },
      })
      console.log('✅ Plan de mantenimiento demo')
    }
  }

  // ============ DATOS DEMO (solo si la base está vacía) ============
  if ((await prisma.cliente.count()) > 0) {
    console.log('ℹ️  Ya existen datos de negocio; se omite la carga demo.')
    console.log('\n🎉 Seed completado (RBAC + usuarios + emisores).')
    console.log('📧 admin@ibiomedica.com / admin123')
    return
  }

  // ============ CLIENTES ============
  const { ensureClienteEventual } = await import('../lib/clientes/eventual')
  const { ensureAlicuotasIvaDefault } = await import('../lib/iva/alicuotas-default')
  const { ensureContabilidadArgentina } = await import('../lib/contabilidad/seed-argentina')
  await ensureAlicuotasIvaDefault()
  await ensureContabilidadArgentina()
  await ensureClienteEventual()

  const clientesData = [
    { nombre: 'Hospital Central Dr. Salvador Mazza',   tipo: 'HOSPITAL' as const,     cuit: '30-99887766-3', ciudad: 'Formosa Capital', contacto: 'Dra. Elena Quiroga',     telefono: '+54 370 445-2210', email: 'mantenimiento@hcsm.gob.ar' },
    { nombre: 'Hospital de la Madre y el Niño',        tipo: 'HOSPITAL' as const,     cuit: '30-88776655-4', ciudad: 'Formosa Capital', contacto: 'Ing. Pedro Benítez',     telefono: '+54 370 445-1100', email: 'biomedica@hmaternidad.gob.ar' },
    { nombre: 'Clínica San Juan',                      tipo: 'CLINICA' as const,      cuit: '30-77665544-5', ciudad: 'Formosa Capital', contacto: 'Lic. Graciela Torres',   telefono: '+54 370 442-3300', email: 'administracion@clinicasanjuan.com' },
    { nombre: 'Sanatorio del Norte',                   tipo: 'SANATORIO' as const,    cuit: '30-66554433-6', ciudad: 'Formosa Capital', contacto: 'Dr. Roberto Acosta',    telefono: '+54 370 443-4400', email: 'tecnica@sanatorionorte.com' },
    { nombre: 'Centro de Diagnóstico Médico Formosa',  tipo: 'CLINICA' as const,      cuit: '30-55443322-7', ciudad: 'Formosa Capital', contacto: 'Lic. María Leiva',      telefono: '+54 370 441-5500', email: 'administracion@cdmformosa.com' },
    { nombre: 'Consultorio Dr. Ramón Espínola',        tipo: 'CONSULTORIO' as const,  cuit: '20-44332211-8', ciudad: 'Clorinda',        contacto: 'Dr. Ramón Espínola',    telefono: '+54 3718 42-1100', email: 'dramon@medicos.com' },
    { nombre: 'Hospital Distrital de Clorinda',        tipo: 'HOSPITAL' as const,     cuit: '30-33221100-9', ciudad: 'Clorinda',        contacto: 'Eng. Luis Giménez',     telefono: '+54 3718 42-2200', email: 'mantenimiento@hclorinda.gob.ar' },
    { nombre: 'Clínica Riviera',                       tipo: 'CLINICA' as const,      cuit: '30-22110099-1', ciudad: 'Formosa Capital', contacto: 'Lic. Sandra Paez',      telefono: '+54 370 447-7700', email: 'clinica@riviera.com' },
    { nombre: 'Centro Médico El Palmar',               tipo: 'OTRO' as const,         cuit: '30-11009988-2', ciudad: 'Las Lomitas',     contacto: 'Lic. Jorge Soto',       telefono: '+54 3711 42-3300', email: 'centroelpalmar@gmail.com' },
    { nombre: 'Consultorio Dental Formosa',            tipo: 'CONSULTORIO' as const,  cuit: '20-00998877-3', ciudad: 'Formosa Capital', contacto: 'Odont. Marta García',   telefono: '+54 370 448-8800', email: 'odontologia@dental.com' },
  ]

  const clientes = await Promise.all(clientesData.map((c) => prisma.cliente.create({ data: c })))
  console.log(`✅ ${clientes.length} clientes creados`)

  // ============ EQUIPOS ============
  const equiposBase = [
    { nombre: 'Respirador Mecánico',  marca: 'Dräger', modelo: 'Savina 300',    prefix: 'DRG' },
    { nombre: 'Incubadora Neonatal',  marca: 'Dräger', modelo: 'Caleo 8000',    prefix: 'DRC' },
    { nombre: 'Monitor Multiparamétrico', marca: 'Mindray', modelo: 'iMEC 8', prefix: 'MND' },
    { nombre: 'Electrobisturí',       marca: 'Valleylab', modelo: 'FT10',      prefix: 'VLB' },
    { nombre: 'Desfibrilador',        marca: 'Philips',  modelo: 'HeartStart XL+', prefix: 'PHI' },
    { nombre: 'Ecógrafo Portátil',    marca: 'GE',       modelo: 'Vscan Extend', prefix: 'GE' },
    { nombre: 'Autoclave',            marca: 'Azteca',   modelo: 'NS100',       prefix: 'AZT' },
    { nombre: 'Oxímetro de Pulso',    marca: 'Nellcor',  modelo: 'PM10N',       prefix: 'NEL' },
    { nombre: 'Bomba de Infusión',    marca: 'BD',       modelo: 'Alaris CC',   prefix: 'BD' },
    { nombre: 'Electrocardiógraf.',   marca: 'Mortara',  modelo: 'ELI 150c',    prefix: 'MRT' },
  ]

  let equipoIdx = 0
  const equipos: any[] = []

  for (const cliente of clientes) {
    // 3 equipos por cliente
    for (let i = 0; i < 3; i++) {
      const base = equiposBase[equipoIdx % equiposBase.length]
      const num  = String(equipoIdx + 1000).padStart(4, '0')
      const garantiaHasta = i === 0 ? new Date(Date.now() + 365 * 24 * 3600 * 1000) : undefined
      const equipo = await prisma.equipo.create({
        data: {
          nombre: base.nombre,
          marca: base.marca,
          modelo: base.modelo,
          numeroSerie: `${base.prefix}-${num}`,
          garantiaHasta,
          estado: i === 1 ? 'EN_REPARACION' : 'ACTIVO',
          clienteId: cliente.id,
        },
      })
      equipos.push(equipo)
      equipoIdx++
    }
  }
  console.log(`✅ ${equipos.length} equipos creados`)

  const { seedTrackingDemo } = await import('../lib/equipos/seed-tracking-demo')
  const trackingDemoCount = await seedTrackingDemo()
  if (trackingDemoCount > 0) console.log(`✅ Tracking demo (${trackingDemoCount} equipos)`)

  const { seedHistoriaClinicaDemo } = await import('../lib/equipos/seed-historia-demo')
  await seedHistoriaClinicaDemo(equipos.slice(0, 3))

  if ((await prisma.planMantenimiento.count()) === 0 && equipos[0]) {
    await prisma.planMantenimiento.create({
      data: {
        equipoId: equipos[0].id,
        descripcion: 'Mantenimiento preventivo semestral',
        intervaloDias: 180,
        proximoServicio: addDays(new Date(), 30),
        estado: 'PROGRAMADO',
      },
    })
    console.log('✅ Plan de mantenimiento demo')
  }

  // ============ ÓRDENES DE TRABAJO ============
  const otStates: Array<{ estado: any; diasAtras: number; prioridad: any }> = [
    { estado: 'ABIERTA',    diasAtras: 1,  prioridad: 'NORMAL'  },
    { estado: 'ABIERTA',    diasAtras: 2,  prioridad: 'ALTA'    },
    { estado: 'EN_PROCESO', diasAtras: 1,  prioridad: 'URGENTE' },
    { estado: 'EN_PROCESO', diasAtras: 3,  prioridad: 'NORMAL'  },
    { estado: 'VENCIDA',    diasAtras: 5,  prioridad: 'ALTA'    },
    { estado: 'VENCIDA',    diasAtras: 7,  prioridad: 'URGENTE' },
    { estado: 'VENCIDA',    diasAtras: 8,  prioridad: 'NORMAL'  },
    { estado: 'CERRADA',    diasAtras: 10, prioridad: 'NORMAL'  },
    { estado: 'CERRADA',    diasAtras: 15, prioridad: 'BAJA'    },
    { estado: 'CERRADA',    diasAtras: 20, prioridad: 'ALTA'    },
    { estado: 'CERRADA',    diasAtras: 25, prioridad: 'NORMAL'  },
    { estado: 'CERRADA',    diasAtras: 30, prioridad: 'URGENTE' },
    { estado: 'ABIERTA',    diasAtras: 0,  prioridad: 'BAJA'    },
    { estado: 'EN_PROCESO', diasAtras: 2,  prioridad: 'ALTA'    },
    { estado: 'CERRADA',    diasAtras: 12, prioridad: 'NORMAL'  },
    { estado: 'CERRADA',    diasAtras: 18, prioridad: 'BAJA'    },
    { estado: 'ABIERTA',    diasAtras: 1,  prioridad: 'URGENTE' },
    { estado: 'CANCELADA',  diasAtras: 9,  prioridad: 'NORMAL'  },
    { estado: 'CERRADA',    diasAtras: 22, prioridad: 'ALTA'    },
    { estado: 'EN_PROCESO', diasAtras: 4,  prioridad: 'NORMAL'  },
  ]

  const descripciones = [
    'La incubadora no mantiene temperatura de consigna (36.5°C). Alarma de sensor de piel intermitente.',
    'Respirador no cicla correctamente en modo SIMV. Alarma de presión máxima continua.',
    'Monitor no muestra valores de SpO2. Sensor del paciente con falla intermitente.',
    'Electrobisturí no activa modo coagulación. Cable de pie deteriorado.',
    'Desfibrilador no carga a energía completa. Error E-02 en pantalla.',
    'Ecógrafo con imagen congelada después de 20 minutos de uso. Pantalla táctil sin respuesta.',
    'Autoclave no alcanza temperatura de esterilización (134°C). Fuga de vapor detectada.',
    'Oxímetro con alarma de batería permanente aunque esté conectado a red.',
    'Bomba de infusión: alarma de oclusión sin causa aparente. Línea limpia confirmada.',
    'ECG no graba el trazado. Impresora térmica sin papel y cabezal de impresión dañado.',
    'Incubadora: motor del ventilador con ruido anómalo. Rodamiento desgastado.',
    'Respirador: turbina con error de calibración al encender. Pérdida de flujo en circuito.',
    'Monitor: teclado frontal sin respuesta. Pantalla con líneas horizontales.',
    'Electrobisturí: fusibles quemados repetidamente. Cortocircuito en placa principal.',
    'Desfibrilador: batería no carga. Test automático falla.',
    'Ecógrafo: sonda lineal con artefactos en imagen. Cristal piezo dañado.',
    'Autoclave: ciclo no finaliza. Electroválvula de vacío bloqueada.',
    'Bomba de infusión: pantalla sin iluminación. Backlight quemado.',
    'ECG: derivación V4 sin señal. Conector de snap dañado.',
    'Oxímetro: sensor de saturación desprendido. Requiere calibración.',
  ]

  const diagnosticos = [
    'Sensor de piel descalibrado y motor del ventilador con rodamiento desgastado. Se reemplazan ambos.',
    'Válvula espiratoria obstruida. Limpieza y recalibración de sensores de flujo.',
    'Sensor SpO2 defectuoso. Se reemplaza cable y sensor. Calibración completada.',
    'Cable de pie con rotura interna. Reemplazo por repuesto original.',
    'Capacitor de alta tensión con pérdida de capacidad. Reemplazo completo.',
    'Tarjeta de procesamiento de imagen con fallo. Actualización de firmware resuelve el problema.',
    'Junta de puerta desgastada y resistencia calefactora con falla parcial. Se reemplazan ambas.',
    'Diodo Schottky defectuoso en circuito de carga. Soldadura y recalibración.',
    'Sensor de presión diferencial descalibrado. Reemplazo y calibración de fábrica.',
    'Cabezal de impresión quemado. Reemplazo + carga de papel térmico original.',
  ]

  const ots: any[] = []
  for (let i = 0; i < otStates.length; i++) {
    const { estado, diasAtras, prioridad } = otStates[i]
    const cliente = clientes[i % clientes.length]
    const equipo  = equipos[i % equipos.length]
    const asignado = i % 3 === 0 ? admin : i % 3 === 1 ? tecnico : tecnico2
    const slaHoras = prioridad === 'URGENTE' ? 24 : prioridad === 'ALTA' ? 48 : 72
    const fechaApertura = subDays(new Date(), diasAtras)
    const slaVence = addHours(fechaApertura, slaHoras)

    const numero = `OT-2026-${String(i + 401).padStart(4, '0')}`

    const ot = await prisma.ordenTrabajo.create({
      data: {
        numero,
        descripcion: descripciones[i % descripciones.length],
        diagnostico: estado !== 'ABIERTA' ? (diagnosticos[i % diagnosticos.length] ?? null) : null,
        estado,
        prioridad,
        slaHoras,
        fechaApertura,
        slaVence,
        fechaCierre: estado === 'CERRADA' ? subDays(new Date(), diasAtras - 2) : null,
        clienteId: cliente.id,
        equipoId:  equipo.id,
        tecnicoId: asignado.id,
        historial: {
          create: [
            { estado: 'ABIERTA',    nota: 'OT creada',                  creadoEn: fechaApertura },
            ...(estado !== 'ABIERTA' ? [{ estado,                        nota: `Estado actualizado a ${estado}`, creadoEn: addHours(fechaApertura, 2) }] : []),
          ],
        },
        repuestos: estado !== 'ABIERTA' ? {
          create: [
            { descripcion: 'Sensor de temperatura NTC 10K',   cantidad: 1, precioUnit: 4800 },
            { descripcion: 'Rodamiento 6202-2RS',              cantidad: 2, precioUnit: 1200 },
          ],
        } : undefined,
      },
    })
    ots.push(ot)
  }
  console.log(`✅ ${ots.length} OTs creadas`)

  // ============ FACTURAS ============
  const facturasData = [
    { estado: 'PAGADA' as const,   tipo: 'B' as const,  monto: 85000  },
    { estado: 'PAGADA' as const,   tipo: 'A' as const,  monto: 142000 },
    { estado: 'PENDIENTE' as const, tipo: 'B' as const, monto: 63500  },
    { estado: 'PENDIENTE' as const, tipo: 'A' as const, monto: 218000 },
    { estado: 'PENDIENTE' as const, tipo: 'B' as const, monto: 97200  },
    { estado: 'VENCIDA' as const,   tipo: 'A' as const, monto: 154000 },
    { estado: 'PAGADA' as const,   tipo: 'B' as const,  monto: 43500  },
    { estado: 'BORRADOR' as const,  tipo: 'C' as const, monto: 28000  },
    { estado: 'PAGADA' as const,   tipo: 'A' as const,  monto: 312500 },
    { estado: 'ANULADA' as const,   tipo: 'B' as const, monto: 15000  },
  ]

  const facturasCreadas: { id: string; estado: string; total: number }[] = []

  for (let i = 0; i < facturasData.length; i++) {
    const { estado, tipo, monto } = facturasData[i]
    const cliente = clientes[i % clientes.length]
    const subtotal = monto
    const iva = subtotal * 0.21
    const total = subtotal + iva

    const factura = await prisma.factura.create({
      data: {
        numero: `${tipo}-${String(i + 10001).padStart(5, '0')}`,
        tipo,
        estado,
        subtotal,
        iva,
        total,
        clienteId: cliente.id,
        fechaVencimiento: new Date(Date.now() + 30 * 24 * 3600 * 1000),
        items: {
          create: [
            { descripcion: 'Servicio de mantenimiento preventivo',  cantidad: 1, precioUnit: monto * 0.6, subtotal: monto * 0.6 },
            { descripcion: 'Repuestos y materiales',                cantidad: 1, precioUnit: monto * 0.4, subtotal: monto * 0.4 },
          ],
        },
      },
    })
    facturasCreadas.push({ id: factura.id, estado, total })
  }

  const { sincronizarVencimientosCobranza } = await import('../lib/cobranzas/vencimientos')
  const pendientes = facturasCreadas.filter((f) => f.estado === 'PENDIENTE')
  if (pendientes[0]) await sincronizarVencimientosCobranza(pendientes[0].id, [30, 60, 90])
  if (pendientes[1]) await sincronizarVencimientosCobranza(pendientes[1].id, [15, 45, 58])

  console.log(`✅ ${facturasData.length} facturas creadas`)

  // ============ INVENTARIO ============
  const inventarioData = [
    { nombre: 'Sensor de temperatura NTC 10K',        sku: 'SEN-NTC-001', stock: 8,  stockMinimo: 5,  precioUnit: 4800,  categoria: 'Sensores' },
    { nombre: 'Rodamiento 6202-2RS',                  sku: 'ROD-6202-001',stock: 3,  stockMinimo: 10, precioUnit: 1200,  categoria: 'Mecánica' },
    { nombre: 'Cable SpO2 adulto Nellcor compatible',  sku: 'CAB-SPO2-001',stock: 12, stockMinimo: 5,  precioUnit: 7500,  categoria: 'Cables' },
    { nombre: 'Batería 12V 7Ah para desfibrilador',   sku: 'BAT-12V-001',  stock: 6,  stockMinimo: 3,  precioUnit: 18000, categoria: 'Baterías' },
    { nombre: 'Papel térmico ECG 80mm',               sku: 'PAP-ECG-001',  stock: 25, stockMinimo: 10, precioUnit: 850,   categoria: 'Insumos' },
    { nombre: 'Fusible 5A 250V cerámico',              sku: 'FUS-5A-001',   stock: 50, stockMinimo: 20, precioUnit: 120,   categoria: 'Eléctrica' },
    { nombre: 'Junta de silicona autoclave',           sku: 'JUN-SIL-001',  stock: 4,  stockMinimo: 5,  precioUnit: 2800,  categoria: 'Mecánica' },
    { nombre: 'Electroválvula 24VDC 1/4 NPT',         sku: 'ELV-24V-001',  stock: 7,  stockMinimo: 3,  precioUnit: 9500,  categoria: 'Neumática' },
    { nombre: 'Pantalla TFT 7" para monitor paciente', sku: 'PAN-TFT-001',  stock: 2,  stockMinimo: 2,  precioUnit: 95, moneda: 'USD', categoria: 'Electrónica' },
    { nombre: 'Gel conductor ECG 250ml',               sku: 'GEL-ECG-001',  stock: 18, stockMinimo: 10, precioUnit: 650,   categoria: 'Insumos' },
    { nombre: 'Compresor de membrana 12V',             sku: 'COM-MEM-001',  stock: 3,  stockMinimo: 2,  precioUnit: 22000, categoria: 'Mecánica' },
    { nombre: 'Filtro HEPA para incubadora',           sku: 'FIL-HEP-001',  stock: 9,  stockMinimo: 5,  precioUnit: 5600,  categoria: 'Filtros' },
    { nombre: 'Transductor de presión 0-300cmH2O',    sku: 'TRA-PRE-001',  stock: 4,  stockMinimo: 3,  precioUnit: 31000, categoria: 'Sensores' },
    { nombre: 'Cinta adhesiva electrodos 100u',        sku: 'CIN-ELE-001',  stock: 30, stockMinimo: 15, precioUnit: 400,   categoria: 'Insumos' },
    { nombre: 'Módulo Wi-Fi ESP32 para telemetría',   sku: 'MOD-ESP-001',  stock: 5,  stockMinimo: 3,  precioUnit: 3200,  categoria: 'Electrónica' },
  ]

  await prisma.inventario.createMany({ data: inventarioData, skipDuplicates: true })
  console.log(`✅ ${inventarioData.length} ítems de inventario creados`)

  // Equipo demo con kit de venta (monitor + accesorios)
  const monitor = await prisma.inventario.upsert({
    where: { sku: 'MON-PAT-001' },
    create: {
      nombre: 'Monitor multiparamétrico Mindray ePM 12',
      sku: 'MON-PAT-001',
      descripcion: 'Monitor de signos vitales 12" — venta con kit',
      categoria: 'Equipos',
      tipoArticulo: 'EQUIPO',
      marca: 'Mindray',
      modelo: 'ePM 12',
      esSerializado: true,
      requierePreventivo: true,
      intervaloPreventivoDias: 180,
      stock: 3,
      stockMinimo: 1,
      precioUnit: 850000,
    },
    update: {
      tipoArticulo: 'EQUIPO',
      marca: 'Mindray',
      modelo: 'ePM 12',
      esSerializado: true,
      requierePreventivo: true,
      intervaloPreventivoDias: 180,
      precioUnit: 850000,
    },
  })

  const cabSpo2 = await prisma.inventario.findUnique({ where: { sku: 'CAB-SPO2-001' } })
  const bat12v = await prisma.inventario.findUnique({ where: { sku: 'BAT-12V-001' } })

  await prisma.inventarioKitItem.deleteMany({ where: { inventarioPadreId: monitor.id } })
  await prisma.inventarioKitItem.createMany({
    data: [
      {
        inventarioPadreId: monitor.id,
        inventarioHijoId: cabSpo2?.id ?? null,
        nombre: 'Cable SpO2 adulto incluido',
        tipoItem: 'ACCESORIO_ESPECIFICO',
        cantidad: 1,
        obligatorio: true,
        orden: 0,
      },
      {
        inventarioPadreId: monitor.id,
        inventarioHijoId: bat12v?.id ?? null,
        nombre: 'Batería respaldo 12V',
        tipoItem: 'BATERIA',
        tipoComponente: 'BATERIA',
        cantidad: 1,
        mesesVencimiento: 24,
        obligatorio: false,
        orden: 1,
      },
      {
        inventarioPadreId: monitor.id,
        nombre: 'Filtro de aire interno',
        tipoItem: 'COMPONENTE',
        tipoComponente: 'FILTRO',
        cantidad: 1,
        mesesVencimiento: 12,
        obligatorio: false,
        orden: 2,
      },
    ],
  })
  console.log('✅ Equipo demo MON-PAT-001 con kit de venta')

  const { seedListasPrecios } = await import('../lib/precios/seed-listas-precios')
  const listas = await seedListasPrecios(prisma)
  console.log(`✅ Listas de precios seed (${listas.items} ítems en MIN-ARS / MAY-ARS)`)

  const { seedEmbudoIfEmpty } = await import('../lib/crm/embudo-seed')
  const embudoCount = await seedEmbudoIfEmpty(prisma)
  if (embudoCount > 0) console.log(`✅ ${embudoCount} negocios de ejemplo en embudo CRM`)

  console.log('\n🎉 Seed completado exitosamente!')
  console.log('📧 admin@ibiomedica.com / admin123')
  console.log('📧 tecnico@ibiomedica.com / tecnico123')
}

main()
  .catch((e) => { console.error('❌ Error en seed:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
