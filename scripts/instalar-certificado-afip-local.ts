/**
 * Instala certificado + clave en storage y actualiza el emisor en BD.
 *
 * Uso:
 *   npx tsx scripts/instalar-certificado-afip-local.ts "20-24440827-4" "C:\ruta\certificado.crt"
 *   npx tsx scripts/instalar-certificado-afip-local.ts "20-24440827-4" --desde-storage
 *   npx tsx scripts/instalar-certificado-afip-local.ts "20-24440827-4" "C:\ruta\certificado.crt" --alias "IB - LM DIGITAL SOLUTION"
 */
import fs from 'fs'
import path from 'path'
import { prisma } from '../lib/prisma'
import { getStorage } from '../lib/storage'
import { cuitSoloDigitos } from '../lib/cuit'

const ALIAS_DEFAULT = 'IB - LM DIGITAL SOLUTION'

async function main() {
  const args = process.argv.slice(2)
  const cuit = args[0]
  const desdeStorage = args.includes('--desde-storage')
  const crtPathArg = args.find((a, i) => i > 0 && !a.startsWith('--') && args[i - 1] !== '--alias')
  const aliasIdx = args.indexOf('--alias')
  const alias = aliasIdx >= 0 ? args[aliasIdx + 1] : ALIAS_DEFAULT

  if (!cuit) {
    console.error(
      'Uso: npx tsx scripts/instalar-certificado-afip-local.ts <CUIT> <ruta.crt|--desde-storage> [--alias "nombre"]',
    )
    process.exit(1)
  }

  const digits = cuitSoloDigitos(cuit)
  const storageDir = path.join(process.cwd(), 'storage', 'afip', digits)
  const localKey = path.join(storageDir, 'clave.key')
  const localCrt = path.join(storageDir, 'certificado.crt')
  const crtPath = desdeStorage ? localCrt : crtPathArg

  if (!crtPath || !fs.existsSync(crtPath)) {
    console.error(`No existe el certificado: ${crtPath ?? '(sin ruta)'}`)
    process.exit(1)
  }

  if (!fs.existsSync(localKey)) {
    console.error(`No se encontró la clave privada en ${localKey}`)
    console.error('Debe ser la misma .key generada al crear el CSR.')
    process.exit(1)
  }

  const emisor = await prisma.emisor.findUnique({ where: { cuit } })
  if (!emisor) {
    console.error(`Emisor ${cuit} no encontrado en BD`)
    process.exit(1)
  }

  const storage = getStorage()
  const certKey = `afip/${digits}/certificado.crt`
  const keyKey = `afip/${digits}/clave.key`

  const certBuf = fs.readFileSync(crtPath)
  const keyBuf = fs.readFileSync(localKey)

  if (!desdeStorage || crtPath !== localCrt) {
    await storage.put(certKey, certBuf, 'application/x-x509-ca-cert')
  }
  await storage.put(keyKey, keyBuf, 'application/octet-stream')

  await prisma.emisor.update({
    where: { id: emisor.id },
    data: {
      certificadoPath: certKey,
      clavePrivadaPath: keyKey,
      certificadoAlias: alias,
      activo: true,
    },
  })

  console.log(`✅ Certificado instalado para ${emisor.razonSocial} (${cuit})`)
  console.log(`   Alias: ${alias}`)
  console.log(`   Ambiente actual: ${emisor.ambiente}`)
  console.log(`   Storage: ${certKey} + ${keyKey}`)
  if (emisor.ambiente === 'HOMOLOGACION') {
    console.log('   ℹ️  Probá emitir en homologación antes de pasar a PRODUCCION.')
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
