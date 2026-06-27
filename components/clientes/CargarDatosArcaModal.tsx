'use client'

import { useEffect, useMemo, useState } from 'react'
import { X, Search, Info } from 'lucide-react'
import { toast } from 'sonner'
import { ModalOverlay } from '@/components/ui/modal-overlay'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatearCuit, validarCuit } from '@/lib/cuit'
import { mensajeErrorDesconocido, parsearRespuestaApi } from '@/lib/errores'
import type { ContribuyenteArcaDto } from '@/lib/afip/mappers/contribuyente-arca'

export interface ConfirmacionArca {
  data: ContribuyenteArcaDto
  mapFiscal: boolean
  mapSucursal: boolean
}

interface Props {
  open: boolean
  cuitInicial?: string
  onClose: () => void
  onConfirm: (resultado: ConfirmacionArca) => void
}

function filaTabla(label: string, valor: string | null | undefined) {
  if (!valor?.trim()) return null
  return (
    <tr className="border-b border-[#eef0f2] last:border-0">
      <th className="text-left align-top py-2 pr-3 text-[11.5px] font-semibold text-[#6b7280] w-[38%]">
        {label}
      </th>
      <td className="py-2 text-[12.5px] text-[#1f242c] leading-snug">{valor}</td>
    </tr>
  )
}

function formatearFechaConsulta(iso: string): string {
  try {
    return new Intl.DateTimeFormat('es-AR', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

export function CargarDatosArcaModal({ open, cuitInicial = '', onClose, onConfirm }: Props) {
  const [cuit, setCuit] = useState(cuitInicial)
  const [buscando, setBuscando] = useState(false)
  const [datos, setDatos] = useState<ContribuyenteArcaDto | null>(null)
  const [mapFiscal, setMapFiscal] = useState(true)
  const [mapSucursal, setMapSucursal] = useState(true)

  useEffect(() => {
    if (open) {
      setCuit(cuitInicial)
      setDatos(null)
      setMapFiscal(true)
      setMapSucursal(true)
    }
  }, [open, cuitInicial])

  const filas = useMemo(() => {
    if (!datos) return []
    return [
      ['CUIT', datos.cuit],
      ['Razón social / nombre', datos.nombre],
      ['Estado clave', datos.estadoClave],
      ['Tipo persona', datos.tipoPersona],
      ['Fecha contrato social', datos.fechaContratoSocial],
      ['Actividad principal', datos.actividadPrincipal],
      ['Actividades', datos.actividadesResumen],
      ['Impuestos', datos.impuestosResumen],
      ['Regímenes', datos.regimenesResumen],
      ['Domicilio fiscal', datos.domicilioFiscal.completo || null],
      ['Condición IVA sugerida', datos.condicionIvaSugerida],
      ['Tipo cliente sugerido', datos.tipoClienteSugerido],
    ] as const
  }, [datos])

  if (!open) return null

  async function buscar() {
    const cuitTrim = cuit.trim()
    if (!cuitTrim) {
      toast.error('Indicá un CUIT')
      return
    }
    if (!validarCuit(cuitTrim)) {
      toast.error('CUIT inválido — verificá el formato y el dígito verificador')
      return
    }

    setBuscando(true)
    setDatos(null)
    try {
      const resultado = await parsearRespuestaApi<ContribuyenteArcaDto>(
        await fetch(`/api/clientes/consultar-arca?cuit=${encodeURIComponent(cuitTrim)}`),
        'No se pudieron obtener datos de ARCA',
      )
      setDatos(resultado)
    } catch (err) {
      toast.error(mensajeErrorDesconocido(err, 'No se pudieron obtener datos de ARCA'))
    } finally {
      setBuscando(false)
    }
  }

  function confirmar() {
    if (!datos) {
      toast.error('Buscá un contribuyente antes de confirmar')
      return
    }
    onConfirm({ data: datos, mapFiscal, mapSucursal })
    onClose()
  }

  return (
    <ModalOverlay zClass="z-[130]">
      <div
        className="bg-white rounded-[12px] w-full max-w-2xl shadow-xl overflow-hidden max-h-[90vh] flex flex-col"
        role="dialog"
        aria-labelledby="arca-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#e4e7eb] shrink-0">
          <div>
            <h3 id="arca-modal-title" className="text-[15px] font-bold text-[#1f242c]">
              Cargar datos desde ARCA
            </h3>
            <p className="text-[12px] text-[#6b7280] mt-0.5">
              Constancia de inscripción (ws_sr_constancia_inscripcion)
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={buscando}
            className="text-[#9aa1ab] hover:text-[#3a4150] p-1 disabled:opacity-50"
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4 overflow-y-auto flex-1">
          <div className="flex gap-2.5 rounded-lg border border-[#dbeafe] bg-[#eff6ff] px-3.5 py-3 text-[12px] text-[#1e40af] leading-relaxed">
            <Info size={16} className="shrink-0 mt-0.5" />
            <p>
              Se consultan los datos fiscales oficiales del contribuyente en ARCA/AFIP. Revisá la
              información antes de aplicarla al formulario del cliente.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
            <div className="flex-1">
              <Input
                label="CUIT"
                value={cuit}
                onChange={(e) => setCuit(e.target.value)}
                placeholder="30-12345678-9"
                autoComplete="off"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    void buscar()
                  }
                }}
              />
            </div>
            <Button
              type="button"
              variant="secondary"
              loading={buscando}
              onClick={() => void buscar()}
              className="sm:mb-[1px]"
            >
              <Search size={15} />
              Buscar datos
            </Button>
          </div>

          {datos && (
            <>
              {datos.modoDev && (
                <p className="text-[11.5px] text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                  Consulta en homologación sin certificado del emisor. Los datos pueden ser de prueba
                  o limitados; en producción con certificado verás información real.
                </p>
              )}

              <div className="rounded-lg border border-[#eef0f2] overflow-hidden">
                <table className="w-full px-4">
                  <tbody className="px-4">
                    {filas.map(([label, valor]) => filaTabla(label, valor))}
                  </tbody>
                </table>
              </div>

              <p className="text-[11px] text-[#9aa1ab]">
                Consulta realizada: {formatearFechaConsulta(datos.fechaConsulta)}
              </p>

              {datos.domicilioFiscal.completo && (
                <div className="space-y-2 pt-1">
                  <p className="text-[12px] font-semibold text-[#1f242c]">Usar domicilio fiscal en:</p>
                  <label className="flex items-center gap-2 text-[12.5px] text-[#3a4150] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={mapFiscal}
                      onChange={(e) => setMapFiscal(e.target.checked)}
                      className="rounded border-gray-300"
                    />
                    Dirección fiscal / administrativa
                  </label>
                  <label className="flex items-center gap-2 text-[12.5px] text-[#3a4150] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={mapSucursal}
                      onChange={(e) => setMapSucursal(e.target.checked)}
                      className="rounded border-gray-300"
                    />
                    Primera sucursal de instalación
                  </label>
                </div>
              )}
            </>
          )}
        </div>

        <div className="px-5 py-3 border-t border-[#e4e7eb] flex justify-end gap-2 shrink-0">
          <Button type="button" variant="secondary" onClick={onClose} disabled={buscando}>
            Cancelar
          </Button>
          <Button type="button" onClick={confirmar} disabled={!datos || buscando}>
            Confirmar
          </Button>
        </div>
      </div>
    </ModalOverlay>
  )
}
