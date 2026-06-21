'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { useCan } from '@/components/auth/useCan'
import { PERMISSIONS } from '@/lib/rbac'
import { mensajeErrorDesconocido, mensajeErrorRespuesta } from '@/lib/errores'

interface RolDetalle {
  clave: string
  nombre: string
  permisos: string[]
  usuariosCount: number
}

export function RolesPermisosPanel() {
  const esSuperAdmin = useCan('*')
  const [roles, setRoles] = useState<RolDetalle[]>([])
  const [rolClave, setRolClave] = useState('')
  const [seleccion, setSeleccion] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/roles?detalle=1', { credentials: 'include' })
      if (!res.ok) throw new Error(await mensajeErrorRespuesta(res, 'No se pudieron cargar los roles'))
      const data = (await res.json()) as RolDetalle[]
      const editables = data.filter((r) => r.clave !== 'SUPERADMIN')
      setRoles(editables)
      setRolClave((prev) => prev || editables[0]?.clave || '')
    } catch (e) {
      toast.error(mensajeErrorDesconocido(e, 'Error al cargar roles'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  useEffect(() => {
    const rol = roles.find((r) => r.clave === rolClave)
    if (rol) setSeleccion(rol.permisos)
  }, [rolClave, roles])

  const porModulo = useMemo(() => {
    const map = new Map<string, typeof PERMISSIONS>()
    for (const p of PERMISSIONS) {
      const list = map.get(p.modulo) ?? []
      list.push(p)
      map.set(p.modulo, list)
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [])

  function togglePermiso(clave: string) {
    setSeleccion((s) => (s.includes(clave) ? s.filter((c) => c !== clave) : [...s, clave]))
  }

  async function guardar() {
    if (!rolClave) return
    if (seleccion.length === 0) {
      toast.error('El rol debe tener al menos un permiso')
      return
    }
    setSaving(true)
    try {
      const res = await fetch(`/api/roles/${encodeURIComponent(rolClave)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permisos: seleccion }),
      })
      if (!res.ok) throw new Error(await mensajeErrorRespuesta(res, 'No se pudieron guardar los permisos'))
      toast.success('Permisos del rol actualizados')
      await cargar()
    } catch (e) {
      toast.error(mensajeErrorDesconocido(e, 'No se pudieron guardar los permisos'))
    } finally {
      setSaving(false)
    }
  }

  const rolActual = roles.find((r) => r.clave === rolClave)

  if (loading) {
    return <p className="text-[12.5px] text-[#9aa1ab] py-8 text-center">Cargando roles…</p>
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[12.5px] text-[#7c828c]">
        Definí qué puede hacer cada rol. Los cambios aplican cuando el usuario vuelve a iniciar sesión.
      </p>

      {!esSuperAdmin && (
        <div className="bg-[#FFF7ED] border border-[#FDBA74] rounded-[10px] px-4 py-3 text-[12.5px] text-[#9A3412]">
          Solo el administrador del sistema puede modificar permisos de roles. Podés consultar la matriz en modo lectura.
        </div>
      )}

      <Card>
        <div className="flex flex-col sm:flex-row sm:items-end gap-3 mb-4">
          <Select
            label="Rol"
            value={rolClave}
            onChange={(e) => setRolClave(e.target.value)}
            options={roles.map((r) => ({
              value: r.clave,
              label: `${r.nombre} (${r.usuariosCount} usuario${r.usuariosCount === 1 ? '' : 's'})`,
            }))}
            className="sm:min-w-[280px]"
          />
          {rolActual && (
            <p className="text-[11.5px] text-[#9aa1ab] pb-1">
              {seleccion.length} permiso{seleccion.length === 1 ? '' : 's'} activos
            </p>
          )}
        </div>

        <div className="flex flex-col gap-4 max-h-[55vh] overflow-y-auto pr-1">
          {porModulo.map(([modulo, permisos]) => (
            <div key={modulo}>
              <p className="text-[10.5px] font-bold text-[#8a909a] uppercase tracking-wider mb-2">{modulo}</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                {permisos.map((p) => (
                  <label
                    key={p.clave}
                    className={`flex items-start gap-2 px-3 py-2 rounded-[8px] border text-[12px] ${
                      seleccion.includes(p.clave)
                        ? 'border-[#E8650A] bg-[#FFF1E2]'
                        : 'border-[#e4e7eb] bg-white'
                    } ${!esSuperAdmin ? 'opacity-80 cursor-default' : 'cursor-pointer'}`}
                  >
                    <input
                      type="checkbox"
                      className="accent-[#E8650A] mt-0.5"
                      checked={seleccion.includes(p.clave)}
                      disabled={!esSuperAdmin}
                      onChange={() => togglePermiso(p.clave)}
                    />
                    <span>
                      <span className="font-semibold text-[#1f242c] block">{p.descripcion}</span>
                      <span className="text-[10.5px] text-[#9aa1ab] font-mono">{p.clave}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>

        {esSuperAdmin && (
          <div className="flex justify-end mt-4 pt-4 border-t border-[#eef0f2]">
            <Button variant="primary" onClick={guardar} loading={saving} disabled={!rolClave}>
              Guardar permisos del rol
            </Button>
          </div>
        )}
      </Card>
    </div>
  )
}
