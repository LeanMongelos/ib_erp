/**
 * Carga .env / .env.local en scripts Node (dev-start, dev-reset).
 * Next.js carga esto solo al arrancar next; estos scripts corren antes.
 */
const fs = require('fs')
const path = require('path')

function loadEnvFile(name) {
  const file = path.join(process.cwd(), name)
  if (!fs.existsSync(file)) return
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('=')
    if (eq === -1) continue
    const key = t.slice(0, eq).trim()
    let val = t.slice(eq + 1).trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    if (process.env[key] === undefined) process.env[key] = val
  }
}

function loadDevEnv() {
  loadEnvFile('.env')
  loadEnvFile('.env.local')
}

/** Puerto dev de iBiomédica. Default 3001 para no chocar con otras apps en 3000. */
function getDevPort() {
  return String(process.env.PORT || '3001')
}

function getDevUrl() {
  return process.env.NEXTAUTH_URL || `http://localhost:${getDevPort()}`
}

module.exports = { loadDevEnv, getDevPort, getDevUrl }
