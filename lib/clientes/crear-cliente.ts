/**
 * Alta de cliente con sucursales de instalación (geocodificación incluida).
 */
import type { Cliente, Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { geocodificarCliente } from '@/lib/clientes/geocodificar-cliente'
import { geocodificarSucursalPorId } from '@/lib/equipos/resolver-ubicacion-equipo'
import { geocodificarSucursal } from '@/lib/geocoding'
import type { z } from 'zod'
import type { clienteCreateSchema, sucursalClienteSchema } from '@/lib/validation'

type ClienteCreate = z.infer<typeof clienteCreateSchema>
type SucursalInput = z.infer<typeof sucursalClienteSchema>

function normalizarSucursales(
  sucursales: SucursalInput[] | undefined,
  fiscal: Pick<ClienteCreate, 'direccion' | 'ciudad'>,
): SucursalInput[] {
  const limpias = (sucursales ?? [])
    .map((s) => ({
      nombre: s.nombre.trim(),
      direccion: s.direccion?.trim() || null,
      numero: s.numero?.trim() || null,
      ciudad: s.ciudad?.trim() || null,
      lat: s.lat ?? null,
      lng: s.lng ?? null,
      notas: s.notas?.trim() || null,
    }))
    .filter((s) => s.nombre.length >= 2)

  if (limpias.length > 0) return limpias

  if (fiscal.direccion?.trim() || fiscal.ciudad?.trim()) {
    return [{
      nombre: 'Sede principal',
      direccion: fiscal.direccion?.trim() || null,
      numero: null,
      ciudad: fiscal.ciudad?.trim() || null,
      lat: null,
      lng: null,
      notas: null,
    }]
  }

  return []
}

/** Geocodifica sucursales sin lat/lng (p. ej. fallback «Sede principal» desde domicilio fiscal). */
async function geocodificarSucursalesSinCoords(sucursales: SucursalInput[]): Promise<SucursalInput[]> {
  return Promise.all(
    sucursales.map(async (s) => {
      if (s.lat != null && s.lng != null) return s
      const geo = await geocodificarSucursal(s.direccion, s.numero, s.ciudad).catch(() => null)
      if (!geo) return s
      return { ...s, lat: geo.lat, lng: geo.lng }
    }),
  )
}

export async function crearClienteConSucursales(
  data: ClienteCreate,
): Promise<Cliente & { sucursales: Array<{ id: string; nombre: string }> }> {
  const { sucursales: sucursalesInput, ...clienteData } = data
  const sucursales = await geocodificarSucursalesSinCoords(
    normalizarSucursales(sucursalesInput, clienteData),
  )

  if (sucursales.length === 0) {
    throw new Error('Debe cargar al menos una sucursal o sede de instalación')
  }

  const clientePayload: Prisma.ClienteCreateInput = {
    ...clienteData,
    email: clienteData.email || null,
  }

  const resultado = await prisma.$transaction(async (tx) => {
    const cliente = await tx.cliente.create({ data: clientePayload })
    const creadas = await Promise.all(
      sucursales.map((s) =>
        tx.clienteSucursal.create({
          data: {
            clienteId: cliente.id,
            nombre: s.nombre,
            direccion: s.direccion,
            numero: s.numero,
            ciudad: s.ciudad,
            lat: s.lat,
            lng: s.lng,
            notas: s.notas,
          },
          select: { id: true, nombre: true },
        }),
      ),
    )
    return { cliente, sucursales: creadas }
  })

  if (resultado.cliente.direccion || resultado.cliente.ciudad) {
    await geocodificarCliente(resultado.cliente, { force: true }).catch(() => null)
  }

  await Promise.all(
    resultado.sucursales.map(async (s) => {
      const input = sucursales.find((x) => x.nombre === s.nombre)
      if (input?.lat != null && input.lng != null) return
      await geocodificarSucursalPorId(s.id, { force: true }).catch(() => null)
    }),
  )

  const clienteActualizado = await prisma.cliente.findUniqueOrThrow({ where: { id: resultado.cliente.id } })
  return { ...clienteActualizado, sucursales: resultado.sucursales }
}

export function sucursalVacia(): SucursalInput {
  return { nombre: '', direccion: '', numero: '', ciudad: 'Formosa', lat: null, lng: null, notas: null }
}

export type { SucursalInput }
