/**
 * Arranque de desarrollo estable (Windows-friendly).
 * Solo libera el puerto configurado (PORT en .env, default 3001).
 * NO toca el 3000 — convive con otras webs locales.
 *
 * Uso: npm run dev
 */
const { rmSync, existsSync } = require('fs')
const { execSync, spawn } = require('child_process')
const { loadDevEnv, getDevPort, getDevUrl } = require('./dev-env')

const root = process.cwd()

loadDevEnv()
const port = getDevPort()

function log(msg) {
  console.log(msg)
}

function killPort(p) {
  try {
    if (process.platform === 'win32') {
      const out = execSync(`netstat -ano | findstr :${p} | findstr LISTENING`, { encoding: 'utf8' })
      const pids = new Set()
      for (const line of out.split('\n')) {
        const m = line.trim().match(/\s(\d+)\s*$/)
        if (m) pids.add(m[1])
      }
      for (const pid of pids) {
        try {
          execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' })
          log(`   Proceso ${pid} en :${p} terminado (instancia previa de este ERP)`)
        } catch {
          /* ignore */
        }
      }
    } else {
      execSync(`lsof -ti:${p} | xargs kill -9 2>/dev/null || true`, { shell: true, stdio: 'ignore' })
    }
  } catch {
    /* puerto libre */
  }
}

function limpiarCacheWebpack() {
  const cache = `${root}/.next/cache`
  if (existsSync(cache)) {
    rmSync(cache, { recursive: true, force: true })
    log('   Caché webpack (.next/cache) eliminada')
  }
}

log('\n🚀 Iniciando iBiomédica ERP...\n')
log(`   Puerto: ${port} (otras webs pueden usar 3000 u otro puerto)`)
log(`   URL:    ${getDevUrl()}\n`)

killPort(port)

const resetCache = process.argv.includes('--reset') || process.env.DEV_RESET === '1'
if (resetCache) {
  limpiarCacheWebpack()
} else {
  log('   Caché webpack conservada. Reset completo: npm run dev:reset\n')
}

const child = spawn('npx', ['next', 'dev', '-p', port], {
  cwd: root,
  stdio: 'inherit',
  shell: true,
  env: {
    ...process.env,
    PORT: port,
    NODE_OPTIONS: process.env.NODE_OPTIONS || '--max-old-space-size=4096',
  },
})

child.on('exit', (code) => process.exit(code ?? 0))
