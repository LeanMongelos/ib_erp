'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Camera, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { UserAvatar } from '@/components/perfil/UserAvatar'
import { mensajeErrorDesconocido, mensajeErrorJson, mensajeErrorRespuesta } from '@/lib/errores'

interface Me {
  id: string
  nombre: string
  email: string
  telefono: string | null
  avatarUrl: string | null
  roles: string[]
}

export function PerfilForm({ me }: { me: Me }) {
  const router = useRouter()
  const { update } = useSession()

  const [nombre, setNombre] = useState(me.nombre)
  const [telefono, setTelefono] = useState(me.telefono ?? '')
  const [avatarUrl, setAvatarUrl] = useState(me.avatarUrl)
  const [savingPerfil, setSavingPerfil] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const [actual, setActual] = useState('')
  const [nueva, setNueva] = useState('')
  const [repetir, setRepetir] = useState('')
  const [savingPass, setSavingPass] = useState(false)

  async function syncSession(partial: { name?: string; avatarUrl?: string | null }) {
    await update?.({
      name: partial.name,
      avatarUrl: partial.avatarUrl ?? undefined,
    })
    router.refresh()
  }

  async function subirAvatar(file: File) {
    setUploadingAvatar(true)
    try {
      const fd = new FormData()
      fd.append('archivo', file)
      const res = await fetch('/api/perfil/avatar', { method: 'POST', body: fd })
      if (!res.ok) throw new Error(await mensajeErrorRespuesta(res, 'No se pudo subir la foto'))
      const data = (await res.json()) as { avatarUrl: string }
      setAvatarUrl(data.avatarUrl)
      await syncSession({ name: nombre, avatarUrl: data.avatarUrl })
      toast.success('Foto de perfil actualizada')
    } catch (e: unknown) {
      toast.error(mensajeErrorDesconocido(e, 'No se pudo subir la foto'))
    } finally {
      setUploadingAvatar(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function quitarAvatar() {
    setUploadingAvatar(true)
    try {
      const res = await fetch('/api/perfil/avatar', { method: 'DELETE' })
      if (!res.ok) throw new Error(await mensajeErrorRespuesta(res, 'No se pudo quitar la foto'))
      setAvatarUrl(null)
      await syncSession({ name: nombre, avatarUrl: null })
      toast.success('Foto de perfil eliminada')
    } catch (e: unknown) {
      toast.error(mensajeErrorDesconocido(e, 'No se pudo quitar la foto'))
    } finally {
      setUploadingAvatar(false)
    }
  }

  async function guardarPerfil() {
    if (nombre.trim().length < 2) { toast.error('El nombre es muy corto'); return }
    setSavingPerfil(true)
    try {
      const res = await fetch('/api/perfil', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre, telefono: telefono || null }),
      })
      if (!res.ok) throw new Error(mensajeErrorJson(await res.json().catch(() => ({})), 'No se pudo guardar el perfil'))
      toast.success('Perfil actualizado')
      await syncSession({ name: nombre, avatarUrl })
    } catch (e: unknown) {
      toast.error(mensajeErrorDesconocido(e, 'No se pudo guardar el perfil'))
    } finally {
      setSavingPerfil(false)
    }
  }

  async function cambiarPassword() {
    if (nueva.length < 8) { toast.error('La nueva contraseña debe tener al menos 8 caracteres'); return }
    if (nueva !== repetir) { toast.error('Las contraseñas no coinciden'); return }
    setSavingPass(true)
    try {
      const res = await fetch('/api/perfil/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actual, nueva }),
      })
      if (!res.ok) throw new Error(mensajeErrorJson(await res.json().catch(() => ({})), 'No se pudo cambiar la contraseña'))
      toast.success('Contraseña actualizada')
      setActual(''); setNueva(''); setRepetir('')
    } catch (e: unknown) {
      toast.error(mensajeErrorDesconocido(e, 'No se pudo cambiar la contraseña'))
    } finally {
      setSavingPass(false)
    }
  }

  return (
    <div className="max-w-2xl flex flex-col gap-4">
      <Card>
        <h3 className="text-[13.5px] font-bold text-[#16181d] mb-1">Datos personales</h3>
        <p className="text-[12px] text-[#7c828c] mb-4">
          {me.email} · {me.roles.length ? me.roles.map((r) => <Badge key={r} className="bg-orange-50 text-orange-700 ml-1">{r}</Badge>) : 'Sin roles'}
        </p>

        <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-5 pb-5 border-b border-[#f0f1f4]">
          <UserAvatar name={nombre} avatarUrl={avatarUrl} size={72} />
          <div className="flex flex-col gap-2">
            <p className="text-[12px] text-[#6b7280]">Foto de perfil · JPG, PNG o WEBP · máx. 2 MB</p>
            <div className="flex flex-wrap gap-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) void subirAvatar(file)
                }}
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                loading={uploadingAvatar}
                onClick={() => fileRef.current?.click()}
              >
                <Camera size={14} className="mr-1.5" />
                Subir foto
              </Button>
              {avatarUrl && (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={uploadingAvatar}
                  onClick={() => void quitarAvatar()}
                >
                  <Trash2 size={14} className="mr-1.5" />
                  Quitar
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3.5">
          <div className="col-span-2"><Input label="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} autoComplete="name" /></div>
          <Input label="Email" value={me.email} disabled autoComplete="email" />
          <Input label="Teléfono" value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="Opcional" autoComplete="tel" />
        </div>
        <div className="flex justify-end mt-4">
          <Button variant="primary" onClick={guardarPerfil} loading={savingPerfil}>Guardar cambios</Button>
        </div>
      </Card>

      <Card>
        <h3 className="text-[13.5px] font-bold text-[#16181d] mb-4">Cambiar contraseña</h3>
        <div className="grid grid-cols-2 gap-3.5">
          <div className="col-span-2"><Input label="Contraseña actual" type="password" value={actual} onChange={(e) => setActual(e.target.value)} autoComplete="current-password" /></div>
          <Input label="Nueva contraseña" type="password" value={nueva} onChange={(e) => setNueva(e.target.value)} autoComplete="new-password" />
          <Input label="Repetir nueva" type="password" value={repetir} onChange={(e) => setRepetir(e.target.value)} autoComplete="new-password" />
        </div>
        <div className="flex justify-end mt-4">
          <Button variant="primary" onClick={cambiarPassword} loading={savingPass}>Actualizar contraseña</Button>
        </div>
      </Card>
    </div>
  )
}
