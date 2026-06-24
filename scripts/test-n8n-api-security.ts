/**
 * Seguridad API n8n: todas las rutas deben validar Bearer N8N_API_KEY.
 */
import { readdirSync, readFileSync } from 'fs'
import { join } from 'path'
import { validateN8nBearerToken } from '../lib/crm/n8n'

const errors: string[] = []

function pass(msg: string) {
  console.log('✅', msg)
}

function fail(msg: string) {
  errors.push(msg)
  console.error('❌', msg)
}

function main() {
  console.log('\n=== Test seguridad API n8n ===\n')

  const routesDir = join(process.cwd(), 'app', 'api', 'n8n')
  const routes = readdirSync(routesDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => join(routesDir, d.name, 'route.ts'))

  if (routes.length === 0) {
    fail('No se encontraron rutas en app/api/n8n/')
  } else {
    pass(`${routes.length} rutas n8n encontradas`)
  }

  for (const routePath of routes) {
    const src = readFileSync(routePath, 'utf8')
    const name = routePath.replace(/\\/g, '/').split('/api/n8n/')[1]?.replace('/route.ts', '') ?? routePath
    if (!src.includes('verifyN8nApiKey')) {
      fail(`${name}: falta verifyN8nApiKey`)
    } else {
      pass(`${name}: verifyN8nApiKey presente`)
    }
  }

  if (!validateN8nBearerToken('Bearer clave-secreta', 'clave-secreta')) {
    fail('validateN8nBearerToken debería aceptar token válido')
  } else {
    pass('validateN8nBearerToken acepta Bearer válido')
  }

  if (validateN8nBearerToken('Bearer mal', 'clave-secreta')) {
    fail('validateN8nBearerToken debería rechazar token inválido')
  } else {
    pass('validateN8nBearerToken rechaza token inválido')
  }

  if (validateN8nBearerToken(null, 'clave-secreta')) {
    fail('validateN8nBearerToken debería rechazar header ausente')
  } else {
    pass('validateN8nBearerToken rechaza header ausente')
  }

  console.log('')
  if (errors.length > 0) {
    console.error(`${errors.length} fallo(s).\n`)
    process.exit(1)
  }
  console.log('OK — seguridad API n8n\n')
}

main()
