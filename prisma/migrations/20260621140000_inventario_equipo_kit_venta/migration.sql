-- CreateEnum
CREATE TYPE "TipoArticuloInventario" AS ENUM ('REPUESTO', 'CONSUMIBLE', 'ACCESORIO', 'BATERIA', 'EQUIPO');
CREATE TYPE "TipoItemKitEquipo" AS ENUM ('ACCESORIO_ESPECIFICO', 'ACCESORIO_GENERICO', 'BATERIA', 'COMPONENTE', 'REPUESTO_INCLUIDO');
CREATE TYPE "TipoOT" AS ENUM ('CORRECTIVO', 'PREVENTIVO', 'INSTALACION', 'CALIBRACION', 'GARANTIA');

-- AlterTable inventario
ALTER TABLE "inventario" ADD COLUMN IF NOT EXISTS "tipoArticulo" "TipoArticuloInventario" NOT NULL DEFAULT 'REPUESTO';
ALTER TABLE "inventario" ADD COLUMN IF NOT EXISTS "marca" TEXT;
ALTER TABLE "inventario" ADD COLUMN IF NOT EXISTS "modelo" TEXT;
ALTER TABLE "inventario" ADD COLUMN IF NOT EXISTS "esSerializado" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "inventario" ADD COLUMN IF NOT EXISTS "requierePreventivo" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "inventario" ADD COLUMN IF NOT EXISTS "intervaloPreventivoDias" INTEGER;

-- AlterTable items_factura
ALTER TABLE "items_factura" ADD COLUMN IF NOT EXISTS "numeroSerie" TEXT;
ALTER TABLE "items_factura" ADD COLUMN IF NOT EXISTS "proximoPreventivo" TIMESTAMP(3);
ALTER TABLE "items_factura" ADD COLUMN IF NOT EXISTS "equipoGeneradoId" TEXT;

-- AlterTable ordenes_trabajo
ALTER TABLE "ordenes_trabajo" ADD COLUMN IF NOT EXISTS "tipo" "TipoOT" NOT NULL DEFAULT 'CORRECTIVO';

-- CreateTable kit
CREATE TABLE IF NOT EXISTS "inventario_kit_items" (
    "id" TEXT NOT NULL,
    "inventarioPadreId" TEXT NOT NULL,
    "inventarioHijoId" TEXT,
    "nombre" TEXT NOT NULL,
    "tipoItem" "TipoItemKitEquipo" NOT NULL,
    "tipoComponente" "TipoComponenteEquipo",
    "obligatorio" BOOLEAN NOT NULL DEFAULT false,
    "cantidad" INTEGER NOT NULL DEFAULT 1,
    "mesesVencimiento" INTEGER,
    "notas" TEXT,
    "orden" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "inventario_kit_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "inventario_kit_items_inventarioPadreId_idx" ON "inventario_kit_items"("inventarioPadreId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'inventario_kit_items_inventarioPadreId_fkey') THEN
    ALTER TABLE "inventario_kit_items" ADD CONSTRAINT "inventario_kit_items_inventarioPadreId_fkey"
      FOREIGN KEY ("inventarioPadreId") REFERENCES "inventario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'inventario_kit_items_inventarioHijoId_fkey') THEN
    ALTER TABLE "inventario_kit_items" ADD CONSTRAINT "inventario_kit_items_inventarioHijoId_fkey"
      FOREIGN KEY ("inventarioHijoId") REFERENCES "inventario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'items_factura_equipoGeneradoId_fkey') THEN
    ALTER TABLE "items_factura" ADD CONSTRAINT "items_factura_equipoGeneradoId_fkey"
      FOREIGN KEY ("equipoGeneradoId") REFERENCES "equipos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'items_factura_equipoGeneradoId_key') THEN
    ALTER TABLE "items_factura" ADD CONSTRAINT "items_factura_equipoGeneradoId_key" UNIQUE ("equipoGeneradoId");
  END IF;
END $$;

-- Equipos serializados en catálogo: marcar existentes categoría Equipos si aplica
UPDATE "inventario" SET "tipoArticulo" = 'EQUIPO', "esSerializado" = true, "requierePreventivo" = true, "intervaloPreventivoDias" = 180
WHERE "categoria" ILIKE '%equipo%' AND "tipoArticulo" = 'REPUESTO';
