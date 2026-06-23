/**
 * Genera favicon.ico, app/icon.png y app/apple-icon.png desde el logo IB.
 * npm run icons:generate
 */

import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import sharp from 'sharp'

import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const LOGO = path.join(ROOT, 'public', 'logo.png')

async function ensureSource() {
  const hd = path.join(ROOT, 'public', 'favicon-hd.png')
  await sharp(LOGO)
    .resize(256, 256, { fit: 'contain', background: { r: 10, g: 10, b: 10, alpha: 1 } })
    .png()
    .toFile(hd)
  return hd
}

async function main() {
  const source = await ensureSource()
  const appDir = path.join(ROOT, 'app')
  const publicDir = path.join(ROOT, 'public')
  const tmpDir = path.join(ROOT, '.tmp-favicons')
  fs.mkdirSync(tmpDir, { recursive: true })

  await sharp(source).resize(32, 32).png().toFile(path.join(appDir, 'icon.png'))
  await sharp(source).resize(180, 180).png().toFile(path.join(appDir, 'apple-icon.png'))
  await sharp(source).resize(32, 32).png().toFile(path.join(publicDir, 'favicon.png'))

  const sizes = [16, 32, 48]
  const pngPaths = []
  for (const size of sizes) {
    const p = path.join(tmpDir, `favicon-${size}.png`)
    await sharp(source).resize(size, size).png().toFile(p)
    pngPaths.push(p)
  }

  let ico
  try {
    const mod = await import('png-to-ico')
    const pngToIco = mod.default ?? mod
    ico = await pngToIco(pngPaths)
  } catch {
    execSync('npm install --no-save png-to-ico', { cwd: ROOT, stdio: 'inherit' })
    const mod = await import('png-to-ico')
    const pngToIco = mod.default ?? mod
    ico = await pngToIco(pngPaths)
  }

  fs.writeFileSync(path.join(appDir, 'favicon.ico'), ico)
  fs.writeFileSync(path.join(publicDir, 'favicon.ico'), ico)

  fs.rmSync(tmpDir, { recursive: true, force: true })
  console.log('✅ Favicons IB generados (app/ + public/)')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
