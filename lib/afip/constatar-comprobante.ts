/**
 * Constatación de comprobantes de compra vía WSCDC (@afipsdk/afip.js).
 * Homologación sin certificado → resultado simulado OK (igual que ventas).
 */
import Afip from '@afipsdk/afip.js'
import { prisma } from '@/lib/prisma'
import { getStorage } from '@/lib/storage'

export interface InputConstatacion {
  cuitEmisor: string
  tipoComprobante: number
  puntoVenta: number
  numeroComprobante: number
  fecha: Date
  importeTotal: number
  cae: string
  cuitReceptor: string
}

export interface ResultadoConstatacion {
  ok: boolean
  resultado?: 'A' | 'R' | 'O'
  observaciones?: string
  simulado?: boolean
}

function cuitNumerico(cuit: string): number {
  return parseInt(cuit.replace(/\D/g, ''), 10)
}

function fechaAfip(d: Date): number {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return Number(`${y}${m}${day}`)
}

function constatacionSimulada(): ResultadoConstatacion {
  return { ok: true, resultado: 'A', simulado: true, observaciones: 'Constatación simulada (homologación sin certificado)' }
}

export async function constatarComprobanteCompra(input: InputConstatacion): Promise<ResultadoConstatacion> {
  if (!input.cae?.trim()) {
    return { ok: false, observaciones: 'Indicá el CAE del comprobante' }
  }

  let emisor: Awaited<ReturnType<typeof prisma.emisor.findFirst>> = null
  try {
    emisor = await prisma.emisor.findFirst({
      where: { activo: true },
      orderBy: { predeterminado: 'desc' },
    })
  } catch {
    console.warn('[afip/wscdc] BD no disponible; constatación simulada')
    return constatacionSimulada()
  }

  if (!emisor?.certificadoPath || !emisor.clavePrivadaPath) {
    if (emisor?.ambiente === 'PRODUCCION') {
      return {
        ok: false,
        observaciones: 'No hay certificado AFIP configurado para constatar en producción',
      }
    }
    console.warn('[afip/wscdc] Sin certificado; constatación simulada')
    return constatacionSimulada()
  }

  try {
    const storage = getStorage()
    const cert = await storage.get(emisor.certificadoPath)
    const key = await storage.get(emisor.clavePrivadaPath)

    const afip = new Afip({
      CUIT: cuitNumerico(emisor.cuit),
      cert: cert.toString('utf8'),
      key: key.toString('utf8'),
      production: emisor.ambiente === 'PRODUCCION',
      access_token: process.env.AFIP_ACCESS_TOKEN ?? '',
    } as ConstructorParameters<typeof Afip>[0])

    const ws = (afip as { WebService?: (id: string) => { getTokenAuthorization: () => Promise<{ token: string; sign: string }>; executeRequest: (m: string, d: unknown) => Promise<unknown> } }).WebService?.('wscdc')
    if (!ws) {
      console.warn('[afip/wscdc] WebService no disponible; simulando')
      return constatacionSimulada()
    }

    const ta = await ws.getTokenAuthorization()
    const data = {
      Auth: {
        Token: ta.token,
        Sign: ta.sign,
        Cuit: cuitNumerico(emisor.cuit),
      },
      CmpReq: {
        CbteModo: 'CAE',
        CuitEmisor: cuitNumerico(input.cuitEmisor),
        PtoVta: input.puntoVenta,
        CbteTipo: input.tipoComprobante,
        CbteNro: input.numeroComprobante,
        CbteFch: fechaAfip(input.fecha),
        ImpTotal: Number(input.importeTotal),
        CodAutorizacion: input.cae.trim(),
        DocTipoReceptor: '80',
        DocNroReceptor: String(cuitNumerico(input.cuitReceptor)),
      },
    }

    const res = await ws.executeRequest('ComprobanteConstatar', data) as {
      ComprobanteConstatarResult?: { Resultado?: string; Obs?: { Obs?: { Msg?: string }[] }; Errors?: { Err?: { Msg?: string }[] } }
      Resultado?: string
    }

    const resultado = (res?.ComprobanteConstatarResult?.Resultado ?? res?.Resultado ?? '') as 'A' | 'R' | 'O' | ''
    if (resultado === 'A') {
      return { ok: true, resultado: 'A' }
    }
    if (resultado === 'O') {
      const obs = res?.ComprobanteConstatarResult?.Obs?.Obs?.map((o) => o.Msg).filter(Boolean).join('; ')
      return { ok: true, resultado: 'O', observaciones: obs || 'Observaciones AFIP' }
    }

    const errs = res?.ComprobanteConstatarResult?.Errors?.Err?.map((e) => e.Msg).filter(Boolean).join('; ')
    return { ok: false, resultado: 'R', observaciones: errs || 'Comprobante rechazado por AFIP' }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Error al constatar en AFIP'
    console.error('[afip/wscdc]', msg)
    if (emisor.ambiente !== 'PRODUCCION') {
      return constatacionSimulada()
    }
    return { ok: false, observaciones: msg }
  }
}

/** Resuelve CUIT receptor (empresa) para WSCDC. */
export async function cuitReceptorEmpresa(): Promise<string | null> {
  const emisor = await prisma.emisor.findFirst({
    where: { activo: true },
    orderBy: { predeterminado: 'desc' },
    select: { cuit: true },
  })
  return emisor?.cuit ?? null
}
