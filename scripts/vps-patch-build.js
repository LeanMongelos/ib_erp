const { Client } = require('ssh2')
const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const PASS = process.env.SSH_PASS
if (!PASS) process.exit(1)

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
  const conn = new Client()
  await new Promise((res, rej) => conn.on('ready', res).on('error', rej).connect({
    host: '149.50.152.115', port: 5244, username: 'root', password: PASS,
  }))
  await sftpUpload(conn, path.join(__dirname, '../worker/afip-worker.ts'), '/opt/ibiomedica/worker/afip-worker.ts')
  const build = fs.readFileSync(path.join(__dirname, 'vps-build-start.sh'), 'utf8')
  const b64 = Buffer.from(build).toString('base64')
  await sshExec(conn, `echo ${b64} | base64 -d | bash`)
  conn.end()
}

main().catch((e) => { console.error(e); process.exit(1) })
