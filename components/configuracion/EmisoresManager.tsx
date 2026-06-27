'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Building2, Plus, X, Star, Trash2, Pencil } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { CONDICION_IVA } from '@/lib/form-options'
import { estadoPreparacionAfip } from '@/lib/afip/validar-emision'
import { requiereConfirmacionProduccion } from '@/lib/emisores/validar-produccion'
import { useCan } from '@/components/auth/useCan'
import { AyudaInline } from '@/components/ui/AyudaInline'
import { mensajeErrorDesconocido, mensajeErrorJson, mensajeErrorRespuesta } from '@/lib/errores'

interface Emisor {
  id: string
  razonSocial: string
  cuit: string
  condicionIva: string
  ingresosBrutos: string | null
  domicilio: string | null
  ciudad: string | null
  telefono: string | null
  email: string | null
  certificadoAlias: string | null
  certificadoPath: string | null
  clavePrivadaPath: string | null
  ambiente: 'HOMOLOGACION' | 'PRODUCCION'
  puntoVenta: number
  predeterminado: boolean
}

export function EmisoresManager({ emisores }: { emisores: Emisor[] }) {
  const router = useRouter()
  const puedeCrear = useCan('emisores.create')
  const puedeEditar = useCan('emisores.update')
  const puedeBorrar = useCan('emisores.delete')
  const [modal, setModal] = useState<null | 'nuevo' | Emisor>(null)

  async function eliminar(e: Emisor) {
    if (!confirm(`¿Dar de baja el emisor ${e.razonSocial} (${e.cuit})?`)) return
    const res = await fetch(`/api/emisores/${e.id}`, { method: 'DELETE' })
    if (res.ok) { toast.success('Emisor dado de baja'); router.refresh() }
    else toast.error('No se pudo eliminar')
  }

  return (
    <div className="flex flex-col gap-4 max-w-4xl">
      <div className="flex items-center justify-between">
        <p className="text-[12.5px] text-[#7c828c] flex items-center gap-1.5">
          Cargá uno o más CUIT. El emisor predeterminado se usa por defecto al facturar.
          <AyudaInline label="Ayuda certificados AFIP">
            Subí certificado (.crt) y clave (.key) de AFIP antes de pasar a Producción.
            Punto de venta debe coincidir con el habilitado en AFIP. Checklist: docs/AFIP-PRODUCCION.md en el servidor.
          </AyudaInline>
        </p>
        {puedeCrear && (
          <Button variant="primary" size="sm" onClick={() => setModal('nuevo')}>
            <Plus size={15} /> Nuevo emisor
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        {emisores.map((e) => {
          const prep = estadoPreparacionAfip(e)
          return (
          <Card key={e.id}>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-[9px] bg-[#FFF1E2] flex items-center justify-center flex-shrink-0">
                <Building2 size={18} className="text-[#E8650A]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-[13.5px] font-bold text-[#16181d]">{e.razonSocial}</h3>
                  {e.predeterminado && <Badge className="bg-[#FFF1E2] text-[#C4540A]"><Star size={10} /> Predeterminado</Badge>}
                  <Badge variant={e.ambiente === 'PRODUCCION' ? 'success' : 'gray'}>
                    {e.ambiente === 'PRODUCCION' ? 'Producción' : 'Homologación'}
                  </Badge>
                  {prep === 'produccion_sin_certificados' && (
                    <Badge className="bg-red-100 text-red-800 border border-red-200">No listo: sin certificados</Badge>
                  )}
                  {prep === 'listo_cambiar_a_produccion' && (
                    <Badge className="bg-blue-50 text-blue-800 border border-blue-200">Listo para Producción</Badge>
                  )}
                  {prep === 'listo_produccion' && (
                    <Badge className="bg-green-50 text-green-800 border border-green-200">Listo para facturar</Badge>
                  )}
                </div>
                <p className="text-[12px] text-[#6b7280] mt-1">CUIT {e.cuit} · {e.condicionIva}</p>
                <p className="text-[12px] text-[#9aa1ab]">Pto. venta {e.puntoVenta}{e.ciudad ? ` · ${e.ciudad}` : ''}</p>
                {prep === 'produccion_sin_certificados' && (
                  <p className="text-[11.5px] mt-1.5 text-red-700 font-medium">
                    Emisor en Producción sin certificado AFIP — la emisión fiscal está bloqueada hasta subir .crt y .key.
                  </p>
                )}
                {prep === 'listo_cambiar_a_produccion' && (
                  <p className="text-[11.5px] mt-1.5 text-blue-800 font-medium">
                    Certificados cargados en homologación. Al tener certificados de producción en AFIP, cambiar ambiente a Producción.
                  </p>
                )}
                <p className="text-[11.5px] mt-1">
                  {e.certificadoPath || e.certificadoAlias
                    ? <span className="text-green-700 font-medium">Certificado AFIP cargado</span>
                    : <span className="text-orange-600 font-medium">Sin certificado AFIP cargado</span>}
                </p>
                {puedeEditar && (
                  <CertificadoUpload emisorId={e.id} onUploaded={() => router.refresh()} />
                )}
                <div className="flex items-center gap-2 mt-2.5">
                  {puedeEditar && (
                    <button onClick={() => setModal(e)} className="text-[11.5px] font-semibold text-[#5b626d] hover:text-[#E8650A] inline-flex items-center gap-1">
                      <Pencil size={13} /> Editar
                    </button>
                  )}
                  {puedeBorrar && (
                    <button onClick={() => eliminar(e)} className="text-[11.5px] font-semibold text-[#5b626d] hover:text-red-600 inline-flex items-center gap-1">
                      <Trash2 size={13} /> Baja
                    </button>
                  )}
                </div>
              </div>
            </div>
          </Card>
          )
        })}
        {emisores.length === 0 && (
          <Card className="col-span-2 text-center py-8 text-[12.5px] text-[#9aa1ab]">Sin emisores cargados.</Card>
        )}
      </div>

      {modal && (
        <EmisorModal
          emisor={modal === 'nuevo' ? undefined : modal}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); router.refresh() }}
        />
      )}
    </div>
  )
}

function EmisorModal({ emisor, onClose, onSaved }: { emisor?: Emisor; onClose: () => void; onSaved: () => void }) {
  const esEdicion = Boolean(emisor)
  const [form, setForm] = useState({
    razonSocial: emisor?.razonSocial ?? '',
    cuit: emisor?.cuit ?? '',
    condicionIva: emisor?.condicionIva ?? 'Responsable Inscripto',
    ingresosBrutos: emisor?.ingresosBrutos ?? '',
    domicilio: emisor?.domicilio ?? '',
    ciudad: emisor?.ciudad ?? '',
    telefono: emisor?.telefono ?? '',
    email: emisor?.email ?? '',
    certificadoAlias: emisor?.certificadoAlias ?? '',
    ambiente: emisor?.ambiente ?? 'HOMOLOGACION',
    puntoVenta: emisor?.puntoVenta ?? 1,
    predeterminado: emisor?.predeterminado ?? false,
  })
  const [loading, setLoading] = useState(false)
  const [confirmarProduccion, setConfirmarProduccion] = useState(false)
  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }))

  const pideConfirmProduccion = requiereConfirmacionProduccion(
    form.ambiente,
    emisor?.ambiente,
  )

  async function guardar() {
    if (!form.razonSocial || !form.cuit) { toast.error('Razón social y CUIT son obligatorios'); return }
    if (pideConfirmProduccion && !confirmarProduccion) {
      toast.error('Confirmá certificados cargados y punto de venta verificado antes de activar Producción')
      return
    }
    setLoading(true)
    try {
      const payload = {
        ...form,
        puntoVenta: Number(form.puntoVenta),
        ...(pideConfirmProduccion ? { confirmarProduccion: true } : {}),
      }
      const res = esEdicion
        ? await fetch(`/api/emisores/${emisor!.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        : await fetch('/api/emisores', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(mensajeErrorJson(data, 'No se pudo guardar el emisor'))
      toast.success(esEdicion ? 'Emisor actualizado' : 'Emisor creado')
      onSaved()
    } catch (e: unknown) {
      toast.error(mensajeErrorDesconocido(e, 'No se pudo guardar el emisor'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" data-modal-overlay>
      <div className="bg-white rounded-[14px] w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#eef0f2] sticky top-0 bg-white">
          <h3 className="text-[14px] font-bold text-[#16181d]">{esEdicion ? 'Editar emisor' : 'Nuevo emisor'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div className="p-5 grid grid-cols-2 gap-3.5">
          <div className="col-span-2"><Input label="Razón social" value={form.razonSocial} onChange={(e) => set('razonSocial', e.target.value)} autoComplete="organization" /></div>
          <Input label="CUIT" value={form.cuit} onChange={(e) => set('cuit', e.target.value)} placeholder="20-12345678-9" autoComplete="off" />
          <Select label="Condición IVA" value={form.condicionIva} onChange={(e) => set('condicionIva', e.target.value)} options={[...CONDICION_IVA]} />
          <Input label="Ingresos Brutos" value={form.ingresosBrutos} onChange={(e) => set('ingresosBrutos', e.target.value)} autoComplete="off" />
          <Input label="Punto de venta" type="number" value={form.puntoVenta} onChange={(e) => set('puntoVenta', e.target.value)} autoComplete="off" />
          <div className="col-span-2"><Input label="Domicilio" value={form.domicilio} onChange={(e) => set('domicilio', e.target.value)} autoComplete="street-address" /></div>
          <Input label="Ciudad" value={form.ciudad} onChange={(e) => set('ciudad', e.target.value)} autoComplete="address-level2" />
          <Input label="Teléfono" value={form.telefono} onChange={(e) => set('telefono', e.target.value)} autoComplete="tel" />
          <Input label="Email" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} autoComplete="email" />
          <Input label="Alias certificado AFIP" value={form.certificadoAlias} onChange={(e) => set('certificadoAlias', e.target.value)} autoComplete="off" />
          <Select
            label="Ambiente"
            value={form.ambiente}
            onChange={(e) => {
              set('ambiente', e.target.value)
              if (e.target.value !== 'PRODUCCION') setConfirmarProduccion(false)
            }}
            options={[
              { value: 'HOMOLOGACION', label: 'Homologación' },
              { value: 'PRODUCCION', label: 'Producción' },
            ]}
          />
          <div className="col-span-2 flex items-start gap-2 text-[11.5px] text-[#6b7280] bg-[#F4F6F9] rounded-[8px] px-3 py-2">
            <AyudaInline label="Ayuda ambiente AFIP">
              Homologación: pruebas con CAE simulado. Producción: exige certificados reales; sin ellos la API bloquea la emisión.
            </AyudaInline>
            <span>
              Cambiá a Producción solo tras cargar certificados de AFIP producción y verificar el punto de venta (ver docs/AFIP-PRODUCCION.md).
            </span>
          </div>
          {pideConfirmProduccion && (
            <div className="col-span-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
              <p className="text-[12px] text-amber-900 font-medium mb-2">
                Vas a activar el ambiente de Producción AFIP. Verificá certificados y punto de venta antes de continuar.
              </p>
              <label className="flex items-start gap-2 text-[12.5px] text-[#3a4150]">
                <input
                  type="checkbox"
                  className="accent-[#E8650A] mt-0.5"
                  checked={confirmarProduccion}
                  onChange={(e) => setConfirmarProduccion(e.target.checked)}
                />
                Confirmo certificados cargados y PtoVta verificado
              </label>
            </div>
          )}
          <label className="col-span-2 flex items-center gap-2 text-[12.5px] text-[#3a4150]">
            <input type="checkbox" className="accent-[#E8650A]" checked={form.predeterminado} onChange={(e) => set('predeterminado', e.target.checked)} />
            Usar como emisor predeterminado
          </label>
          <p className="col-span-2 text-[11px] text-[#9aa1ab]">
            Podés cargar certificado (.crt) y clave (.key) desde la tarjeta del emisor una vez creado.
          </p>
          <div className="col-span-2 flex justify-end gap-2 pt-1">
            <Button variant="secondary" onClick={onClose} disabled={loading}>Cancelar</Button>
            <Button
              variant="primary"
              onClick={guardar}
              loading={loading}
              disabled={pideConfirmProduccion && !confirmarProduccion}
            >
              {esEdicion ? 'Guardar' : 'Crear emisor'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

function CertificadoUpload({ emisorId, onUploaded }: { emisorId: string; onUploaded: () => void }) {
  const [loading, setLoading] = useState(false)
  const [certFile, setCertFile] = useState<File | null>(null)
  const [keyFile, setKeyFile] = useState<File | null>(null)

  async function subir() {
    if (!certFile || !keyFile) {
      toast.error('Seleccioná certificado (.crt) y clave (.key)')
      return
    }
    setLoading(true)
    try {
      const fd = new FormData()
      fd.append('certificado', certFile)
      fd.append('clave', keyFile)
      const res = await fetch(`/api/emisores/${emisorId}/certificado`, { method: 'POST', body: fd })
      if (!res.ok) throw new Error(await mensajeErrorRespuesta(res, 'No se pudo cargar el certificado AFIP'))
      toast.success('Certificado cargado')
      setCertFile(null)
      setKeyFile(null)
      onUploaded()
    } catch (e) {
      toast.error(mensajeErrorDesconocido(e, 'No se pudo cargar el certificado AFIP'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <input type="file" accept=".crt,.pem" onChange={(e) => setCertFile(e.target.files?.[0] ?? null)} className="text-[10px] max-w-[120px]" />
      <input type="file" accept=".key" onChange={(e) => setKeyFile(e.target.files?.[0] ?? null)} className="text-[10px] max-w-[100px]" />
      <Button variant="outline" size="sm" onClick={subir} loading={loading} disabled={!certFile || !keyFile}>
        Subir
      </Button>
    </div>
  )
}
