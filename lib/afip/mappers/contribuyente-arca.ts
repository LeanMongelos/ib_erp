/**
 * Normaliza la respuesta de ws_sr_constancia_inscripcion (getPersona_v2) a un DTO de UI.
 */
import { formatearCuit, cuitSoloDigitos } from '@/lib/cuit'
import { CONDICION_IVA, TIPO_CLIENTE } from '@/lib/form-options'

export interface DomicilioFiscalArca {
  completo: string
  direccion: string | null
  numero: string | null
  ciudad: string | null
  codigoPostal: string | null
  provincia: string | null
}

export interface ContribuyenteArcaDto {
  cuit: string
  nombre: string
  estadoClave: string | null
  tipoPersona: string | null
  fechaContratoSocial: string | null
  actividadPrincipal: string | null
  actividadesResumen: string | null
  impuestosResumen: string | null
  regimenesResumen: string | null
  domicilioFiscal: DomicilioFiscalArca
  condicionIvaSugerida: string | null
  tipoClienteSugerido: string | null
  fechaConsulta: string
  modoDev?: boolean
}

type AfipActividad = {
  descripcionActividad?: string
  idActividad?: string | number
  nomenclador?: string | number
  periodo?: string | number
  orden?: string | number
}

type AfipImpuesto = {
  descripcionImpuesto?: string
  idImpuesto?: string | number
  periodo?: string | number
}

type AfipRegimen = {
  descripcionRegimen?: string
  idRegimen?: string | number
  periodo?: string | number
}

type AfipDomicilio = {
  direccion?: string
  localidad?: string
  codPostal?: string
  descripcionProvincia?: string
  tipoDomicilio?: string
}

type AfipPersonaReturn = {
  datosGenerales?: {
    idPersona?: string | number
    tipoPersona?: string
    tipoClave?: string
    estadoClave?: string
    nombre?: string
    apellido?: string
    razonSocial?: string
    fechaContratoSocial?: string
    domicilioFiscal?: AfipDomicilio
  }
  datosRegimenGeneral?: {
    actividad?: AfipActividad | AfipActividad[]
    impuesto?: AfipImpuesto | AfipImpuesto[]
    regimen?: AfipRegimen | AfipRegimen[]
  }
  datosMonotributo?: {
    actividadMonotributista?: AfipActividad | AfipActividad[]
    categoriaMonotributo?: { descripcionCategoria?: string }
  }
  metadata?: {
    fechaHora?: string
  }
}

function comoArray<T>(v: T | T[] | null | undefined): T[] {
  if (v == null) return []
  return Array.isArray(v) ? v : [v]
}

function formatearFechaAfip(fecha: string | undefined | null): string | null {
  if (!fecha?.trim()) return null
  const raw = fecha.trim()
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) return raw
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`
  const ymd = raw.match(/^(\d{4})(\d{2})(\d{2})/)
  if (ymd) return `${ymd[3]}/${ymd[2]}/${ymd[1]}`
  return raw
}

function parsearDomicilioFiscal(dom: AfipDomicilio | undefined | null): DomicilioFiscalArca {
  if (!dom) {
    return {
      completo: '',
      direccion: null,
      numero: null,
      ciudad: null,
      codigoPostal: null,
      provincia: null,
    }
  }

  const calleRaw = dom.direccion?.trim() ?? ''
  const ciudad = dom.localidad?.trim() || null
  const codigoPostal = dom.codPostal?.trim() || null
  const provincia = dom.descripcionProvincia?.trim() || null

  let direccion = calleRaw || null
  let numero: string | null = null
  const matchNum = calleRaw.match(/^(.+?)\s+(\d+[A-Za-z]?)\s*$/)
  if (matchNum) {
    direccion = matchNum[1]!.trim()
    numero = matchNum[2]!.trim()
  }

  const partes = [calleRaw, ciudad, codigoPostal, provincia].filter(Boolean)
  return {
    completo: partes.join(', '),
    direccion,
    numero,
    ciudad,
    codigoPostal,
    provincia,
  }
}

function resumenActividades(persona: AfipPersonaReturn): {
  principal: string | null
  resumen: string | null
} {
  const rg = comoArray(persona.datosRegimenGeneral?.actividad)
  const mono = comoArray(persona.datosMonotributo?.actividadMonotributista)
  const todas = [...rg, ...mono]
  const textos = todas
    .map((a) => a.descripcionActividad?.trim())
    .filter((t): t is string => Boolean(t))
  const unicos = [...new Set(textos)]
  return {
    principal: unicos[0] ?? null,
    resumen: unicos.length ? unicos.join(' · ') : null,
  }
}

function resumenImpuestos(persona: AfipPersonaReturn): string | null {
  const imp = comoArray(persona.datosRegimenGeneral?.impuesto)
  const textos = imp
    .map((i) => i.descripcionImpuesto?.trim())
    .filter((t): t is string => Boolean(t))
  const unicos = [...new Set(textos)]
  return unicos.length ? unicos.join(' · ') : null
}

function resumenRegimenes(persona: AfipPersonaReturn): string | null {
  const reg = comoArray(persona.datosRegimenGeneral?.regimen)
  const textos = reg
    .map((r) => r.descripcionRegimen?.trim())
    .filter((t): t is string => Boolean(t))
  const unicos = [...new Set(textos)]
  return unicos.length ? unicos.join(' · ') : null
}

function sugerirCondicionIva(persona: AfipPersonaReturn): string | null {
  const impTexto = (resumenImpuestos(persona) ?? '').toLowerCase()
  const monoCat = persona.datosMonotributo?.categoriaMonotributo?.descripcionCategoria

  if (monoCat || impTexto.includes('monotrib')) {
    return valorCondicionIva('Monotributo')
  }
  if (impTexto.includes('exento') && impTexto.includes('iva')) {
    return valorCondicionIva('Exento en IVA')
  }
  if (impTexto.includes('iva')) {
    return valorCondicionIva('Responsable Inscripto')
  }
  if (impTexto.includes('no inscripto')) {
    return valorCondicionIva('Responsable No Inscripto')
  }
  return null
}

function valorCondicionIva(label: string): string | null {
  const found = CONDICION_IVA.find((o) => o.value === label)
  return found?.value ?? null
}

function sugerirTipoCliente(nombre: string): string | null {
  const n = nombre.toLowerCase()
  if (/\bhospital\b/.test(n)) return 'HOSPITAL'
  if (/\bcl[ií]nica\b/.test(n)) return 'CLINICA'
  if (/\bsanatorio\b/.test(n)) return 'SANATORIO'
  if (/\bconsultorio\b/.test(n)) return 'CONSULTORIO'
  if (
    /\bministerio\b/.test(n) ||
    /\bmunicipalidad\b/.test(n) ||
    /\bgobierno\b/.test(n) ||
    /\borganismo\b/.test(n) ||
    /\bsecretar[ií]a\b/.test(n)
  ) {
    return 'ORGANISMO_PUBLICO'
  }
  const validos = new Set(TIPO_CLIENTE.map((o) => o.value))
  return validos.has('OTRO') ? 'OTRO' : null
}

function nombreContribuyente(dg: AfipPersonaReturn['datosGenerales']): string {
  if (!dg) return ''
  if (dg.razonSocial?.trim()) return dg.razonSocial.trim()
  const partes = [dg.apellido?.trim(), dg.nombre?.trim()].filter(Boolean)
  return partes.join(', ') || String(dg.idPersona ?? '').trim()
}

export function mapearContribuyenteArca(
  persona: AfipPersonaReturn,
  cuitConsultado: string,
  opts?: { modoDev?: boolean; fechaConsulta?: string },
): ContribuyenteArcaDto {
  const dg = persona.datosGenerales
  const cuit = formatearCuit(cuitSoloDigitos(String(dg?.idPersona ?? cuitConsultado)))
  const nombre = nombreContribuyente(dg)
  const { principal, resumen } = resumenActividades(persona)
  const domicilioFiscal = parsearDomicilioFiscal(dg?.domicilioFiscal)

  return {
    cuit,
    nombre,
    estadoClave: dg?.estadoClave?.trim() || null,
    tipoPersona: dg?.tipoPersona?.trim() || null,
    fechaContratoSocial: formatearFechaAfip(dg?.fechaContratoSocial),
    actividadPrincipal: principal,
    actividadesResumen: resumen,
    impuestosResumen: resumenImpuestos(persona),
    regimenesResumen: resumenRegimenes(persona),
    domicilioFiscal,
    condicionIvaSugerida: sugerirCondicionIva(persona),
    tipoClienteSugerido: sugerirTipoCliente(nombre),
    fechaConsulta: opts?.fechaConsulta ?? persona.metadata?.fechaHora ?? new Date().toISOString(),
    ...(opts?.modoDev ? { modoDev: true } : {}),
  }
}
