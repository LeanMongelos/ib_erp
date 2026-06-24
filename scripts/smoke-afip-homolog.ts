/**
 * Smoke AFIP homologación: WSAA/WSFE sin emitir comprobante (getLastVoucher).
 * Uso: npm run smoke:afip-homolog
 * Requiere emisor activo HOMOLOGACION con certificado y clave cargados.
 */
import Afip from '@afipsdk/afip.js'
import { prisma } from '../lib/prisma'
import { emisorTieneCertificados } from '../lib/afip/validar-emision'
import { getStorage } from '../lib/storage'

function cuitNumerico(cuit: string): number {
  return parseInt(cuit.replace(/\D/g, ''), 10)
}

async function main() {
  console.log('\n=== Smoke AFIP homologación (sin emisión) ===\n')

  const emisor = await prisma.emisor.findFirst({
    where: { activo: true, ambiente: 'HOMOLOGACION' },
    orderBy: [{ predeterminado: 'desc' }, { razonSocial: 'asc' }],
  })

  if (!emisor) {
    console.error('❌ Sin emisor activo en HOMOLOGACION — crear uno en Configuración → Emisores')
    process.exit(1)
  }

  if (!emisorTieneCertificados(emisor)) {
    console.error(
      `❌ ${emisor.razonSocial}: sin certificado/clave — subir archivos antes del smoke WSAA`,
    )
    process.exit(1)
  }

  console.log(`Emisor: ${emisor.razonSocial} (CUIT ${emisor.cuit}, PtoVta ${emisor.puntoVenta})`)

  const storage = getStorage()
  const cert = await storage.get(emisor.certificadoPath!)
  const key = await storage.get(emisor.clavePrivadaPath!)

  const afip = new Afip({
    CUIT: cuitNumerico(emisor.cuit),
    cert: cert.toString('utf8'),
    key: key.toString('utf8'),
    production: false,
    access_token: process.env.AFIP_ACCESS_TOKEN ?? '',
  } as ConstructorParameters<typeof Afip>[0])

  const ptoVta = emisor.puntoVenta
  const tipoCbte = 6 // Factura B

  try {
    const ultimo = await afip.ElectronicBilling.getLastVoucher(ptoVta, tipoCbte)
    console.log(`✅ WSAA/WSFE OK — último comprobante Factura B PtoVta ${ptoVta}: ${ultimo ?? 0}`)
    console.log('   (consulta de lectura; no se emitió comprobante)\n')
  } catch (e) {
    console.error('❌ Error conectando AFIP homologación:', (e as Error).message)
    process.exit(1)
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
