/**
 * Reinicio limpio del entorno de desarrollo (Windows-friendly).
 * Uso: npm run dev:reset
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

log('\n🔄 Reinicio limpio del dev server...\n')
log(`   Puerto: ${port} · URL: ${getDevUrl()}\n`)
log('   (Usá esto cuando la UI se vea sin CSS / HTML crudo)\n')

try {
  if (process.platform === 'win32') {
    const out = execSync(`netstat -ano | findstr :${port} | findstr LISTENING`, { encoding: 'utf8' })
    const pids = new Set()
    for (const line of out.split('\n')) {
      const m = line.trim().match(/\s(\d+)\s*$/)
      if (m) pids.add(m[1])
    }
    for (const pid of pids) {
      try {
        execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' })
        log(`   Proceso ${pid} en :${port} terminado`)
      } catch {
        /* ignore */
      }
    }
  } else {
    execSync(`lsof -ti:${port} | xargs kill -9 2>/dev/null || true`, { shell: true, stdio: 'ignore' })
  }
} catch {
  log(`   Puerto ${port} libre`)
}

if (existsSync(`${root}/.next`)) {
  rmSync(`${root}/.next`, { recursive: true, force: true })
  log('   Carpeta .next eliminada')
}

log('   Aplicando migraciones pendientes...')
execSync('npx prisma migrate deploy', { stdio: 'inherit', cwd: root })

log('   Regenerando Prisma client...')
execSync('npx prisma generate', { stdio: 'inherit', cwd: root })

log('\n✅ Listo. Iniciando next dev...\n')

const child = spawn('npx', ['next', 'dev', '-p', port], {
  cwd: root,
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, PORT: port },
})

child.on('exit', (code) => process.exit(code ?? 0))
