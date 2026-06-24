/**
 * Smoke n8n: verifica N8N_API_KEY y rutas protegidas (delega a test estático).
 * Uso: npm run smoke:n8n
 */
import { spawnSync } from 'child_process'
import path from 'path'

function main() {
  console.log('\n=== Smoke n8n ===\n')

  if (!process.env.N8N_API_KEY?.trim()) {
    console.log('⊘ N8N_API_KEY no definida — webhooks /api/n8n/* deshabilitados (opcional)')
    console.log('\n✅ Smoke n8n omitido\n')
    return
  }

  console.log('N8N_API_KEY: definida')

  const script = path.join(process.cwd(), 'scripts', 'test-n8n-api-security.ts')
  const result = spawnSync('npx', ['tsx', script], {
    encoding: 'utf8',
    env: process.env,
    shell: process.platform === 'win32',
  })

  if (result.stdout) process.stdout.write(result.stdout)
  if (result.stderr) process.stderr.write(result.stderr)

  if (result.status !== 0) {
    console.error('\n❌ Smoke n8n falló\n')
    process.exit(1)
  }
  console.log('\n✅ Smoke n8n OK\n')
}

main()
