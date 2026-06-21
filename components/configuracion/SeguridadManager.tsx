'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Shield, Users } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ConfigPageShell } from '@/components/configuracion/ConfigPageShell'
import { etiquetaAccion } from '@/lib/config/config-labels'
import { formatFechaHora } from '@/lib/utils'
import { mensajeErrorDesconocido, mensajeErrorRespuesta } from '@/lib/errores'

interface Politica {
  longitudMinPassword: number
  requiereMayuscula: boolean
  requiereNumero: boolean
  requiereEspecial: boolean
  expiracionDias: number | null
  maxIntentosLogin: number
  bloqueoMinutos: number
  maxIntentosIpHora: number
  sesionMaxDias: number
  totpHabilitado: boolean
}

interface UsuarioRow {
  id: string
  nombre: string
  email: string
  activo: boolean
  ultimoAcceso: string | null
}

interface EventoLogin {
  id: string
  accion: string
  ip: string | null
  fecha: string
  despues: unknown
}

export function SeguridadManager() {
  const [politica, setPolitica] = useState<Politica | null>(null)
  const [usuarios, setUsuarios] = useState<UsuarioRow[]>([])
  const [eventos, setEventos] = useState<EventoLogin[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/config/seguridad', { credentials: 'include' })
      if (!res.ok) throw new Error(await mensajeErrorRespuesta(res, 'Error al cargar'))
      const data = await res.json()
      setPolitica(data.politica)
      setUsuarios(data.usuarios ?? [])
      setEventos(data.eventosLogin ?? [])
    } catch (e) {
      toast.error(mensajeErrorDesconocido(e, 'Error'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  async function guardarPolitica(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!politica) return
    setSaving(true)
    try {
      const res = await fetch('/api/config/seguridad', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(politica),
      })
      if (!res.ok) throw new Error(await mensajeErrorRespuesta(res, 'No se pudo guardar'))
      toast.success('Política de seguridad actualizada')
      cargar()
    } catch (err) {
      toast.error(mensajeErrorDesconocido(err, 'Error'))
    } finally {
      setSaving(false)
    }
  }

  if (loading || !politica) {
    return <ConfigPageShell><p className="text-[12.5px] text-[#9aa1ab]">Cargando…</p></ConfigPageShell>
  }

  return (
    <ConfigPageShell>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <Shield size={18} className="text-[#E8650A]" />
            <h3 className="text-[13.5px] font-bold">Política de contraseñas y acceso</h3>
          </div>
          <form onSubmit={guardarPolitica} className="flex flex-col gap-3">
            <Input label="Longitud mínima" type="number" value={politica.longitudMinPassword}
              onChange={(e) => setPolitica({ ...politica, longitudMinPassword: Number(e.target.value) })} />
            <label className="flex items-center gap-2 text-[12.5px]">
              <input type="checkbox" checked={politica.requiereMayuscula} onChange={(e) => setPolitica({ ...politica, requiereMayuscula: e.target.checked })} />
              Requerir mayúscula
            </label>
            <label className="flex items-center gap-2 text-[12.5px]">
              <input type="checkbox" checked={politica.requiereNumero} onChange={(e) => setPolitica({ ...politica, requiereNumero: e.target.checked })} />
              Requerir número
            </label>
            <label className="flex items-center gap-2 text-[12.5px]">
              <input type="checkbox" checked={politica.requiereEspecial} onChange={(e) => setPolitica({ ...politica, requiereEspecial: e.target.checked })} />
              Requerir carácter especial
            </label>
            <Input label="Expiración (días, vacío = sin expiración)" type="number"
              value={politica.expiracionDias ?? ''}
              onChange={(e) => setPolitica({ ...politica, expiracionDias: e.target.value ? Number(e.target.value) : null })} />
            <hr className="border-[#eef0f2]" />
            <Input label="Máx. intentos fallidos de login" type="number" value={politica.maxIntentosLogin}
              onChange={(e) => setPolitica({ ...politica, maxIntentosLogin: Number(e.target.value) })} />
            <Input label="Minutos de bloqueo" type="number" value={politica.bloqueoMinutos}
              onChange={(e) => setPolitica({ ...politica, bloqueoMinutos: Number(e.target.value) })} />
            <Input label="Máx. intentos por IP / hora" type="number" value={politica.maxIntentosIpHora}
              onChange={(e) => setPolitica({ ...politica, maxIntentosIpHora: Number(e.target.value) })} />
            <Input label="Duración de sesión (días)" type="number" value={politica.sesionMaxDias}
              onChange={(e) => setPolitica({ ...politica, sesionMaxDias: Number(e.target.value) })} />
            <label className="flex items-center gap-2 text-[12.5px] opacity-60">
              <input type="checkbox" checked={politica.totpHabilitado} disabled onChange={(e) => setPolitica({ ...politica, totpHabilitado: e.target.checked })} />
              Autenticación 2FA (próximamente)
            </label>
            <Button type="submit" variant="primary" loading={saving} className="self-start">Guardar política</Button>
          </form>
        </Card>

        <Card padding={false}>
          <div className="px-5 py-3 border-b flex items-center gap-2">
            <Users size={16} className="text-[#E8650A]" />
            <h3 className="text-[13px] font-bold">Accesos recientes</h3>
          </div>
          <table className="w-full text-[12px]">
            <thead>
              <tr className="text-[10px] uppercase text-[#8a909a]">
                <th className="text-left px-5 py-2">Usuario</th>
                <th className="text-left px-5 py-2">Último acceso</th>
                <th className="text-left px-5 py-2">Estado</th>
              </tr>
            </thead>
            <tbody>
              {usuarios.slice(0, 12).map((u) => (
                <tr key={u.id} className="border-t border-[#f4f5f7]">
                  <td className="px-5 py-2.5">
                    <p className="font-semibold">{u.nombre}</p>
                    <p className="text-[11px] text-[#9aa1ab]">{u.email}</p>
                  </td>
                  <td className="px-5 py-2.5 text-[#6b7280]">{u.ultimoAcceso ? formatFechaHora(u.ultimoAcceso) : 'Nunca'}</td>
                  <td className="px-5 py-2.5">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${u.activo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {u.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>

      <Card padding={false}>
        <div className="px-5 py-3 border-b">
          <h3 className="text-[13px] font-bold">Eventos de autenticación</h3>
        </div>
        <table className="w-full text-[12px]">
          <thead>
            <tr className="text-[10px] uppercase text-[#8a909a]">
              <th className="text-left px-5 py-2">Evento</th>
              <th className="text-left px-5 py-2">IP</th>
              <th className="text-left px-5 py-2">Fecha</th>
            </tr>
          </thead>
          <tbody>
            {eventos.map((ev) => (
              <tr key={ev.id} className="border-t border-[#f4f5f7]">
                <td className={`px-5 py-2.5 font-semibold ${ev.accion.includes('rate') ? 'text-red-600' : ''}`}>
                  {etiquetaAccion(ev.accion)}
                </td>
                <td className="px-5 py-2.5 font-mono text-[11px]">{ev.ip ?? '—'}</td>
                <td className="px-5 py-2.5">{formatFechaHora(ev.fecha)}</td>
              </tr>
            ))}
            {eventos.length === 0 && (
              <tr><td colSpan={3} className="px-5 py-8 text-center text-[#9aa1ab]">Sin eventos registrados aún</td></tr>
            )}
          </tbody>
        </table>
      </Card>
    </ConfigPageShell>
  )
}
