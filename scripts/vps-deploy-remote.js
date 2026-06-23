/**
 * Sube el proyecto y ejecuta bootstrap en el VPS DonWeb.
 * Uso: $env:SSH_PASS='...'; node scripts/vps-deploy-remote.js
 */
const { Client } = require('ssh2')
const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const HOST = '149.50.152.115'
const PORT = 5244
const USER = 'root'
const PASS = process.env.SSH_PASS
const APP_DIR = '/opt/ibiomedica'
const TAR = path.join(process.env.TEMP || '/tmp', 'ibiomedica-deploy.tgz')

if (!PASS) {
  console.error('Falta SSH_PASS en el entorno')
  process.exit(1)
}

function sshExec(conn, cmd, label) {
  return new Promise((resolve, reject) => {
    console.log(`\n>>> ${label || cmd.slice(0, 80)}`)
    conn.exec(cmd, (err, stream) => {
      if (err) return reject(err)
      stream.on('data', (d) => process.stdout.write(d))
      stream.stderr.on('data', (d) => process.stderr.write(d))
      stream.on('close', (code) => {
        if (code === 0) resolve()
        else reject(new Error(`Exit ${code}: ${label || cmd}`))
      })
    })
  })
}

function sftpUpload(conn, local, remote) {
  return new Promise((resolve, reject) => {
    conn.sftp((err, sftp) => {
      if (err) return reject(err)
      const rs = fs.createReadStream(local)
      const ws = sftp.createWriteStream(remote)
      rs.pipe(ws)
      ws.on('close', resolve)
      ws.on('error', reject)
    })
  })
}

async function main() {
  console.log('Empaquetando proyecto local...')
  if (fs.existsSync(TAR)) fs.unlinkSync(TAR)
  execSync(
    `tar -czf "${TAR}" --exclude=node_modules --exclude=.next --exclude=.git --exclude=storage --exclude=.env -C "${path.resolve(__dirname, '..')}" .`,
    { stdio: 'inherit', shell: true },
  )

  const conn = new Client()
  await new Promise((resolve, reject) => {
    conn
      .on('ready', resolve)
      .on('error', reject)
      .connect({ host: HOST, port: PORT, username: USER, password: PASS })
  })

  console.log('Conectado al VPS.')

  await sshExec(conn, 'mkdir -p /opt && rm -rf /opt/ibiomedica.new && mkdir -p /opt/ibiomedica.new', 'Preparar directorio')
  console.log('Subiendo tarball (puede tardar)...')
  await sftpUpload(conn, TAR, '/opt/ibiomedica-deploy.tgz')
  await sshExec(
    conn,
    'cd /opt/ibiomedica.new && tar -xzf /opt/ibiomedica-deploy.tgz && rm /opt/ibiomedica-deploy.tgz',
    'Extraer archivos',
  )

  const bootstrap = fs.readFileSync(path.join(__dirname, 'vps-bootstrap.sh'), 'utf8')
  const b64 = Buffer.from(bootstrap).toString('base64')
  await sshExec(
    conn,
    `echo '${b64}' | base64 -d > /tmp/vps-bootstrap.sh && chmod +x /tmp/vps-bootstrap.sh`,
    'Subir bootstrap',
  )

  await sshExec(
    conn,
    `rm -rf ${APP_DIR} && mv /opt/ibiomedica.new ${APP_DIR} && PUBLIC_URL=http://149.50.152.115 bash /tmp/vps-bootstrap.sh`,
    'Bootstrap producción',
  )

  conn.end()
  console.log('\n✅ Listo: http://149.50.152.115/login')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
