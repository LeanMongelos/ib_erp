const { Client } = require('ssh2')
const fs = require('fs')
const path = require('path')

const PASS = process.env.SSH_PASS
if (!PASS) {
  console.error('Falta SSH_PASS')
  process.exit(1)
}

const scriptPath = process.argv[2]
if (!scriptPath) {
  console.error('Uso: node scripts/vps-run-remote.sh.js scripts/vps-resume.sh')
  process.exit(1)
}

const script = fs.readFileSync(scriptPath, 'utf8')
const b64 = Buffer.from(script).toString('base64')

const conn = new Client()
conn
  .on('ready', () => {
    conn.exec(`echo ${b64} | base64 -d | bash`, (err, stream) => {
      if (err) throw err
      stream.on('data', (d) => process.stdout.write(d))
      stream.stderr.on('data', (d) => process.stderr.write(d))
      stream.on('close', (code) => {
        conn.end()
        process.exit(code ?? 0)
      })
    })
  })
  .connect({ host: '149.50.152.115', port: 5244, username: 'root', password: PASS })
