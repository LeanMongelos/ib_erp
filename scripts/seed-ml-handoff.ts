/**
 * Enriquece datos demo para handoff ML (5 clientes seed).
 * Uso: npm run seed:ml-handoff
 */
import { prisma } from '../lib/prisma'
import { HANDOFF_CLIENTES, seedMlHandoff } from '../lib/equipos/seed-ml-handoff'

async function main() {
  const faltantes: string[] = []
  for (const nombre of HANDOFF_CLIENTES) {
    const c = await prisma.cliente.findFirst({ where: { nombre, activo: true }, select: { id: true } })
    if (!c) faltantes.push(nombre)
  }

  if (faltantes.length === HANDOFF_CLIENTES.length) {
    console.error('❌ No se encontraron clientes handoff. Ejecute npm run db:seed primero.')
    process.exit(1)
  }
  if (faltantes.length) {
    console.warn(`⚠️  Clientes no encontrados: ${faltantes.join(', ')}`)
  }

  const r = await seedMlHandoff()

  console.log('✅ Seed ML handoff completado')
  console.log(`   Hospital Central (historia): ${r.hospitalCentral}`)
  console.log(`   Clínica San Juan (MON-PAT-001): ${r.clinicaSanJuan}`)
  console.log(`   Consultorio Espínola → EXTERNO: ${r.consultorioExterno} equipos`)
  console.log(`   Hospital Clorinda (componentes): ${r.hospitalClorinda} equipos`)
  console.log(`   Centro Diagnóstico (ALQUILER): ${r.centroDiagnosticoAlquiler}`)
}

main()
  .catch((e) => {
    console.error('❌ Error seed ML handoff:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
