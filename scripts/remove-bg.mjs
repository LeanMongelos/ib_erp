/**
 * Elimina el fondo blanco del logo y lo guarda como PNG con transparencia.
 * Usa flood-fill desde las esquinas para detectar el fondo blanco.
 */
import sharp from 'sharp'
import { readFileSync, writeFileSync } from 'fs'

const INPUT  = 'public/logo.jpg'
const OUTPUT = 'public/logo.png'

// Umbral de "blancura" — píxeles con R,G,B > este valor se vuelven transparentes
const THRESHOLD = 230

async function main() {
  const { data, info } = await sharp(INPUT)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const { width, height, channels } = info
  const pixels = new Uint8Array(data)

  // BFS flood-fill desde las 4 esquinas para marcar el fondo
  const visited = new Uint8Array(width * height)
  const queue = []

  function enqueue(x, y) {
    const idx = y * width + x
    if (x < 0 || x >= width || y < 0 || y >= height) return
    if (visited[idx]) return
    const p = idx * channels
    const r = pixels[p], g = pixels[p + 1], b = pixels[p + 2]
    if (r >= THRESHOLD && g >= THRESHOLD && b >= THRESHOLD) {
      visited[idx] = 1
      queue.push([x, y])
    }
  }

  // Semillas: bordes completos
  for (let x = 0; x < width; x++) { enqueue(x, 0); enqueue(x, height - 1) }
  for (let y = 0; y < height; y++) { enqueue(0, y); enqueue(width - 1, y) }

  while (queue.length > 0) {
    const [x, y] = queue.pop()
    enqueue(x + 1, y); enqueue(x - 1, y)
    enqueue(x, y + 1); enqueue(x, y - 1)
  }

  // Hacer transparentes los píxeles marcados como fondo
  for (let i = 0; i < width * height; i++) {
    if (visited[i]) {
      pixels[i * channels + 3] = 0 // alpha = 0 (transparente)
    }
  }

  await sharp(Buffer.from(pixels), { raw: { width, height, channels } })
    .png()
    .toFile(OUTPUT)

  console.log(`✅ Logo guardado en ${OUTPUT} (${width}x${height}px, fondo eliminado)`)
}

main().catch((e) => { console.error('❌ Error:', e.message); process.exit(1) })
