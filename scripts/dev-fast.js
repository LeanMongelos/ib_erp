/** npm run dev:fast — next dev sin matar puerto ni tocar caché */
const { spawn } = require('child_process')
const { loadDevEnv, getDevPort, getDevUrl } = require('./dev-env')

loadDevEnv()
const port = getDevPort()
console.log(`\n⚡ dev:fast → http://localhost:${port}\n`)

spawn('npx', ['next', 'dev', '-p', port], {
  cwd: process.cwd(),
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, PORT: port },
})
