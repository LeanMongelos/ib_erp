-- Tipo de depósito, ubicación por unidad y stock por depósito

CREATE TYPE "TipoDeposito" AS ENUM ('DEPOSITO', 'SHOWROOM', 'CAJA', 'OTRO');

ALTER TABLE "depositos" ADD COLUMN "tipo" "TipoDeposito" NOT NULL DEFAULT 'DEPOSITO';

ALTER TABLE "inventario_unidades" ADD COLUMN "depositoId" TEXT;
ALTER TABLE "inventario_unidades" ADD COLUMN "ubicacionDetalle" TEXT;

CREATE TABLE "stock_depositos" (
    "id" TEXT NOT NULL,
    "inventarioId" TEXT NOT NULL,
    "depositoId" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL DEFAULT 0,
    "ubicacionDetalle" TEXT,

    CONSTRAINT "stock_depositos_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "stock_depositos_inventarioId_depositoId_key" ON "stock_depositos"("inventarioId", "depositoId");
CREATE INDEX "stock_depositos_inventarioId_idx" ON "stock_depositos"("inventarioId");
CREATE INDEX "inventario_unidades_depositoId_idx" ON "inventario_unidades"("depositoId");

ALTER TABLE "inventario_unidades" ADD CONSTRAINT "inventario_unidades_depositoId_fkey"
  FOREIGN KEY ("depositoId") REFERENCES "depositos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "stock_depositos" ADD CONSTRAINT "stock_depositos_inventarioId_fkey"
  FOREIGN KEY ("inventarioId") REFERENCES "inventario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "stock_depositos" ADD CONSTRAINT "stock_depositos_depositoId_fkey"
  FOREIGN KEY ("depositoId") REFERENCES "depositos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
