-- Historial de asignación equipo ↔ cliente (vigencia, traslados)

CREATE TYPE "TipoAsignacionEquipo" AS ENUM ('VENTA', 'ALQUILER', 'COMODATO', 'EXTERNO', 'TRASLADO', 'MANUAL_ST');

ALTER TYPE "TipoEntradaHistoriaClinica" ADD VALUE IF NOT EXISTS 'CAMBIO_ASIGNACION';

CREATE TABLE "equipos_asignaciones" (
    "id" TEXT NOT NULL,
    "equipoId" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "sucursalId" TEXT,
    "tipo" "TipoAsignacionEquipo" NOT NULL,
    "vigenciaDesde" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "vigenciaHasta" TIMESTAMP(3),
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "motivo" TEXT,
    "observaciones" TEXT,
    "lineaAlquilerId" TEXT,
    "creadoPorId" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "equipos_asignaciones_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "equipos_asignaciones_equipoId_activa_idx" ON "equipos_asignaciones"("equipoId", "activa");
CREATE INDEX "equipos_asignaciones_clienteId_activa_idx" ON "equipos_asignaciones"("clienteId", "activa");
CREATE INDEX "equipos_asignaciones_equipoId_vigenciaDesde_idx" ON "equipos_asignaciones"("equipoId", "vigenciaDesde");

ALTER TABLE "equipos_asignaciones" ADD CONSTRAINT "equipos_asignaciones_equipoId_fkey"
  FOREIGN KEY ("equipoId") REFERENCES "equipos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "equipos_asignaciones" ADD CONSTRAINT "equipos_asignaciones_clienteId_fkey"
  FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "equipos_asignaciones" ADD CONSTRAINT "equipos_asignaciones_sucursalId_fkey"
  FOREIGN KEY ("sucursalId") REFERENCES "clientes_sucursales"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "equipos_asignaciones" ADD CONSTRAINT "equipos_asignaciones_lineaAlquilerId_fkey"
  FOREIGN KEY ("lineaAlquilerId") REFERENCES "lineas_alquiler"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "equipos_asignaciones" ADD CONSTRAINT "equipos_asignaciones_creadoPorId_fkey"
  FOREIGN KEY ("creadoPorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
