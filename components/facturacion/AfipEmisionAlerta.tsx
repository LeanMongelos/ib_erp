'use client'

import { AlertTriangle } from 'lucide-react'
import {
  estadoPreparacionAfip,
  validarEmisionAfip,
  type EmisorAfipCampos,
} from '@/lib/afip/validar-emision'

const PREP_MSG: Record<ReturnType<typeof estadoPreparacionAfip>, string | null> = {
  listo_produccion: null,
  listo_cambiar_a_produccion:
    'Emisor en homologación con certificados cargados. Podés emitir con CAE simulado o cambiar a Producción cuando AFIP autorice.',
  produccion_sin_certificados:
    'Emisor en PRODUCCIÓN sin certificados AFIP. La emisión fiscal está bloqueada hasta subir certificado y clave en Configuración → Emisores.',
  homologacion_sin_cert:
    'Emisor en homologación sin certificados: se permitirá CAE simulado en desarrollo.',
}

export function useEmisorAfipGuard(emisor: EmisorAfipCampos | null | undefined) {
  const errorBloqueo = validarEmisionAfip(emisor)
  const prep = emisor ? estadoPreparacionAfip(emisor) : null
  const aviso = prep ? PREP_MSG[prep] : null
  return { errorBloqueo, aviso, bloqueado: Boolean(errorBloqueo) }
}

export function AfipEmisionAlerta({ emisor }: { emisor: EmisorAfipCampos | null | undefined }) {
  const { errorBloqueo, aviso } = useEmisorAfipGuard(emisor)
  const mensaje = errorBloqueo ?? aviso
  if (!mensaje) return null

  const esError = Boolean(errorBloqueo)

  return (
    <div
      className={`flex items-start gap-2 rounded-[9px] border px-3 py-2.5 text-[12px] ${
        esError
          ? 'bg-red-50 border-red-200 text-red-800'
          : 'bg-[#FFFBF5] border-[#FFE4CC] text-[#92400E]'
      }`}
    >
      <AlertTriangle size={15} className="shrink-0 mt-0.5" />
      <p className="font-medium leading-snug">{mensaje}</p>
    </div>
  )
}
