-- Origen de equipo + trazabilidad por unidad (SN/Lote)

CREATE TYPE "OrigenEquipo" AS ENUM ('VENTA', 'EXTERNO', 'MANUAL_ST');
CREATE TYPE "ModoTrazabilidad" AS ENUM ('NINGUNA', 'SERIE', 'LOTE', 'SERIE_Y_LOTE');
CREATE TYPE "EstadoInventarioUnidad" AS ENUM ('EN_STOCK', 'RESERVADO', 'VENDIDO', 'BAJA');

ALTER TABLE "equipos" ADD COLUMN "origen" "OrigenEquipo" NOT NULL DEFAULT 'VENTA';
ALTER TABLE "equipos" ADD COLUMN "inventarioId" TEXT;

ALTER TABLE "inventario" ADD COLUMN "modoTrazabilidad" "ModoTrazabilidad" NOT NULL DEFAULT 'NINGUNA';

UPDATE "inventario"
SET "modoTrazabilidad" = 'SERIE'
WHERE "tipoArticulo" = 'EQUIPO' AND "esSerializado" = true;

ALTER TABLE "items_factura" ADD COLUMN "inventarioUnidadId" TEXT;

CREATE TABLE "inventario_unidades" (
    "id" TEXT NOT NULL,
    "inventarioId" TEXT NOT NULL,
    "numeroSerie" TEXT,
    "lote" TEXT,
    "estado" "EstadoInventarioUnidad" NOT NULL DEFAULT 'EN_STOCK',
    "fechaIngreso" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notas" TEXT,
    "equipoId" TEXT,

    CONSTRAINT "inventario_unidades_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "inventario_unidades_equipoId_key" ON "inventario_unidades"("equipoId");
CREATE UNIQUE INDEX "inventario_unidades_inventarioId_numeroSerie_key" ON "inventario_unidades"("inventarioId", "numeroSerie");
CREATE INDEX "inventario_unidades_inventarioId_idx" ON "inventario_unidades"("inventarioId");
CREATE INDEX "inventario_unidades_inventarioId_estado_idx" ON "inventario_unidades"("inventarioId", "estado");
CREATE UNIQUE INDEX "items_factura_inventarioUnidadId_key" ON "items_factura"("inventarioUnidadId");

ALTER TABLE "equipos" ADD CONSTRAINT "equipos_inventarioId_fkey"
  FOREIGN KEY ("inventarioId") REFERENCES "inventario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "inventario_unidades" ADD CONSTRAINT "inventario_unidades_inventarioId_fkey"
  FOREIGN KEY ("inventarioId") REFERENCES "inventario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "inventario_unidades" ADD CONSTRAINT "inventario_unidades_equipoId_fkey"
  FOREIGN KEY ("equipoId") REFERENCES "equipos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "items_factura" ADD CONSTRAINT "items_factura_inventarioUnidadId_fkey"
  FOREIGN KEY ("inventarioUnidadId") REFERENCES "inventario_unidades"("id") ON DELETE SET NULL ON UPDATE CASCADE;
