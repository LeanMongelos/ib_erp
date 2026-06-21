/**
 * Catálogos contables/fiscales Argentina — defaults para seed y primera carga.
 */

import { prisma } from '@/lib/prisma'
import { ensureAlicuotasIvaDefault } from '@/lib/iva/alicuotas-default'

export async function ensureContabilidadArgentina() {
  await ensureAlicuotasIvaDefault()
  const alicuota21 = await prisma.alicuotaIva.findFirst({ where: { codigo: 'IVA_21' } })
  const alicuota0 = await prisma.alicuotaIva.findFirst({ where: { codigo: 'IVA_0' } })

  // ── Condiciones IVA (AFIP / RG) ──
  const condicionesIva = [
    { id: 'civa-ri', codigo: 'RI', nombre: 'Responsable Inscripto', descripcion: 'Emite/recibe factura A o M. Discrimina IVA.', alicuotaIvaId: alicuota21?.id, requiereCuit: true, esDefault: true, orden: 1 },
    { id: 'civa-monotributo', codigo: 'MONOTRIBUTO', nombre: 'Monotributo', descripcion: 'No discrimina IVA en ventas. Límite categoría según AFIP.', alicuotaIvaId: alicuota21?.id, requiereCuit: true, orden: 2 },
    { id: 'civa-exento', codigo: 'EXENTO', nombre: 'Exento en IVA', descripcion: 'Operaciones exentas. Factura C o B según caso.', alicuotaIvaId: alicuota0?.id, requiereCuit: true, orden: 3 },
    { id: 'civa-cf', codigo: 'CF', nombre: 'Consumidor Final', descripcion: 'Comprador final. Factura B/C sin CUIT obligatorio.', alicuotaIvaId: alicuota21?.id, requiereCuit: false, orden: 4 },
    { id: 'civa-rni', codigo: 'RNI', nombre: 'Responsable No Inscripto', descripcion: 'Sujeto a retención/percepción de IVA.', alicuotaIvaId: alicuota21?.id, requiereCuit: true, orden: 5 },
    { id: 'civa-exterior', codigo: 'EXTERIOR', nombre: 'Cliente del Exterior', descripcion: 'Exportación de servicios/bienes. Factura E.', alicuotaIvaId: alicuota0?.id, requiereCuit: false, orden: 6 },
  ]
  for (const c of condicionesIva) {
    await prisma.condicionIvaCat.upsert({
      where: { codigo: c.codigo },
      create: c,
      update: { nombre: c.nombre, descripcion: c.descripcion, alicuotaIvaId: c.alicuotaIvaId, requiereCuit: c.requiereCuit, orden: c.orden },
    })
  }

  // ── Jurisdicciones IIBB (principales + Formosa) ──
  const jurisdicciones = [
    { id: 'iibb-caba', codigo: 'CABA', nombre: 'Ciudad Autónoma de Buenos Aires', provincia: 'CABA', alicuotaGeneral: 3.5, convenioMultilateral: true },
    { id: 'iibb-ba', codigo: 'BA', nombre: 'Provincia de Buenos Aires', provincia: 'Buenos Aires', alicuotaGeneral: 3.5, convenioMultilateral: true },
    { id: 'iibb-cordoba', codigo: 'CBA', nombre: 'Córdoba', provincia: 'Córdoba', alicuotaGeneral: 3.0, convenioMultilateral: true },
    { id: 'iibb-santafe', codigo: 'SF', nombre: 'Santa Fe', provincia: 'Santa Fe', alicuotaGeneral: 3.0, convenioMultilateral: true },
    { id: 'iibb-mendoza', codigo: 'MZA', nombre: 'Mendoza', provincia: 'Mendoza', alicuotaGeneral: 3.0, convenioMultilateral: true },
    { id: 'iibb-formosa', codigo: 'FMA', nombre: 'Formosa', provincia: 'Formosa', alicuotaGeneral: 3.5, convenioMultilateral: false },
    { id: 'iibb-tucuman', codigo: 'TUC', nombre: 'Tucumán', provincia: 'Tucumán', alicuotaGeneral: 3.5, convenioMultilateral: true },
    { id: 'iibb-nacion', codigo: 'SIRCAR', nombre: 'SIRCAR / Convenio Multilateral', provincia: 'Nacional', alicuotaGeneral: null, convenioMultilateral: true },
  ]
  for (const j of jurisdicciones) {
    await prisma.jurisdiccionIibb.upsert({
      where: { codigo: j.codigo },
      create: j,
      update: { nombre: j.nombre, provincia: j.provincia, alicuotaGeneral: j.alicuotaGeneral, convenioMultilateral: j.convenioMultilateral },
    })
  }

  const jFormosa = await prisma.jurisdiccionIibb.findUnique({ where: { codigo: 'FMA' } })

  // ── Retenciones y percepciones habituales ──
  const regimenes = [
    { id: 'reg-rg-gan', codigo: 'RG830_GAN', nombre: 'Retención Ganancias — RG 830', tipo: 'RET_GAN', alicuota: 2, minimoNoImponible: 240000, baseMinima: 0 },
    { id: 'reg-rg-iva', codigo: 'RG2854_IVA', nombre: 'Retención IVA — RG 2854', tipo: 'RET_IVA', alicuota: 50, minimoNoImponible: 0, baseMinima: 0 },
    { id: 'reg-rp-iva', codigo: 'RG2408_IVA', nombre: 'Percepción IVA — RG 2408', tipo: 'PERC_IVA', alicuota: 3, minimoNoImponible: 0, baseMinima: 0 },
    { id: 'reg-rg-iibb-fma', codigo: 'IIBB_FMA', nombre: 'Retención IIBB Formosa', tipo: 'RET_IIBB', alicuota: 3.5, minimoNoImponible: 0, baseMinima: 0, jurisdiccionIibbId: jFormosa?.id },
    { id: 'reg-rp-iibb-fma', codigo: 'PERC_IIBB_FMA', nombre: 'Percepción IIBB Formosa', tipo: 'PERC_IIBB', alicuota: 3.5, minimoNoImponible: 0, baseMinima: 0, jurisdiccionIibbId: jFormosa?.id },
    { id: 'reg-rg-suss', codigo: 'SUSS_931', nombre: 'Retención SUSS — Decreto 931', tipo: 'RET_SUSS', alicuota: 1, minimoNoImponible: 0, baseMinima: 0 },
  ]
  for (const r of regimenes) {
    await prisma.regimenImpositivo.upsert({
      where: { codigo: r.codigo },
      create: r,
      update: { nombre: r.nombre, alicuota: r.alicuota, minimoNoImponible: r.minimoNoImponible, baseMinima: r.baseMinima, jurisdiccionIibbId: r.jurisdiccionIibbId ?? null },
    })
  }

  // ── Condiciones de pago ──
  const condicionesPago = [
    { id: 'cp-contado', codigo: 'CONTADO', nombre: 'Contado', diasPlazo: 0, esDefault: true },
    { id: 'cp-30', codigo: '30_DIAS', nombre: '30 días', diasPlazo: 30 },
    { id: 'cp-306090', codigo: '30_60_90', nombre: '30 · 60 · 90 días', diasPlazo: 90, plazosCobranza: '30-60-90' },
    { id: 'cp-154558', codigo: '15_45_58', nombre: '15 · 45 · 58 días', diasPlazo: 58, plazosCobranza: '15-45-58' },
    { id: 'cp-cheque', codigo: 'CHEQUE', nombre: 'Cheque diferido', diasPlazo: 30 },
  ]
  for (const cp of condicionesPago) {
    await prisma.condicionPagoCat.upsert({
      where: { codigo: cp.codigo },
      create: cp,
      update: { nombre: cp.nombre, diasPlazo: cp.diasPlazo, plazosCobranza: cp.plazosCobranza ?? null },
    })
  }

  // ── Tipos comprobante AFIP ──
  const comprobantes = [
    { id: 'tca-1', codigoAfip: 1, letra: 'A', descripcion: 'Factura A', aplicaIva: true },
    { id: 'tca-6', codigoAfip: 6, letra: 'B', descripcion: 'Factura B', aplicaIva: true },
    { id: 'tca-11', codigoAfip: 11, letra: 'C', descripcion: 'Factura C', aplicaIva: false },
    { id: 'tca-19', codigoAfip: 19, letra: 'E', descripcion: 'Factura E (Exportación)', aplicaIva: false },
    { id: 'tca-51', codigoAfip: 51, letra: 'M', descripcion: 'Factura M', aplicaIva: true },
    { id: 'tca-3', codigoAfip: 3, letra: 'A', descripcion: 'Nota de Crédito A', aplicaIva: true },
    { id: 'tca-8', codigoAfip: 8, letra: 'B', descripcion: 'Nota de Crédito B', aplicaIva: true },
    { id: 'tca-13', codigoAfip: 13, letra: 'C', descripcion: 'Nota de Crédito C', aplicaIva: false },
  ]
  for (const t of comprobantes) {
    await prisma.tipoComprobanteAfip.upsert({
      where: { codigoAfip: t.codigoAfip },
      create: t,
      update: { descripcion: t.descripcion, letra: t.letra, aplicaIva: t.aplicaIva },
    })
  }

  // ── Tipos documento AFIP ──
  const tiposDoc = [
    { id: 'tdoc-80', codigoAfip: 80, nombre: 'CUIT' },
    { id: 'tdoc-86', codigoAfip: 86, nombre: 'CUIL' },
    { id: 'tdoc-96', codigoAfip: 96, nombre: 'DNI' },
    { id: 'tdoc-99', codigoAfip: 99, nombre: 'Consumidor Final / Sin identificar' },
    { id: 'tdoc-91', codigoAfip: 91, nombre: 'CI Extranjera' },
    { id: 'tdoc-94', codigoAfip: 94, nombre: 'Pasaporte' },
  ]
  for (const d of tiposDoc) {
    await prisma.tipoDocumentoAfip.upsert({
      where: { codigoAfip: d.codigoAfip },
      create: d,
      update: { nombre: d.nombre },
    })
  }

  // ── Plan de cuentas base (estructura macro) ──
  const planBase = [
    { id: 'pc-1', codigo: '1', nombre: 'ACTIVO', tipo: 'ACTIVO', nivel: 1, aceptaImputacion: false },
    { id: 'pc-11', codigo: '1.1', nombre: 'Activo Corriente', tipo: 'ACTIVO', nivel: 2, padreId: 'pc-1', aceptaImputacion: false },
    { id: 'pc-111', codigo: '1.1.01', nombre: 'Caja y Bancos', tipo: 'ACTIVO', nivel: 3, padreId: 'pc-11', aceptaImputacion: true },
    { id: 'pc-112', codigo: '1.1.02', nombre: 'Créditos por Ventas', tipo: 'ACTIVO', nivel: 3, padreId: 'pc-11', aceptaImputacion: true },
    { id: 'pc-12', codigo: '1.2', nombre: 'Activo No Corriente', tipo: 'ACTIVO', nivel: 2, padreId: 'pc-1', aceptaImputacion: false },
    { id: 'pc-2', codigo: '2', nombre: 'PASIVO', tipo: 'PASIVO', nivel: 1, aceptaImputacion: false },
    { id: 'pc-21', codigo: '2.1', nombre: 'Pasivo Corriente', tipo: 'PASIVO', nivel: 2, padreId: 'pc-2', aceptaImputacion: false },
    { id: 'pc-211', codigo: '2.1.01', nombre: 'Proveedores', tipo: 'PASIVO', nivel: 3, padreId: 'pc-21', aceptaImputacion: true },
    { id: 'pc-212', codigo: '2.1.02', nombre: 'IVA Débito Fiscal', tipo: 'PASIVO', nivel: 3, padreId: 'pc-21', aceptaImputacion: true },
    { id: 'pc-213', codigo: '2.1.03', nombre: 'Retenciones y Percepciones a Depositar', tipo: 'PASIVO', nivel: 3, padreId: 'pc-21', aceptaImputacion: true },
    { id: 'pc-3', codigo: '3', nombre: 'PATRIMONIO NETO', tipo: 'PATRIMONIO', nivel: 1, aceptaImputacion: false },
    { id: 'pc-4', codigo: '4', nombre: 'INGRESOS', tipo: 'INGRESO', nivel: 1, aceptaImputacion: false },
    { id: 'pc-41', codigo: '4.1', nombre: 'Ventas de Servicios Biomédicos', tipo: 'INGRESO', nivel: 2, padreId: 'pc-4', aceptaImputacion: true },
    { id: 'pc-42', codigo: '4.2', nombre: 'Ventas de Repuestos y Equipos', tipo: 'INGRESO', nivel: 2, padreId: 'pc-4', aceptaImputacion: true },
    { id: 'pc-5', codigo: '5', nombre: 'EGRESOS', tipo: 'EGRESO', nivel: 1, aceptaImputacion: false },
    { id: 'pc-51', codigo: '5.1', nombre: 'Costo de Repuestos', tipo: 'EGRESO', nivel: 2, padreId: 'pc-5', aceptaImputacion: true },
    { id: 'pc-52', codigo: '5.2', nombre: 'Gastos de Personal', tipo: 'EGRESO', nivel: 2, padreId: 'pc-5', aceptaImputacion: true },
  ]
  for (const c of planBase) {
    await prisma.planCuenta.upsert({
      where: { codigo: c.codigo },
      create: c,
      update: { nombre: c.nombre, tipo: c.tipo, nivel: c.nivel, padreId: c.padreId ?? null, aceptaImputacion: c.aceptaImputacion },
    })
  }

  // ── Ejercicio contable actual ──
  const anio = new Date().getFullYear()
  const ejercicio = await prisma.ejercicioContable.upsert({
    where: { anio },
    create: {
      id: `ejercicio-${anio}`,
      nombre: `Ejercicio ${anio}`,
      anio,
      fechaInicio: new Date(anio, 0, 1),
      fechaFin: new Date(anio, 11, 31, 23, 59, 59),
      activo: true,
    },
    update: { activo: true },
  })

  await prisma.configuracionContable.upsert({
    where: { id: 'default' },
    create: {
      id: 'default',
      ejercicioActivoId: ejercicio.id,
      monedaFuncional: 'ARS',
      libroIvaDigital: true,
      periodicidadIva: 'MENSUAL',
      cierreIvaDia: 20,
    },
    update: {},
  })

  return prisma.configuracionContable.findUnique({
    where: { id: 'default' },
    include: { ejercicioActivo: true },
  })
}

export async function getResumenContabilidad() {
  const [
    config,
    alicuotas,
    condicionesIva,
    jurisdicciones,
    regimenes,
    condicionesPago,
    planCuentas,
    ejercicios,
    comprobantesAfip,
    tiposDocumento,
  ] = await Promise.all([
    prisma.configuracionContable.findUnique({ where: { id: 'default' }, include: { ejercicioActivo: true } }),
    prisma.alicuotaIva.findMany({ where: { activo: true }, orderBy: { porcentaje: 'asc' } }),
    prisma.condicionIvaCat.findMany({ where: { activo: true }, orderBy: { orden: 'asc' }, include: { alicuotaIva: true } }),
    prisma.jurisdiccionIibb.findMany({ where: { activo: true }, orderBy: { provincia: 'asc' } }),
    prisma.regimenImpositivo.findMany({ where: { activo: true }, include: { jurisdiccion: true } }),
    prisma.condicionPagoCat.findMany({ where: { activo: true } }),
    prisma.planCuenta.findMany({ where: { activo: true }, orderBy: { codigo: 'asc' } }),
    prisma.ejercicioContable.findMany({ orderBy: { anio: 'desc' } }),
    prisma.tipoComprobanteAfip.findMany({ where: { activo: true }, orderBy: { codigoAfip: 'asc' } }),
    prisma.tipoDocumentoAfip.findMany({ where: { activo: true }, orderBy: { codigoAfip: 'asc' } }),
  ])

  return {
    config,
    alicuotas,
    condicionesIva,
    jurisdicciones,
    regimenes,
    condicionesPago,
    planCuentas,
    ejercicios,
    comprobantesAfip,
    tiposDocumento,
  }
}
