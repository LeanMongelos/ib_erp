const { Client } = require('ssh2')
const fs = require('fs')
const path = require('path')

const PASS = process.env.SSH_PASS
if (!PASS) {
  console.error('Falta SSH_PASS')
  process.exit(1)
}

const files = [
  'scripts/vps-deploy-from-git.sh',
  'scripts/vps-setup-github-deploy.sh',
  '.github/workflows/ci.yml',
  '.github/workflows/deploy.yml',
]

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

function sshExec(conn, cmd) {
  return new Promise((resolve, reject) => {
    conn.exec(cmd, (err, stream) => {
      if (err) return reject(err)
      stream.on('data', (d) => process.stdout.write(d))
      stream.stderr.on('data', (d) => process.stderr.write(d))
      stream.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`exit ${code}`))))
    })
  })
}

async function main() {
  const root = path.resolve(__dirname, '..')
  const conn = new Client()
  await new Promise((res, rej) =>
    conn.on('ready', res).on('error', rej).connect({
      host: '149.50.152.115',
      port: 5244,
      username: 'root',
      password: PASS,
    }),
  )

  for (const rel of files) {
    const local = path.join(root, rel)
    const remote = `/opt/ibiomedica/${rel.replace(/\\/g, '/')}`
    const dir = path.dirname(remote).replace(/\\/g, '/')
    console.log(`Subiendo ${rel}...`)
    await sshExec(conn, `mkdir -p '${dir}'`)
    await sftpUpload(conn, local, remote)
  }

  await sshExec(conn, 'chmod +x /opt/ibiomedica/scripts/vps-deploy-from-git.sh /opt/ibiomedica/scripts/vps-setup-github-deploy.sh')
  conn.end()
  console.log('OK')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
