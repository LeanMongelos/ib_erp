/**
 * Smoke E2E HTTP — login + APIs y páginas clave.
 * LEGACY: preferir `npm run smoke` (e2e-smoke.ts, validación DB).
 * Uso: node scripts/e2e-smoke.mjs [baseUrl]
 */
const base = process.argv[2] ?? process.env.NEXTAUTH_URL ?? `http://localhost:${process.env.PORT ?? '3001'}`
const email = process.env.E2E_EMAIL ?? 'admin@ib.com'
const password = process.env.E2E_PASSWORD ?? 'admin123'

const results = []

function ok(name, detail = '') {
  results.push({ name, pass: true, detail })
  console.log(`✅ ${name}${detail ? ` — ${detail}` : ''}`)
}
function fail(name, detail = '') {
  results.push({ name, pass: false, detail })
  console.error(`❌ ${name}${detail ? ` — ${detail}` : ''}`)
}

async function main() {
  console.log(`\n🔍 E2E smoke en ${base}\n`)

  // Login NextAuth
  const csrfRes = await fetch(`${base}/api/auth/csrf`)
  if (!csrfRes.ok) {
    fail('CSRF', `${csrfRes.status}`)
    return summary()
  }
  const { csrfToken } = await csrfRes.json()
  const jar = csrfRes.headers.get('set-cookie') ?? ''

  const loginBody = new URLSearchParams({
    csrfToken,
    email,
    password,
    json: 'true',
    callbackUrl: `${base}/dashboard`,
  })
  const loginRes = await fetch(`${base}/api/auth/callback/credentials`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: jar,
    },
    body: loginBody,
    redirect: 'manual',
  })
  const setCookies = loginRes.headers.getSetCookie?.() ?? []
  const cookieHeader = setCookies.map((c) => c.split(';')[0]).join('; ')
  if (!cookieHeader && loginRes.status !== 200 && loginRes.status !== 302) {
    fail('Login', `status ${loginRes.status}`)
    return summary()
  }

  const sessionRes = await fetch(`${base}/api/auth/session`, {
    headers: { Cookie: cookieHeader || jar },
  })
  const session = await sessionRes.json()
  if (!session?.user?.email) {
    fail('Sesión', 'sin usuario')
    return summary()
  }
  ok('Login', session.user.email)

  const auth = { Cookie: cookieHeader || jar }

  const apis = [
    ['GET /api/busqueda?q=hospital', `${base}/api/busqueda?q=hospital`],
    ['GET /api/notificaciones/inbox', `${base}/api/notificaciones/inbox`],
    ['GET /api/config/catalogos', `${base}/api/config/catalogos`],
    ['GET /api/config/notificaciones', `${base}/api/config/notificaciones`],
    ['GET /api/config/seguridad', `${base}/api/config/seguridad`],
    ['GET /api/auditoria', `${base}/api/auditoria?limit=5`],
    ['GET /api/mantenimiento', `${base}/api/mantenimiento`],
    ['GET /api/crm/embudo', `${base}/api/crm/embudo`],
    ['GET /api/clientes', `${base}/api/clientes`],
    ['GET /api/facturas', `${base}/api/facturas`],
    ['GET /api/presupuestos', `${base}/api/presupuestos`],
    ['GET /api/inventario', `${base}/api/inventario`],
    ['GET /api/plantillas/numeracion', `${base}/api/plantillas/numeracion`],
  ]

  for (const [name, url] of apis) {
    try {
      const r = await fetch(url, { headers: auth })
      if (r.ok) ok(name, `${r.status}`)
      else fail(name, `${r.status} ${(await r.text()).slice(0, 80)}`)
    } catch (e) {
      fail(name, e.message)
    }
  }

  const pages = [
    '/dashboard',
    '/crm',
    '/crm/embudo',
    '/presupuestos',
    '/facturacion',
    '/facturacion/nueva',
    '/cobranzas',
    '/inventario',
    '/servicio-tecnico/preventivo',
    '/configuracion',
    '/configuracion/catalogos',
    '/configuracion/notificaciones',
    '/configuracion/seguridad',
    '/configuracion/auditoria',
  ]

  for (const path of pages) {
    try {
      const r = await fetch(`${base}${path}`, { headers: auth, redirect: 'manual' })
      const pass = r.status === 200 || r.status === 307 || r.status === 308
      if (pass) ok(`PAGE ${path}`, `${r.status}`)
      else fail(`PAGE ${path}`, `${r.status}`)
    } catch (e) {
      fail(`PAGE ${path}`, e.message)
    }
  }

  summary()
}

function summary() {
  const passed = results.filter((r) => r.pass).length
  const failed = results.filter((r) => !r.pass)
  console.log(`\n--- ${passed}/${results.length} OK ---`)
  if (failed.length) {
    console.log('Fallos:')
    for (const f of failed) console.log(`  • ${f.name}: ${f.detail}`)
    process.exit(1)
  }
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
