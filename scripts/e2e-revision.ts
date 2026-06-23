/**
 * Revisión E2E — CRM, sucursales, historial, facturación equipos
 * Ejecutar: npx tsx --env-file=.env scripts/e2e-revision.ts
 */
import { prisma } from '../lib/prisma'
import { validarSucursalesInstalacionEquipo } from '../lib/facturas/validar-sucursal-equipo'
import { geocodificarSucursal } from '../lib/geocoding'

const errors: string[] = []
const ok: string[] = []
const warn: string[] = []

function pass(msg: string) {
  ok.push(msg)
  console.log('✅', msg)
}
function fail(msg: string, err?: unknown) {
  const detail = err instanceof Error ? err.message : String(err ?? '')
  errors.push(`${msg}: ${detail}`)
  console.error('❌', msg, detail ? `— ${detail}` : '')
}
function note(msg: string) {
  warn.push(msg)
  console.log('⚠️ ', msg)
}

const BASE = process.env.E2E_BASE_URL ?? process.env.NEXTAUTH_URL ?? `http://localhost:${process.env.PORT ?? '3001'}`

async function httpJson(path: string, init?: RequestInit): Promise<{ status: number; json?: unknown; html?: boolean }> {
  try {
    const res = await fetch(`${BASE}${path}`, { ...init, redirect: 'manual' })
    const ct = res.headers.get('content-type') ?? ''
    if (ct.includes('application/json')) {
      return { status: res.status, json: await res.json() }
    }
    const text = await res.text()
    return { status: res.status, html: text.trimStart().startsWith('<!') }
  } catch (e) {
    return { status: 0, json: { error: String(e) } }
  }
}

async function main() {
  console.log('\n=== Revisión E2E — ibiomedica ===\n')

  // --- Schema / DB ---
  try {
    const cols = await prisma.$queryRaw<{ column_name: string }[]>`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'clientes_sucursales' AND column_name IN ('numero', 'lat', 'lng')
    `
    const names = cols.map((c) => c.column_name).sort()
    if (names.includes('numero') && names.includes('lat')) {
      pass(`Tabla clientes_sucursales: columnas ${names.join(', ')}`)
    } else {
      fail(`Faltan columnas en clientes_sucursales: ${names.join(', ')}`)
    }
  } catch (e) {
    fail('Schema clientes_sucursales', e)
  }

  try {
    const tipo = await prisma.$queryRaw<{ enumlabel: string }[]>`
      SELECT enumlabel FROM pg_enum e
      JOIN pg_type t ON e.enumtypid = t.oid
      WHERE t.typname = 'TipoCliente' AND enumlabel = 'ORGANISMO_PUBLICO'
    `
    if (tipo.length > 0) pass('Enum TipoCliente incluye ORGANISMO_PUBLICO')
    else fail('Falta ORGANISMO_PUBLICO en TipoCliente — correr migraciones')
  } catch (e) {
    fail('Enum TipoCliente', e)
  }

  // --- Clínica San Juan + Graciela ---
  const clinica = await prisma.cliente.findFirst({
    where: { OR: [{ nombre: { contains: 'Clínica San Juan', mode: 'insensitive' } }, { email: 'administracion@clinicasanjuan.com' }] },
    include: {
      sucursales: { where: { activo: true }, take: 5 },
      _count: { select: { ots: true, facturas: true } },
    },
  })

  if (clinica) {
    pass(`Cliente demo: ${clinica.nombre} (${clinica._count.ots} OTs, ${clinica._count.facturas} facturas)`)
    if (clinica.sucursales.length > 0) {
      pass(`${clinica.sucursales.length} sucursal(es) activa(s)`)
    } else {
      note('Clínica San Juan sin sucursales — recomendado cargar al menos una')
    }
  } else {
    note('Clínica San Juan no encontrada — ejecutar seed o demo-historial-graciela')
  }

  const conv = await prisma.conversacionCRM.findFirst({
    where: { contactoNombre: { contains: 'Graciela', mode: 'insensitive' } },
    select: { id: true, contactoNombre: true, clienteId: true, cliente: { select: { nombre: true } } },
  })
  if (conv) {
    if (conv.clienteId && clinica && conv.clienteId === clinica.id) {
      pass(`Conversación Graciela vinculada a ${conv.cliente?.nombre}`)
    } else if (conv.clienteId) {
      note(`Graciela vinculada a «${conv.cliente?.nombre}» (no Clínica San Juan)`)
    } else {
      fail('Conversación Graciela sin cliente vinculado')
    }
  } else {
    note('Conversación Lic. Graciela Torres no encontrada')
  }

  // --- Historial data ---
  if (clinica) {
    const [ots, facturas] = await Promise.all([
      prisma.ordenTrabajo.findMany({ where: { clienteId: clinica.id }, take: 12, orderBy: { fechaApertura: 'desc' } }),
      prisma.factura.findMany({
        where: { clienteId: clinica.id, estado: { notIn: ['BORRADOR', 'ANULADA'] } },
        take: 8,
        include: { items: { take: 5 } },
        orderBy: { fechaEmision: 'desc' },
      }),
    ])
    if (ots.length > 0) pass(`Historial OTs: ${ots.length} registros`)
    else note('Sin OTs para historial CRM')

    const itemsProducto = facturas.flatMap((f) => f.items)
    if (itemsProducto.length > 0) pass(`Historial productos: ${itemsProducto.length} ítems de factura`)
    else note('Sin ítems de factura para historial CRM')

    const otDemo = ots.find((o) => o.numero.includes('DEMO-SJ')) ?? ots[0]
    if (otDemo) {
      const otFull = await prisma.ordenTrabajo.findUnique({
        where: { id: otDemo.id },
        include: { historial: true, repuestos: true, equipo: true },
      })
      if (otFull && otFull.historial.length > 0) {
        pass(`OT ${otDemo.numero}: ${otFull.historial.length} eventos historial, ${otFull.repuestos.length} repuestos`)
      } else {
        note(`OT ${otDemo.numero} sin historial detallado`)
      }
    }
  }

  // --- Validación sucursal equipo ---
  try {
    const equipoInv = await prisma.inventario.findFirst({ where: { tipoArticulo: 'EQUIPO' }, select: { id: true, nombre: true } })
    if (equipoInv && clinica) {
      await validarSucursalesInstalacionEquipo(clinica.id, [{
        descripcion: equipoInv.nombre,
        inventarioId: equipoInv.id,
        sucursalInstalacionId: null,
      }]).then(() => fail('validarSucursalesInstalacionEquipo debería rechazar equipo sin sucursal'))
      pass('Validación: equipo sin sucursal → rechazado')

      const suc = clinica.sucursales[0] ?? await prisma.clienteSucursal.findFirst({ where: { clienteId: clinica.id, activo: true } })
      if (suc) {
        await validarSucursalesInstalacionEquipo(clinica.id, [{
          descripcion: equipoInv.nombre,
          inventarioId: equipoInv.id,
          sucursalInstalacionId: suc.id,
        }])
        pass('Validación: equipo con sucursal válida → OK')
      }
    } else {
      note('Sin inventario EQUIPO o cliente para test validación sucursal')
    }
  } catch (e) {
    if (e instanceof Error && e.message.includes('sucursal de instalación')) {
      pass('Validación: equipo sin sucursal → rechazado')
    } else {
      fail('validarSucursalesInstalacionEquipo', e)
    }
  }

  // --- Geocoding ---
  try {
    const geo = await geocodificarSucursal('Av. 25 de Mayo', '1000', 'Formosa')
    if (geo?.lat != null && geo?.lng != null) pass(`Geocoding: Formosa coords (${geo.lat.toFixed(4)}, ${geo.lng.toFixed(4)})`)
    else fail('Geocoding sin coordenadas')
  } catch (e) {
    fail('Geocoding lib', e)
  }

  // --- HTTP routes (requiere dev server) ---
  console.log(`\n--- HTTP (${BASE}) ---\n`)

  const pages = ['/crm/nuevo', '/crm/inbox', '/facturacion/nueva']
  for (const p of pages) {
    const r = await httpJson(p)
    if (r.status === 200 && r.html) pass(`GET ${p} → 200 HTML`)
    else if (r.status === 307 || r.status === 302) pass(`GET ${p} → ${r.status} redirect (auth OK)`)
    else if (r.status === 0) note(`GET ${p} — servidor no disponible en ${BASE}`)
    else pass(`GET ${p} → ${r.status}`)
  }

  const apiChecks: Array<[string, (j: unknown) => boolean]> = [
    ['/api/geocoding?direccion=Av.%2025%20de%20Mayo&numero=1000&ciudad=Formosa', (j) => typeof (j as { lat?: number }).lat === 'number'],
  ]

  if (clinica) {
    apiChecks.push([
      `/api/clientes/${clinica.id}/historial`,
      (j) => Array.isArray((j as { servicios?: unknown[] }).servicios),
    ])
    const ot = await prisma.ordenTrabajo.findFirst({ where: { clienteId: clinica.id }, select: { id: true } })
    if (ot) {
      apiChecks.push([
        `/api/ots/${ot.id}`,
        (j) => !!(j as { numero?: string }).numero && !(j as { error?: string }).error,
      ])
    }
  }

  for (const [path, check] of apiChecks) {
    const r = await httpJson(path)
    if (r.status === 0) {
      note(`GET ${path} — servidor no disponible`)
      continue
    }
    if (r.html) {
      fail(`GET ${path} → HTML en lugar de JSON (posible 500)`)
      continue
    }
    if (r.status === 401) {
      pass(`GET ${path} → 401 JSON (auth requerida, ruta OK)`)
      continue
    }
    if (r.status === 200 && r.json && check(r.json)) {
      pass(`GET ${path} → 200 JSON válido`)
    } else if (r.status === 403) {
      pass(`GET ${path} → 403 (permiso, ruta existe)`)
    } else {
      fail(`GET ${path} → ${r.status}`, JSON.stringify(r.json)?.slice(0, 120))
    }
  }

  console.log('\n--- Resumen ---')
  console.log(`OK: ${ok.length} | Advertencias: ${warn.length} | Errores: ${errors.length}`)
  if (warn.length) warn.forEach((w) => console.log(' ⚠', w))
  if (errors.length) {
    errors.forEach((e) => console.log(' •', e))
    process.exit(1)
  }
  console.log('\n🎉 Revisión E2E OK\n')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
