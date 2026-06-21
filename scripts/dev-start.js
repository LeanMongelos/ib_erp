/**
 * Arranque de desarrollo más estable (Windows-friendly).
 * Mata procesos huérfanos en :3000 y limpia caché webpack antes de next dev.
 * Uso: npm run dev
 */
const { rmSync, existsSync } = require('fs')
const { execSync, spawn } = require('child_process')

const root = process.cwd()

function log(msg) {
  console.log(msg)
}

function killPort3000() {
  try {
    if (process.platform === 'win32') {
      const out = execSync('netstat -ano | findstr :3000 | findstr LISTENING', { encoding: 'utf8' })
      const pids = new Set()
      for (const line of out.split('\n')) {
        const m = line.trim().match(/\s(\d+)\s*$/)
        if (m) pids.add(m[1])
      }
      for (const pid of pids) {
        try {
          execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' })
          log(`   Proceso ${pid} en :3000 terminado`)
        } catch {
          /* ignore */
        }
      }
    } else {
      execSync('lsof -ti:3000 | xargs kill -9 2>/dev/null || true', { shell: true, stdio: 'ignore' })
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

log('\n🚀 Iniciando dev (modo estable)...\n')
killPort3000()
limpiarCacheWebpack()

log('   Tip: si la UI se ve sin estilos → npm run dev:reset\n')

const child = spawn('npx', ['next', 'dev'], {
  cwd: root,
  stdio: 'inherit',
  shell: true,
})

child.on('exit', (code) => process.exit(code ?? 0))
