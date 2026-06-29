'use client'

import { useEffect, useState } from 'react'
import { X, FileText, Printer } from 'lucide-react'
import { toast } from 'sonner'
import { ModalOverlay } from '@/components/ui/modal-overlay'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  buildActaEntregaDefaults,
  type ActaEntregaDefaultsInput,
  type ActaEntregaFormValues,
} from '@/lib/alquiler/acta-entrega-client'
import { mensajeErrorDesconocido, mensajeErrorRespuesta } from '@/lib/errores'

interface ActaExistente {
  id: string
  numero: string
}

interface Props {
  open: boolean
  contratoId: string
  lineaId: string
  defaultsInput: ActaEntregaDefaultsInput
  actaExistente?: ActaExistente | null
  facturasDisponibles?: Array<{ id: string; numero: string; periodo: string }>
  onClose: () => void
  onGuardada: (acta: ActaExistente) => void
}

function labelRow(label: string, children: React.ReactNode) {
  return (
    <label className="block space-y-1">
      <span className="text-[11px] font-semibold text-[#6b7280] uppercase tracking-wide">{label}</span>
      {children}
    </label>
  )
}

export function ActaEntregaAlquilerModal({
  open,
  contratoId,
  lineaId,
  defaultsInput,
  actaExistente,
  facturasDisponibles = [],
  onClose,
  onGuardada,
}: Props) {
  const [form, setForm] = useState<ActaEntregaFormValues>(() =>
    buildActaEntregaDefaults(defaultsInput),
  )
  const [guardando, setGuardando] = useState(false)
  const [actaId, setActaId] = useState<string | null>(actaExistente?.id ?? null)

  useEffect(() => {
    if (!open) return
    if (actaExistente?.id) {
      setActaId(actaExistente.id)
      fetch(`/api/alquiler/actas/${actaExistente.id}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (!data) {
            setForm(buildActaEntregaDefaults(defaultsInput))
            return
          }
          setForm({
            clienteNombre: data.clienteNombre,
            clienteDni: data.clienteDni ?? '',
            clienteDireccion: data.clienteDireccion ?? '',
            clienteTelefono: data.clienteTelefono ?? '',
            equipoNombre: data.equipoNombre,
            numeroSerie: data.numeroSerie ?? '',
            fechaActa: data.fechaActa.slice(0, 10),
            lugar: data.lugar,
            montoAlquiler: data.montoAlquiler,
            periodoAlquiler: data.periodoAlquiler,
            montoDepositoGarantia: data.montoDepositoGarantia,
            observaciones: data.observaciones ?? '',
            facturaId: data.facturaId ?? '',
          })
        })
        .catch(() => setForm(buildActaEntregaDefaults(defaultsInput)))
    } else {
      setForm(buildActaEntregaDefaults(defaultsInput))
      setActaId(null)
    }
  }, [open, defaultsInput, actaExistente?.id])

  if (!open) return null

  function patch(partial: Partial<ActaEntregaFormValues>) {
    setForm((prev) => ({ ...prev, ...partial }))
  }

  function imprimirPdf(id: string) {
    window.open(`/api/alquiler/actas/${id}/pdf`, '_blank', 'noopener,noreferrer')
  }

  async function guardar(imprimir = false) {
    if (!form.clienteNombre.trim()) {
      toast.error('El nombre del cliente/beneficiario es obligatorio')
      return
    }
    if (!form.equipoNombre.trim()) {
      toast.error('El nombre del equipo es obligatorio')
      return
    }

    setGuardando(true)
    try {
      const payload = {
        lineaId,
        clienteNombre: form.clienteNombre.trim(),
        clienteDni: form.clienteDni.trim() || null,
        clienteDireccion: form.clienteDireccion.trim() || null,
        clienteTelefono: form.clienteTelefono.trim() || null,
        equipoNombre: form.equipoNombre.trim(),
        numeroSerie: form.numeroSerie.trim() || null,
        fechaActa: form.fechaActa,
        lugar: form.lugar.trim() || 'Formosa',
        montoAlquiler: form.montoAlquiler,
        periodoAlquiler: form.periodoAlquiler.trim(),
        montoDepositoGarantia: form.montoDepositoGarantia,
        observaciones: form.observaciones.trim() || null,
        facturaId: form.facturaId.trim() || null,
      }

      let acta: ActaExistente
      if (actaId) {
        const res = await fetch(`/api/alquiler/actas/${actaId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!res.ok) throw new Error(await mensajeErrorRespuesta(res, 'No se pudo actualizar el ACTA'))
        const data = await res.json()
        acta = { id: data.id, numero: data.numero }
      } else {
        const res = await fetch(`/api/alquiler/contratos/${contratoId}/actas`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!res.ok) throw new Error(await mensajeErrorRespuesta(res, 'No se pudo crear el ACTA'))
        const data = await res.json()
        acta = { id: data.id, numero: data.numero }
        setActaId(acta.id)
      }

      toast.success(actaId ? `ACTA ${acta.numero} actualizada` : `ACTA ${acta.numero} generada`)
      onGuardada(acta)
      if (imprimir) imprimirPdf(acta.id)
    } catch (e) {
      toast.error(mensajeErrorDesconocido(e, 'Error al guardar ACTA'))
    } finally {
      setGuardando(false)
    }
  }

  return (
    <ModalOverlay zClass="z-[120]">
      <div className="bg-white rounded-[12px] shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto mx-4">
        <div className="flex items-center justify-between border-b border-[#eef0f2] px-5 py-4">
          <div className="flex items-center gap-2">
            <FileText size={18} className="text-[#E8650A]" />
            <h2 className="text-[15px] font-bold text-[#1f242c]">
              {actaId ? 'Editar ACTA de entrega' : 'Generar ACTA de entrega'}
            </h2>
          </div>
          <button type="button" onClick={onClose} className="text-[#9aa1ab] hover:text-[#1f242c]">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {labelRow('Nombre (beneficiario / cliente)', (
            <Input
              value={form.clienteNombre}
              onChange={(e) => patch({ clienteNombre: e.target.value })}
            />
          ))}
          {labelRow('DNI', (
            <Input value={form.clienteDni} onChange={(e) => patch({ clienteDni: e.target.value })} />
          ))}
          {labelRow('Dirección', (
            <Input
              className="sm:col-span-2"
              value={form.clienteDireccion}
              onChange={(e) => patch({ clienteDireccion: e.target.value })}
            />
          ))}
          {labelRow('Teléfono', (
            <Input
              value={form.clienteTelefono}
              onChange={(e) => patch({ clienteTelefono: e.target.value })}
            />
          ))}
          {labelRow('Equipo (nombre completo)', (
            <Input
              className="sm:col-span-2"
              value={form.equipoNombre}
              onChange={(e) => patch({ equipoNombre: e.target.value })}
            />
          ))}
          {labelRow('N° de serie', (
            <Input
              value={form.numeroSerie}
              onChange={(e) => patch({ numeroSerie: e.target.value })}
            />
          ))}
          {labelRow('Fecha del ACTA', (
            <Input
              type="date"
              value={form.fechaActa}
              onChange={(e) => patch({ fechaActa: e.target.value })}
            />
          ))}
          {labelRow('Lugar', (
            <Input value={form.lugar} onChange={(e) => patch({ lugar: e.target.value })} />
          ))}
          {labelRow('Monto alquiler ($)', (
            <Input
              type="number"
              min={0}
              step={1}
              value={form.montoAlquiler}
              onChange={(e) => patch({ montoAlquiler: parseFloat(e.target.value) || 0 })}
            />
          ))}
          {labelRow('Período de alquiler', (
            <Input
              value={form.periodoAlquiler}
              onChange={(e) => patch({ periodoAlquiler: e.target.value })}
              placeholder="ej. junio 2026"
            />
          ))}
          {labelRow('Depósito de garantía ($)', (
            <Input
              type="number"
              min={0}
              step={1}
              value={form.montoDepositoGarantia}
              onChange={(e) => patch({ montoDepositoGarantia: parseFloat(e.target.value) || 0 })}
            />
          ))}
          {labelRow('Vincular factura (opcional)', (
            facturasDisponibles.length > 0 ? (
              <select
                className="w-full border border-[#e4e7eb] rounded-[9px] px-3 py-2 text-[13px] bg-white"
                value={form.facturaId}
                onChange={(e) => patch({ facturaId: e.target.value })}
              >
                <option value="">Sin vincular</option>
                {facturasDisponibles.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.numero} ({f.periodo})
                  </option>
                ))}
              </select>
            ) : (
              <Input
                value={form.facturaId}
                onChange={(e) => patch({ facturaId: e.target.value })}
                placeholder="Opcional — sin facturas en el contrato"
                className="font-mono text-[11px]"
              />
            )
          ))}
          {labelRow('Observaciones', (
            <textarea
              className="sm:col-span-2 w-full border border-[#e4e7eb] rounded-[9px] px-3 py-2 text-[13px] min-h-[72px]"
              value={form.observaciones}
              onChange={(e) => patch({ observaciones: e.target.value })}
            />
          ))}
        </div>

        <div className="flex flex-wrap gap-2 border-t border-[#eef0f2] px-5 py-4">
          <Button variant="primary" size="sm" disabled={guardando} onClick={() => guardar(true)}>
            <Printer size={14} />
            {guardando ? 'Guardando…' : actaId ? 'Guardar e imprimir' : 'Generar e imprimir'}
          </Button>
          <Button variant="outline" size="sm" disabled={guardando} onClick={() => guardar(false)}>
            Solo guardar
          </Button>
          {actaId && (
            <Button variant="outline" size="sm" onClick={() => imprimirPdf(actaId)}>
              <Printer size={14} /> Imprimir ACTA
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      </div>
    </ModalOverlay>
  )
}
