-- Fase 8: Tracking + mapa

CREATE TYPE "TipoEventoTracking" AS ENUM (
  'RECEPCION',
  'DEPOSITO',
  'EN_TRANSITO',
  'INSTALADO',
  'EN_SERVICIO',
  'RETIRO',
  'BAJA'
);

ALTER TABLE "clientes" ADD COLUMN IF NOT EXISTS "lat" DOUBLE PRECISION;
ALTER TABLE "clientes" ADD COLUMN IF NOT EXISTS "lng" DOUBLE PRECISION;

ALTER TABLE "equipos" ADD COLUMN IF NOT EXISTS "ubicacionLat" DOUBLE PRECISION;
ALTER TABLE "equipos" ADD COLUMN IF NOT EXISTS "ubicacionLng" DOUBLE PRECISION;
ALTER TABLE "equipos" ADD COLUMN IF NOT EXISTS "direccionUbicacion" TEXT;

CREATE TABLE IF NOT EXISTS "eventos_tracking" (
  "id" TEXT NOT NULL,
  "equipoId" TEXT NOT NULL,
  "tipo" "TipoEventoTracking" NOT NULL,
  "lat" DOUBLE PRECISION NOT NULL,
  "lng" DOUBLE PRECISION NOT NULL,
  "direccion" TEXT,
  "nota" TEXT,
  "fotoUrl" TEXT,
  "otId" TEXT,
  "usuarioId" TEXT,
  "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "eventos_tracking_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "eventos_tracking_equipoId_idx" ON "eventos_tracking"("equipoId");
CREATE INDEX IF NOT EXISTS "eventos_tracking_fecha_idx" ON "eventos_tracking"("fecha");

ALTER TABLE "eventos_tracking"
  ADD CONSTRAINT "eventos_tracking_equipoId_fkey"
  FOREIGN KEY ("equipoId") REFERENCES "equipos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "eventos_tracking"
  ADD CONSTRAINT "eventos_tracking_otId_fkey"
  FOREIGN KEY ("otId") REFERENCES "ordenes_trabajo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "eventos_tracking"
  ADD CONSTRAINT "eventos_tracking_usuarioId_fkey"
  FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
