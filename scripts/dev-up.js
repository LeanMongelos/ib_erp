/**
 * Levanta Docker + ERP dev y espera hasta que responda /api/health.
 * npm run dev:up
 */
const { execSync, spawn } = require('child_process')
const http = require('http')
const { loadDevEnv, getDevPort, getDevUrl } = require('./dev-env')

const root = process.cwd()
loadDevEnv()
const port = getDevPort()
const url = getDevUrl()

function log(msg) {
  console.log(msg)
}

function killPort(p) {
  try {
    if (process.platform === 'win32') {
      const out = execSync(`netstat -ano | findstr :${p} | findstr LISTENING`, { encoding: 'utf8' })
      for (const line of out.split('\n')) {
        const m = line.trim().match(/\s(\d+)\s*$/)
        if (m) {
          try {
            execSync(`taskkill /F /PID ${m[1]}`, { stdio: 'ignore' })
            log(`   Proceso colgado ${m[1]} en :${p} terminado`)
          } catch {
            /* ignore */
          }
        }
      }
    }
  } catch {
    /* libre */
  }
}

function pingHealth(timeoutMs = 3000) {
  return new Promise((resolve) => {
    const req = http.get(`${url}/api/health`, { timeout: timeoutMs }, (res) => {
      resolve(res.statusCode === 200)
      res.resume()
    })
    req.on('error', () => resolve(false))
    req.on('timeout', () => {
      req.destroy()
      resolve(false)
    })
  })
}

async function waitHealthy(maxSec = 90) {
  const start = Date.now()
  while (Date.now() - start < maxSec * 1000) {
    if (await pingHealth(4000)) return true
    await new Promise((r) => setTimeout(r, 2000))
    process.stdout.write('.')
  }
  return false
}

async function main() {
  log('\n🔧 dev:up — levantando iBiomédica ERP\n')

  log('   1/3 Docker...')
  try {
    execSync('docker compose up -d', { cwd: root, stdio: 'inherit' })
  } catch {
    log('   ⚠️  Docker falló — abrí Docker Desktop')
  }

  log(`\n   2/3 Liberando puerto ${port}...`)
  killPort(port)

  log(`   3/3 Iniciando Next.js en ${url}...\n`)

  const child = spawn('node', ['scripts/dev-start.js'], {
    cwd: root,
    stdio: 'inherit',
    shell: true,
    detached: true,
    env: { ...process.env, PORT: port },
  })
  child.unref()

  log('   Esperando respuesta')
  const ok = await waitHealthy(120)
  console.log('')

  if (ok) {
    log(`\n✅ ERP listo → ${url}/login\n`)
    log('   admin@ibiomedica.com / admin123\n')
  } else {
    log('\n❌ No respondió a tiempo. Probá: npm run dev:reset\n')
    process.exit(1)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
