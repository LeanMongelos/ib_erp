-- CreateEnum
CREATE TYPE "TipoCompraProveedor" AS ENUM ('REMITO', 'CONCEPTOS', 'AMBOS');

-- AlterEnum
ALTER TYPE "EstadoOrdenCompra" ADD VALUE IF NOT EXISTS 'PENDIENTE_APROBACION';
ALTER TYPE "EstadoOrdenCompra" ADD VALUE IF NOT EXISTS 'RECHAZADA';

-- AlterTable
ALTER TABLE "proveedores" ADD COLUMN "tipoCompra" "TipoCompraProveedor" NOT NULL DEFAULT 'AMBOS';

ALTER TABLE "ordenes_compra" ADD COLUMN "creadoPorId" TEXT;
ALTER TABLE "ordenes_compra" ADD COLUMN "enviadaAprobacionEn" TIMESTAMP(3);
ALTER TABLE "ordenes_compra" ADD COLUMN "aprobadoPorId" TEXT;
ALTER TABLE "ordenes_compra" ADD COLUMN "aprobadoEn" TIMESTAMP(3);
ALTER TABLE "ordenes_compra" ADD COLUMN "rechazadoPorId" TEXT;
ALTER TABLE "ordenes_compra" ADD COLUMN "rechazadoEn" TIMESTAMP(3);
ALTER TABLE "ordenes_compra" ADD COLUMN "rechazadoMotivo" TEXT;

ALTER TABLE "items_orden_compra" ADD COLUMN "concepto" TEXT;

-- CreateIndex
CREATE INDEX "ordenes_compra_estado_idx" ON "ordenes_compra"("estado");
CREATE INDEX "ordenes_compra_proveedorId_idx" ON "ordenes_compra"("proveedorId");

-- AddForeignKey
ALTER TABLE "ordenes_compra" ADD CONSTRAINT "ordenes_compra_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ordenes_compra" ADD CONSTRAINT "ordenes_compra_aprobadoPorId_fkey" FOREIGN KEY ("aprobadoPorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ordenes_compra" ADD CONSTRAINT "ordenes_compra_rechazadoPorId_fkey" FOREIGN KEY ("rechazadoPorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
