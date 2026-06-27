/**
 * Consulta de constancia de inscripción ARCA (ws_sr_constancia_inscripcion).
 */
import { cuitSoloDigitos } from '@/lib/cuit'
import { crearInstanciaAfip } from '@/lib/afip/crear-instancia'
import {
  mapearContribuyenteArca,
  type ContribuyenteArcaDto,
} from '@/lib/afip/mappers/contribuyente-arca'

export type ResultadoConsultaContribuyente =
  | { ok: true; data: ContribuyenteArcaDto }
  | { ok: false; mensaje: string; codigo?: 'NO_ENCONTRADO' | 'CONFIG' | 'AFIP' }

export async function consultarContribuyenteArca(cuit: string): Promise<ResultadoConsultaContribuyente> {
  const instancia = await crearInstanciaAfip()
  if (!instancia.ok) {
    return { ok: false, mensaje: instancia.mensaje, codigo: 'CONFIG' }
  }

  const cuitNum = parseInt(cuitSoloDigitos(cuit), 10)
  if (!Number.isFinite(cuitNum) || String(cuitNum).length !== 11) {
    return { ok: false, mensaje: 'CUIT inválido', codigo: 'CONFIG' }
  }

  try {
    const raw = await instancia.afip.RegisterInscriptionProof.getTaxpayerDetails(cuitNum)

    if (raw == null) {
      return {
        ok: false,
        mensaje: 'No existe contribuyente con ese CUIT',
        codigo: 'NO_ENCONTRADO',
      }
    }

    const data = mapearContribuyenteArca(raw, cuit, {
      modoDev: instancia.modoDev,
    })

    return { ok: true, data }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error al consultar ARCA'
    const lower = msg.toLowerCase()
    if (lower.includes('no existe')) {
      return {
        ok: false,
        mensaje: 'No existe contribuyente con ese CUIT',
        codigo: 'NO_ENCONTRADO',
      }
    }
    if (instancia.modoDev) {
      return {
        ok: false,
        mensaje:
          'No se pudo consultar en homologación sin certificado. Subí certificado/clave del emisor o probá con un CUIT de prueba de ARCA.',
        codigo: 'AFIP',
      }
    }
    return { ok: false, mensaje: msg, codigo: 'AFIP' }
  }
}
