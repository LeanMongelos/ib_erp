/**
 * Elimina un emisor por CUIT: reasigna facturas/presupuestos al emisor destino y borra el registro.
 * Uso: npx tsx scripts/eliminar-emisor-cuit.ts 30-70902717-0
 *      npx tsx scripts/eliminar-emisor-cuit.ts 30-70902717-0 --destino 20-24440827-4
 */
import { prisma } from '../lib/prisma'
import { getStorage } from '../lib/storage'
import { cuitSoloDigitos } from '../lib/cuit'
import fs from 'fs'
import path from 'path'

const CUIT_EMPRESA = '20-24440827-4'

async function main() {
  const cuitEliminar = process.argv[2]
  const destinoArg = process.argv.includes('--destino')
    ? process.argv[process.argv.indexOf('--destino') + 1]
    : CUIT_EMPRESA

  if (!cuitEliminar) {
    console.error('Uso: npx tsx scripts/eliminar-emisor-cuit.ts <CUIT-a-eliminar> [--destino <CUIT-destino>]')
    process.exit(1)
  }

  const emisorBorrar = await prisma.emisor.findUnique({ where: { cuit: cuitEliminar } })
  if (!emisorBorrar) {
    console.log(`No existe emisor con CUIT ${cuitEliminar} — nada que hacer.`)
    return
  }

  const emisorDestino = await prisma.emisor.findUnique({ where: { cuit: destinoArg } })
  if (!emisorDestino) {
    console.error(`Emisor destino ${destinoArg} no encontrado. Creá el emisor correcto antes de continuar.`)
    process.exit(1)
  }

  if (emisorBorrar.id === emisorDestino.id) {
    console.error('El CUIT a eliminar y el destino son el mismo emisor.')
    process.exit(1)
  }

  const [facturas, presupuestos] = await Promise.all([
    prisma.factura.count({ where: { emisorId: emisorBorrar.id } }),
    prisma.presupuesto.count({ where: { emisorId: emisorBorrar.id } }),
  ])

  console.log(`Emisor a eliminar: ${emisorBorrar.razonSocial} (${emisorBorrar.cuit})`)
  console.log(`Reasignar a: ${emisorDestino.razonSocial} (${emisorDestino.cuit})`)
  console.log(`Facturas vinculadas: ${facturas}, Presupuestos: ${presupuestos}`)

  await prisma.$transaction(async (tx) => {
    if (facturas > 0) {
      await tx.factura.updateMany({
        where: { emisorId: emisorBorrar.id },
        data: { emisorId: emisorDestino.id },
      })
    }
    if (presupuestos > 0) {
      await tx.presupuesto.updateMany({
        where: { emisorId: emisorBorrar.id },
        data: { emisorId: emisorDestino.id },
      })
    }
    await tx.emisor.delete({ where: { id: emisorBorrar.id } })
  })

  console.log('✅ Emisor eliminado de la base de datos')

  const digits = cuitSoloDigitos(cuitEliminar)
  try {
    const storage = getStorage()
    await storage.delete(`afip/${digits}/certificado.crt`).catch(() => null)
    await storage.delete(`afip/${digits}/clave.key`).catch(() => null)
    console.log(`✅ Certificados storage afip/${digits}/ eliminados (si existían)`)
  } catch {
    // storage puede no estar configurado en dev
  }

  const localAfip = path.join(process.cwd(), 'storage', 'afip', digits)
  if (fs.existsSync(localAfip)) {
    fs.rmSync(localAfip, { recursive: true, force: true })
    console.log(`✅ Carpeta local ${localAfip} eliminada`)
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
