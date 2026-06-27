'use client'

import { useCallback, useEffect, useState } from 'react'
import { signOut } from 'next-auth/react'
import { toast } from 'sonner'
import { LogOut, Shield, Users } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ConfigPageShell } from '@/components/configuracion/ConfigPageShell'
import { ModalOverlay } from '@/components/ui/modal-overlay'
import { useIsSuperAdmin } from '@/components/auth/useCan'
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
  sesionMaxHoras: number
  sesionEpoch: number
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
  const esSuperAdmin = useIsSuperAdmin()
  const [politica, setPolitica] = useState<Politica | null>(null)
  const [usuarios, setUsuarios] = useState<UsuarioRow[]>([])
  const [eventos, setEventos] = useState<EventoLogin[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [modalCerrarSesiones, setModalCerrarSesiones] = useState(false)
  const [confirmacionCerrar, setConfirmacionCerrar] = useState('')
  const [cerrandoSesiones, setCerrandoSesiones] = useState(false)

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

  async function cerrarTodasLasSesiones() {
    if (confirmacionCerrar.trim().toUpperCase() !== 'CERRAR TODAS') {
      toast.error('Escribí CERRAR TODAS para confirmar')
      return
    }
    setCerrandoSesiones(true)
    try {
      const res = await fetch('/api/config/seguridad/invalidar-sesiones', {
        method: 'POST',
        credentials: 'include',
      })
      if (!res.ok) throw new Error(await mensajeErrorRespuesta(res, 'No se pudo cerrar las sesiones'))
      const data = await res.json()
      toast.success(data.mensaje ?? 'Sesiones cerradas')
      setModalCerrarSesiones(false)
      setConfirmacionCerrar('')
      await signOut({ callbackUrl: '/login?sesiones=cerradas' })
    } catch (err) {
      toast.error(mensajeErrorDesconocido(err, 'Error'))
    } finally {
      setCerrandoSesiones(false)
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
            <Input label="Duración de sesión (horas)" type="number" value={politica.sesionMaxHoras}
              onChange={(e) => setPolitica({ ...politica, sesionMaxHoras: Number(e.target.value) })} />
            <p className="text-[11px] text-[#9aa1ab] -mt-1">
              Tras ese tiempo sin usar el sistema, el usuario debe volver a iniciar sesión. Con actividad, la sesión se renueva.
            </p>
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

      {esSuperAdmin && (
        <Card>
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-600">
              <LogOut size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-[13.5px] font-bold text-[#1f242c]">Cerrar sesión a todos los usuarios</h3>
              <p className="mt-1 text-[12px] text-[#7c828c] leading-relaxed">
                Invalida todas las sesiones activas de inmediato. Útil antes de un deploy, cuando alguien quedó
                logueado en un equipo compartido o sospechás accesos abiertos. También cerrará tu sesión actual.
              </p>
              <p className="mt-2 text-[11px] text-[#9aa1ab]">
                Revocación global #{politica.sesionEpoch} · cada usuario deberá volver a ingresar email y contraseña.
              </p>
              <Button
                type="button"
                variant="danger"
                size="sm"
                className="mt-3"
                onClick={() => {
                  setConfirmacionCerrar('')
                  setModalCerrarSesiones(true)
                }}
              >
                <LogOut size={15} /> Cerrar sesión a todos
              </Button>
            </div>
          </div>
        </Card>
      )}

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

      {modalCerrarSesiones && (
        <ModalOverlay zClass="z-[120]">
          <div
            className="w-full max-w-md rounded-xl bg-white shadow-xl border border-[#eef0f2] p-5 flex flex-col gap-4"
            data-modal-panel
            role="dialog"
            aria-labelledby="cerrar-sesiones-title"
          >
            <div>
              <h2 id="cerrar-sesiones-title" className="text-[15px] font-bold text-[#1f242c]">
                ¿Cerrar sesión a todos los usuarios?
              </h2>
              <p className="mt-2 text-[12.5px] text-[#6b7280] leading-relaxed">
                Se desconectarán todas las cuentas del ERP, incluida la tuya. Nadie podrá seguir usando el sistema
                hasta volver a iniciar sesión.
              </p>
            </div>
            <Input
              label='Escribí "CERRAR TODAS" para confirmar'
              value={confirmacionCerrar}
              onChange={(e) => setConfirmacionCerrar(e.target.value)}
              autoComplete="off"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setModalCerrarSesiones(false)
                  setConfirmacionCerrar('')
                }}
                disabled={cerrandoSesiones}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                variant="danger"
                loading={cerrandoSesiones}
                disabled={confirmacionCerrar.trim().toUpperCase() !== 'CERRAR TODAS'}
                onClick={() => void cerrarTodasLasSesiones()}
              >
                Confirmar cierre global
              </Button>
            </div>
          </div>
        </ModalOverlay>
      )}
    </ConfigPageShell>
  )
}
