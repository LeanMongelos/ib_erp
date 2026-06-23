/**
 * Estado rápido: Docker + puerto del ERP + health HTTP.
 * npm run dev:status
 */
const { execSync } = require('child_process')
const http = require('http')
const { loadDevEnv, getDevPort, getDevUrl } = require('./dev-env')

loadDevEnv()
const port = getDevPort()

function pingHealth() {
  return new Promise((resolve) => {
    const req = http.get(`${getDevUrl()}/api/health`, { timeout: 3000 }, (res) => {
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

async function main() {
  console.log('\n📊 Estado iBiomédica ERP\n')
  console.log(`   Puerto configurado: ${port}`)
  console.log(`   URL esperada:       ${getDevUrl()}\n`)

  let listening = false
  try {
    if (process.platform === 'win32') {
      execSync(`netstat -ano | findstr :${port} | findstr LISTENING`, { stdio: 'pipe' })
      listening = true
    }
  } catch {
    listening = false
  }

  if (listening) {
    const healthOk = await pingHealth()
    if (healthOk) {
      console.log(`   ✅ Next.js respondiendo en :${port}`)
    } else {
      console.log(`   ❌ Puerto :${port} abierto pero COLGADO → npm run dev:up`)
    }
  } else {
    console.log(`   ❌ Nada escuchando en :${port} → npm run dev:up`)
  }

  try {
    const docker = execSync('docker ps --format "{{.Names}} {{.Status}}"', { encoding: 'utf8' })
    const db = docker.split('\n').find((l) => l.includes('ibiomedica_db'))
    if (db) {
      console.log(`   ✅ ${db.trim()}`)
    } else {
      console.log('   ❌ PostgreSQL (ibiomedica_db) no corre → docker compose up -d')
    }
  } catch {
    console.log('   ⚠️  Docker no disponible')
  }

  console.log('\n   ERP: http://localhost:' + port + '/login')
  console.log('   Otra web puede usar :3000 sin conflicto\n')
}

main()
