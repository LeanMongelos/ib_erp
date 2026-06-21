/**
 * Backfill geocodificación: clientes, sucursales y equipos existentes.
 * Uso: node scripts/backfill-geocoding.mjs
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DELAY_MS = 1100
const USER_AGENT = 'IBiomedica-ERP/1.0 (contacto@ibiomedica.com)'

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function geocodificar(direccion, ciudad = 'Formosa') {
  const parts = [direccion?.trim(), ciudad?.trim(), 'Argentina'].filter(Boolean)
  if (!parts.length) return null
  const q = encodeURIComponent(parts.join(', '))
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1&countrycodes=ar`,
    { headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'es' } },
  )
  if (!res.ok) return null
  const data = await res.json()
  const hit = data[0]
  if (!hit) return null
  return { lat: Number(hit.lat), lng: Number(hit.lon) }
}

async function main() {
  console.log('\n📍 Backfill de geocodificación\n')

  const clientes = await prisma.cliente.findMany({
    where: { activo: true },
    select: { id: true, nombre: true, direccion: true, ciudad: true, lat: true, lng: true },
  })

  let clientesOk = 0
  for (const c of clientes) {
    if (!c.direccion && !c.ciudad) continue
    if (c.lat != null && c.lng != null) continue
    const geo = await geocodificar(c.direccion || c.ciudad, c.ciudad ?? 'Formosa')
    if (geo) {
      await prisma.cliente.update({ where: { id: c.id }, data: geo })
      clientesOk++
      console.log(`✅ Cliente: ${c.nombre}`)
    } else {
      console.warn(`⚠️  Sin coords: ${c.nombre}`)
    }
    await sleep(DELAY_MS)
  }

  const sucursales = await prisma.clienteSucursal.findMany({
    where: { activo: true },
    select: { id: true, nombre: true, direccion: true, ciudad: true, lat: true, lng: true },
  })

  let sucursalesOk = 0
  for (const s of sucursales) {
    if (!s.direccion && !s.ciudad) continue
    if (s.lat != null && s.lng != null) continue
    const geo = await geocodificar(s.direccion || s.nombre, s.ciudad ?? 'Formosa')
    if (geo) {
      await prisma.clienteSucursal.update({ where: { id: s.id }, data: geo })
      sucursalesOk++
      console.log(`✅ Sucursal: ${s.nombre}`)
    }
    await sleep(DELAY_MS)
  }

  const equipos = await prisma.equipo.findMany({
    where: { estado: { not: 'BAJA' } },
    select: {
      id: true,
      nombre: true,
      ubicacionLat: true,
      sucursalId: true,
      direccionUbicacion: true,
      cliente: { select: { lat: true, lng: true, direccion: true, ciudad: true } },
      sucursal: { select: { lat: true, lng: true, direccion: true, ciudad: true, nombre: true } },
    },
  })

  let equiposOk = 0
  for (const eq of equipos) {
    if (eq.ubicacionLat != null) continue

    let lat = eq.sucursal?.lat ?? eq.cliente.lat
    let lng = eq.sucursal?.lng ?? eq.cliente.lng

    if ((lat == null || lng == null) && eq.direccionUbicacion?.trim()) {
      const geo = await geocodificar(eq.direccionUbicacion, eq.sucursal?.ciudad ?? eq.cliente.ciudad ?? 'Formosa')
      if (geo) {
        lat = geo.lat
        lng = geo.lng
      }
      await sleep(DELAY_MS)
    }

    const dir =
      eq.direccionUbicacion ??
      (eq.sucursal
        ? [eq.sucursal.nombre, eq.sucursal.direccion, eq.sucursal.ciudad].filter(Boolean).join(' · ')
        : [eq.cliente.direccion, eq.cliente.ciudad].filter(Boolean).join(' · '))

    if (lat == null || lng == null) continue

    await prisma.equipo.update({
      where: { id: eq.id },
      data: {
        ubicacionLat: lat,
        ubicacionLng: lng,
        ...(dir && !eq.direccionUbicacion ? { direccionUbicacion: dir } : {}),
      },
    })
    equiposOk++
    console.log(`✅ Equipo: ${eq.nombre}`)
  }

  console.log('\n--- Resumen ---')
  console.log(`Clientes geocodificados: ${clientesOk}`)
  console.log(`Sucursales geocodificadas: ${sucursalesOk}`)
  console.log(`Equipos con coords asignadas: ${equiposOk}\n`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
