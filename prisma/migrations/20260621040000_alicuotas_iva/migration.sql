-- CreateTable
CREATE TABLE "alicuotas_iva" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "porcentaje" DOUBLE PRECISION NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "esPredeterminada" BOOLEAN NOT NULL DEFAULT false,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alicuotas_iva_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "alicuotas_iva_codigo_key" ON "alicuotas_iva"("codigo");

-- AlterTable
ALTER TABLE "clientes" ADD COLUMN "alicuotaIvaId" TEXT;

-- AlterTable
ALTER TABLE "facturas" ADD COLUMN "alicuotaIvaPct" DOUBLE PRECISION NOT NULL DEFAULT 21;

-- AlterTable
ALTER TABLE "presupuestos" ADD COLUMN "alicuotaIvaPct" DOUBLE PRECISION NOT NULL DEFAULT 21;

-- AlterTable
ALTER TABLE "items_factura" ADD COLUMN "alicuotaIvaPct" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "items_presupuesto" ADD COLUMN "alicuotaIvaPct" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "inventario" ADD COLUMN "alicuotaIvaId" TEXT;

-- AddForeignKey
ALTER TABLE "clientes" ADD CONSTRAINT "clientes_alicuotaIvaId_fkey" FOREIGN KEY ("alicuotaIvaId") REFERENCES "alicuotas_iva"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventario" ADD CONSTRAINT "inventario_alicuotaIvaId_fkey" FOREIGN KEY ("alicuotaIvaId") REFERENCES "alicuotas_iva"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed alícuotas base
INSERT INTO "alicuotas_iva" ("id", "codigo", "nombre", "porcentaje", "activo", "esPredeterminada", "creadoEn")
VALUES
  ('alicuota-iva-21', 'IVA_21', 'IVA General', 21, true, true, CURRENT_TIMESTAMP),
  ('alicuota-iva-10_5', 'IVA_10_5', 'IVA Reducido', 10.5, true, false, CURRENT_TIMESTAMP),
  ('alicuota-iva-27', 'IVA_27', 'IVA Incrementado', 27, true, false, CURRENT_TIMESTAMP),
  ('alicuota-iva-0', 'IVA_0', 'Exento / 0%', 0, true, false, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
