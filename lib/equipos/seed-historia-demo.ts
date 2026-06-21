/**
 * Datos demo de historia clínica para los primeros equipos del seed.
 */
import { prisma } from '@/lib/prisma'
import { addMonths, subMonths } from 'date-fns'

export async function seedHistoriaClinicaDemo(equipos: { id: string; nombre: string; numeroSerie: string | null }[]) {
  if (equipos.length < 2) return

  const proveedor = await prisma.proveedor.findFirst({ where: { activo: true } })
  const tecnico = await prisma.usuario.findFirst({
    where: { email: { in: ['nicolas@ibiomedica.com', 'joaquin@ibiomedica.com'] } },
  })

  const e0 = equipos[0]
  const e1 = equipos[1]

  await prisma.equipo.update({
    where: { id: e0.id },
    data: {
      modeloExacto: 'Savina 300 Standard',
      codigoInterno: 'IB-EQ-001',
      firmwareVersion: 'v6.2.1',
      softwareVersion: 'Ventilation Suite 4.0',
      fechaInstalacion: subMonths(new Date(), 8),
      servicioInstalacion: 'Terapia Intensiva',
      pisoSala: 'Piso 2 · UTI',
      contactoResponsable: 'Bioing. María López',
      notasTecnicas: 'Requiere calibración de sensores de flujo cada 12 meses. Red O2 central.',
      proveedorOrigenId: proveedor?.id ?? null,
      referenciaCompra: 'OC-2025-0142',
      instaladoPorUsuarioId: tecnico?.id ?? null,
      direccionUbicacion: 'Sanatorio local — UTI',
    },
  })

  await prisma.equipoComponente.createMany({
    data: [
      {
        equipoId: e0.id,
        tipo: 'BATERIA',
        descripcion: 'Batería interna 12V (autonomía)',
        numeroSerie: 'BAT-INT-001',
        instaladoEn: subMonths(new Date(), 8),
        venceEn: addMonths(new Date(), 2),
        alertaDiasAntes: 45,
      },
      {
        equipoId: e0.id,
        tipo: 'FILTRO',
        descripcion: 'Filtro bacteriano inspiratorio',
        venceEn: addMonths(new Date(), 5),
        alertaDiasAntes: 30,
      },
    ],
    skipDuplicates: true,
  })

  await prisma.equipoAccesorio.createMany({
    data: [
      { equipoId: e0.id, nombre: 'Cable de alimentación 220V', cantidad: 1, obligatorio: true },
      { equipoId: e0.id, nombre: 'Manguera espiral paciente adulto', cantidad: 2, obligatorio: true },
      { equipoId: e0.id, nombre: 'Sensor de flujo/adaptador', cantidad: 1, obligatorio: true },
    ],
    skipDuplicates: true,
  })

  await prisma.historiaClinicaEntrada.create({
    data: {
      equipoId: e0.id,
      tipo: 'INSTALACION',
      titulo: 'Instalación y puesta en servicio',
      contenido: 'Equipo instalado en UTI. Prueba de alarmas OK. Capacitación al staff de enfermería.',
      usuarioId: tecnico?.id,
      fecha: subMonths(new Date(), 8),
    },
  })

  await prisma.equipo.update({
    where: { id: e1.id },
    data: {
      modeloExacto: 'Caleo 8000 plus',
      softwareVersion: 'Neonatal Care 2.3',
      servicioInstalacion: 'Neonatología',
      pisoSala: 'Piso 1 · Neonatología',
      contactoResponsable: 'Dr. Pérez',
    },
  })

  await prisma.equipoComponente.create({
    data: {
      equipoId: e1.id,
      tipo: 'BATERIA',
      descripcion: 'Pack baterías respaldo incubadora',
      venceEn: addMonths(new Date(), -1),
      alertaDiasAntes: 30,
    },
  })

  console.log('✅ Historia clínica demo (2 equipos)')
}
