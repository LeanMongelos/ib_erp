/**
 * Instancia compartida de @afipsdk/afip.js a partir del emisor fiscal activo.
 * Usado por consultas ARCA (ws_sr_constancia_inscripcion) y otros WS.
 */
import Afip from '@afipsdk/afip.js'
import { prisma } from '@/lib/prisma'
import { getStorage } from '@/lib/storage'
import { emisorTieneCertificados } from '@/lib/afip/validar-emision'

/** CUIT de prueba AfipSDK (homologación sin certificado propio). */
const CUIT_DEV_AFIPSDK = 20409378472

function cuitNumerico(cuit: string): number {
  return parseInt(cuit.replace(/\D/g, ''), 10)
}

export type ResultadoCrearInstanciaAfip =
  | {
      ok: true
      afip: InstanceType<typeof Afip>
      emisorRazonSocial: string
      ambiente: 'HOMOLOGACION' | 'PRODUCCION'
      /** true = homologación sin certificado (token AfipSDK / CUIT de prueba). */
      modoDev: boolean
    }
  | { ok: false; mensaje: string }

export async function crearInstanciaAfip(): Promise<ResultadoCrearInstanciaAfip> {
  const accessToken = process.env.AFIP_ACCESS_TOKEN?.trim()
  if (!accessToken) {
    return {
      ok: false,
      mensaje:
        'Falta AFIP_ACCESS_TOKEN en la configuración del servidor. Contactá al administrador para habilitar consultas ARCA.',
    }
  }

  const emisor = await prisma.emisor.findFirst({
    where: { activo: true },
    orderBy: [{ predeterminado: 'desc' }, { razonSocial: 'asc' }],
  })

  if (!emisor) {
    return {
      ok: false,
      mensaje: 'No hay emisor fiscal activo. Configurá uno en Configuración → Emisores.',
    }
  }

  const tieneCerts = emisorTieneCertificados(emisor)

  if (emisor.ambiente === 'PRODUCCION' && !tieneCerts) {
    return {
      ok: false,
      mensaje:
        'El emisor está en PRODUCCIÓN pero no tiene certificado AFIP ni clave privada cargados. Subí los archivos en Configuración → Emisores.',
    }
  }

  if (tieneCerts) {
    try {
      const storage = getStorage()
      const cert = await storage.get(emisor.certificadoPath!)
      const key = await storage.get(emisor.clavePrivadaPath!)

      const afip = new Afip({
        CUIT: cuitNumerico(emisor.cuit),
        cert: cert.toString('utf8'),
        key: key.toString('utf8'),
        production: emisor.ambiente === 'PRODUCCION',
        access_token: accessToken,
      } as ConstructorParameters<typeof Afip>[0])

      return {
        ok: true,
        afip,
        emisorRazonSocial: emisor.razonSocial,
        ambiente: emisor.ambiente,
        modoDev: false,
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'No se pudo inicializar el cliente AFIP'
      return { ok: false, mensaje: msg }
    }
  }

  // Homologación sin certificados: AfipSDK en modo desarrollo (token + CUIT emisor o de prueba).
  const intentar = (cuit: number) =>
    new Afip({
      CUIT: cuit,
      production: false,
      access_token: accessToken,
    } as ConstructorParameters<typeof Afip>[0])

  try {
    const afip = intentar(cuitNumerico(emisor.cuit))
    return {
      ok: true,
      afip,
      emisorRazonSocial: emisor.razonSocial,
      ambiente: 'HOMOLOGACION',
      modoDev: true,
    }
  } catch {
    try {
      const afip = intentar(CUIT_DEV_AFIPSDK)
      return {
        ok: true,
        afip,
        emisorRazonSocial: emisor.razonSocial,
        ambiente: 'HOMOLOGACION',
        modoDev: true,
      }
    } catch {
      return {
        ok: false,
        mensaje:
          'No se pudo conectar con ARCA en homologación. Verificá AFIP_ACCESS_TOKEN y el emisor configurado, o subí certificado/clave para consultas reales.',
      }
    }
  }
}
