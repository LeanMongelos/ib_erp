'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { UserPlus, Power, X, Copy, Pencil, KeyRound, Users, Shield, Eye, EyeOff } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useCan } from '@/components/auth/useCan'
import { cn, formatFechaHora } from '@/lib/utils'
import { mensajeErrorDesconocido, mensajeErrorJson, mensajeErrorRespuesta } from '@/lib/errores'
import { validarEmailRequerido } from '@/lib/form-validation'
import { RolesPermisosPanel } from '@/components/configuracion/RolesPermisosPanel'

interface RolOpt { clave: string; nombre: string }
interface Usuario {
  id: string
  nombre: string
  email: string
  telefono: string | null
  activo: boolean
  ultimoAcceso: string | null
  roles: RolOpt[]
}

type Tab = 'usuarios' | 'roles'

export function UsuariosManager({ usuarios, roles }: { usuarios: Usuario[]; roles: RolOpt[] }) {
  const router = useRouter()
  const puedeCrear = useCan('usuarios.create')
  const puedeEditar = useCan('usuarios.update')
  const puedeAsignarRoles = useCan('usuarios.assign_roles')
  const puedeDesactivar = useCan('usuarios.deactivate')

  const [tab, setTab] = useState<Tab>('usuarios')
  const [modal, setModal] = useState<null | 'nuevo' | Usuario>(null)

  async function toggleActivo(u: Usuario) {
    const res = await fetch(`/api/usuarios/${u.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activo: !u.activo }),
    })
    if (res.ok) {
      toast.success(u.activo ? 'Usuario desactivado' : 'Usuario activado')
      router.refresh()
    } else {
      const e = await res.json().catch(() => ({}))
      toast.error(mensajeErrorJson(e, 'No se pudo actualizar el usuario'))
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex gap-1 p-1 bg-[#f4f6f9] rounded-[10px] w-fit">
          <button
            type="button"
            onClick={() => setTab('usuarios')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-[12.5px] font-semibold transition-colors',
              tab === 'usuarios' ? 'bg-white text-[#E8650A] shadow-sm' : 'text-[#5b626d] hover:text-[#1f242c]',
            )}
          >
            <Users size={14} /> Usuarios
          </button>
          <button
            type="button"
            onClick={() => setTab('roles')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-[12.5px] font-semibold transition-colors',
              tab === 'roles' ? 'bg-white text-[#E8650A] shadow-sm' : 'text-[#5b626d] hover:text-[#1f242c]',
            )}
          >
            <Shield size={14} /> Roles y permisos
          </button>
        </div>

        {tab === 'usuarios' && puedeCrear && (
          <Button variant="primary" size="sm" onClick={() => setModal('nuevo')}>
            <UserPlus size={15} /> Nuevo usuario
          </Button>
        )}
      </div>

      {tab === 'roles' ? (
        <RolesPermisosPanel />
      ) : (
        <>
          <p className="text-[12.5px] text-[#7c828c]">Gestioná el equipo, sus roles y accesos.</p>

          <Card padding={false}>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    {['Usuario', 'Roles', 'Último acceso', 'Estado', ''].map((h, i) => (
                      <th key={i} className={`px-5 py-3 text-[10.5px] font-bold text-[#8a909a] tracking-[0.6px] uppercase border-b border-[#eef0f2] ${i === 4 ? 'text-right' : 'text-left'}`}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {usuarios.map((u, i) => (
                    <tr
                      key={u.id}
                      className={cn(
                        i % 2 === 0 ? 'bg-white' : 'bg-[#fafbfc]',
                        puedeEditar && 'cursor-pointer hover:bg-[#FFF8F3]',
                      )}
                      onClick={() => puedeEditar && setModal(u)}
                    >
                      <td className="px-5 py-3 border-b border-[#f4f5f7]">
                        <p className="text-[12.5px] font-bold text-[#1f242c]">{u.nombre}</p>
                        <p className="text-[11.5px] text-[#9aa1ab]">{u.email}{u.telefono ? ` · ${u.telefono}` : ''}</p>
                      </td>
                      <td className="px-5 py-3 border-b border-[#f4f5f7]">
                        <div className="flex flex-wrap gap-1">
                          {u.roles.length ? u.roles.map((r) => (
                            <Badge key={r.clave} className="bg-orange-50 text-orange-700">{r.nombre}</Badge>
                          )) : <span className="text-[11.5px] text-[#9aa1ab]">—</span>}
                        </div>
                      </td>
                      <td className="px-5 py-3 border-b border-[#f4f5f7] text-[12px] text-[#6b7280]">
                        {u.ultimoAcceso ? formatFechaHora(u.ultimoAcceso) : 'Nunca'}
                      </td>
                      <td className="px-5 py-3 border-b border-[#f4f5f7]">
                        <Badge variant={u.activo ? 'success' : 'gray'}>{u.activo ? 'Activo' : 'Inactivo'}</Badge>
                      </td>
                      <td className="px-5 py-3 border-b border-[#f4f5f7] text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          {puedeEditar && (
                            <button
                              onClick={() => setModal(u)}
                              className="p-1.5 rounded-[6px] text-[#5b626d] hover:text-[#E8650A] hover:bg-[#FFF1E2]"
                              title="Editar usuario"
                            >
                              <Pencil size={15} />
                            </button>
                          )}
                          {puedeDesactivar && (
                            <button
                              onClick={() => toggleActivo(u)}
                              className="p-1.5 rounded-[6px] text-[#5b626d] hover:text-red-600 hover:bg-red-50"
                              title={u.activo ? 'Desactivar' : 'Activar'}
                            >
                              <Power size={15} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {modal === 'nuevo' && (
        <UsuarioModal
          roles={roles}
          puedeAsignarRoles={puedeAsignarRoles}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); router.refresh() }}
        />
      )}
      {modal && modal !== 'nuevo' && (
        <UsuarioModal
          roles={roles}
          usuario={modal}
          puedeAsignarRoles={puedeAsignarRoles}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); router.refresh() }}
        />
      )}
    </div>
  )
}

function UsuarioModal({
  roles, usuario, puedeAsignarRoles, onClose, onSaved,
}: {
  roles: RolOpt[]
  usuario?: Usuario
  puedeAsignarRoles: boolean
  onClose: () => void
  onSaved: () => void
}) {
  const esEdicion = Boolean(usuario)
  const [nombre, setNombre] = useState(usuario?.nombre ?? '')
  const [email, setEmail] = useState(usuario?.email ?? '')
  const [telefono, setTelefono] = useState(usuario?.telefono ?? '')
  const [seleccion, setSeleccion] = useState<string[]>(usuario?.roles.map((r) => r.clave) ?? [])
  const [loading, setLoading] = useState(false)
  const [resettingPass, setResettingPass] = useState(false)
  const [tempPass, setTempPass] = useState<string | null>(null)
  const [nuevaPassword, setNuevaPassword] = useState('')
  const [confirmarPassword, setConfirmarPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [exigirCambio, setExigirCambio] = useState(false)

  const hayPasswordManual = nuevaPassword.length > 0 || confirmarPassword.length > 0

  function toggleRol(clave: string) {
    if (!puedeAsignarRoles) return
    setSeleccion((s) => (s.includes(clave) ? s.filter((c) => c !== clave) : [...s, clave]))
  }

  async function restablecerPassword() {
    if (!usuario) return
    setResettingPass(true)
    try {
      const res = await fetch(`/api/usuarios/${usuario.id}/reset-password`, { method: 'POST' })
      if (!res.ok) throw new Error(await mensajeErrorRespuesta(res, 'No se pudo restablecer la contraseña'))
      const data = (await res.json()) as { passwordTemporal: string }
      setTempPass(data.passwordTemporal)
      toast.success('Contraseña temporal generada')
    } catch (e) {
      toast.error(mensajeErrorDesconocido(e, 'No se pudo restablecer la contraseña'))
    } finally {
      setResettingPass(false)
    }
  }

  async function guardar() {
    if (!esEdicion && (!nombre || !email)) { toast.error('Completá nombre y email'); return }
    if (!esEdicion) {
      const errEmail = validarEmailRequerido(email)
      if (errEmail) { toast.error(errEmail); return }
    }
    if (puedeAsignarRoles && seleccion.length === 0) { toast.error('Asigná al menos un rol'); return }
    if (hayPasswordManual) {
      if (!nuevaPassword) { toast.error('Ingresá la nueva contraseña'); return }
      if (nuevaPassword !== confirmarPassword) { toast.error('Las contraseñas no coinciden'); return }
    }
    setLoading(true)
    try {
      const passwordPayload = hayPasswordManual
        ? { password: nuevaPassword, confirmarPassword, exigirCambioPassword: exigirCambio }
        : {}

      const bodyEdicion: Record<string, unknown> = { nombre, telefono: telefono || null, ...passwordPayload }
      if (puedeAsignarRoles) bodyEdicion.roles = seleccion

      const bodyAlta: Record<string, unknown> = {
        nombre,
        email,
        telefono: telefono || undefined,
        roles: seleccion,
        ...passwordPayload,
      }

      const res = esEdicion
        ? await fetch(`/api/usuarios/${usuario!.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(bodyEdicion),
          })
        : await fetch('/api/usuarios', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(bodyAlta),
          })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(mensajeErrorJson(data, 'No se pudo guardar el usuario'))

      if (!esEdicion && data.passwordTemporal) {
        setTempPass(data.passwordTemporal)
        toast.success('Usuario creado')
      } else {
        toast.success(esEdicion ? 'Usuario actualizado' : 'Usuario creado')
        onSaved()
      }
    } catch (e: unknown) {
      toast.error(mensajeErrorDesconocido(e, 'No se pudo guardar el usuario'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-[14px] w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#eef0f2] sticky top-0 bg-white z-10">
          <h3 className="text-[14px] font-bold text-[#16181d]">{esEdicion ? 'Editar usuario' : 'Nuevo usuario'}</h3>
          <button onClick={() => { setTempPass(null); onClose() }} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        {tempPass ? (
          <div className="p-5 flex flex-col gap-3">
            <p className="text-[13px] text-[#3a4150]">
              {esEdicion ? 'Contraseña temporal generada.' : 'Usuario creado.'} Compartila con la persona (se muestra una sola vez):
            </p>
            <div className="flex items-center gap-2 bg-[#f4f6f9] border border-[#e4e7eb] rounded-[9px] px-3 py-2.5" data-allow-context>
              <code className="flex-1 text-[14px] font-mono font-bold text-[#16181d]">{tempPass}</code>
              <button onClick={() => { navigator.clipboard.writeText(tempPass); toast.success('Copiada') }} className="text-[#5b626d] hover:text-[#E8650A]">
                <Copy size={15} />
              </button>
            </div>
            <Button variant="primary" onClick={() => { setTempPass(null); onSaved() }}>Listo</Button>
          </div>
        ) : (
          <div className="p-5 flex flex-col gap-3.5">
            <Input label="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre y apellido" autoComplete="name" />
            <Input label="Email" type="email" value={email} disabled={esEdicion} onChange={(e) => setEmail(e.target.value)} placeholder="usuario@ib.com" autoComplete="email" />
            <Input label="Teléfono" value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="Opcional" autoComplete="tel" />

            <div>
              <label className="text-[11.5px] font-semibold text-[#5b626d] tracking-wide uppercase">Roles</label>
              {!puedeAsignarRoles && esEdicion && (
                <p className="text-[11px] text-[#9aa1ab] mt-0.5">No tenés permiso para cambiar roles.</p>
              )}
              <div className="grid grid-cols-2 gap-2 mt-1.5">
                {roles.map((r) => (
                  <label
                    key={r.clave}
                    className={`flex items-center gap-2 px-3 py-2 rounded-[8px] border text-[12.5px] ${
                      seleccion.includes(r.clave) ? 'border-[#E8650A] bg-[#FFF1E2] text-[#C4540A] font-semibold' : 'border-[#e4e7eb] text-[#3a4150]'
                    } ${!puedeAsignarRoles ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    <input
                      type="checkbox"
                      className="accent-[#E8650A]"
                      checked={seleccion.includes(r.clave)}
                      disabled={!puedeAsignarRoles}
                      onChange={() => toggleRol(r.clave)}
                    />
                    {r.nombre}
                  </label>
                ))}
              </div>
            </div>

            <div className="pt-2 border-t border-[#eef0f2]">
              <p className="text-[11.5px] font-semibold text-[#5b626d] tracking-wide uppercase mb-1">Contraseña</p>
              {!esEdicion && (
                <p className="text-[11.5px] text-[#9aa1ab] mb-2">
                  Asigná una contraseña permanente o dejá vacío para generar una temporal automáticamente.
                </p>
              )}
              {esEdicion && (
                <p className="text-[11.5px] text-[#9aa1ab] mb-2">
                  Dejá los campos vacíos si no querés cambiar la contraseña actual.
                </p>
              )}

              <div className="flex flex-col gap-3">
                <div className="relative">
                  <Input
                    label="Nueva contraseña"
                    type={showPassword ? 'text' : 'password'}
                    value={nuevaPassword}
                    onChange={(e) => setNuevaPassword(e.target.value)}
                    placeholder={esEdicion ? 'Opcional' : 'Opcional — permanente'}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-[34px] text-[#9aa1ab] hover:text-[#5b626d]"
                    tabIndex={-1}
                    aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <Input
                  label="Confirmar contraseña"
                  type={showPassword ? 'text' : 'password'}
                  value={confirmarPassword}
                  onChange={(e) => setConfirmarPassword(e.target.value)}
                  placeholder="Repetir la contraseña"
                  autoComplete="new-password"
                />

                {hayPasswordManual && (
                  <label className="flex items-start gap-2 text-[12.5px] text-[#3a4150] cursor-pointer">
                    <input
                      type="checkbox"
                      className="accent-[#E8650A] mt-0.5"
                      checked={exigirCambio}
                      onChange={(e) => setExigirCambio(e.target.checked)}
                    />
                    <span>
                      Exigir cambio en primer acceso
                      <span className="block text-[11px] text-[#9aa1ab] font-normal mt-0.5">
                        Si no marcás esta opción, el usuario podrá usar la contraseña asignada de forma permanente.
                      </span>
                    </span>
                  </label>
                )}

                {esEdicion && (
                  <>
                    <div className="flex items-center gap-3 text-[11px] text-[#9aa1ab] uppercase tracking-wide">
                      <span className="flex-1 h-px bg-[#eef0f2]" />
                      o
                      <span className="flex-1 h-px bg-[#eef0f2]" />
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      loading={resettingPass}
                      onClick={restablecerPassword}
                    >
                      <KeyRound size={14} className="mr-1.5" />
                      Generar contraseña temporal
                    </Button>
                    <p className="text-[11px] text-[#9aa1ab] -mt-1">
                      Genera una clave aleatoria y exige cambio en el primer acceso.
                    </p>
                  </>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="secondary" onClick={onClose} disabled={loading}>Cancelar</Button>
              <Button variant="primary" onClick={guardar} loading={loading}>{esEdicion ? 'Guardar cambios' : 'Crear usuario'}</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
