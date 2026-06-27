-- Fase E: CAE / constatación AFIP en facturas de compra
ALTER TABLE "facturas_compra" ADD COLUMN "cae" TEXT;
ALTER TABLE "facturas_compra" ADD COLUMN "cae_vencimiento" TIMESTAMP(3);
ALTER TABLE "facturas_compra" ADD COLUMN "constatacion_resultado" TEXT;
ALTER TABLE "facturas_compra" ADD COLUMN "constatado_en" TIMESTAMP(3);
ALTER TABLE "facturas_compra" ADD COLUMN "constatacion_observaciones" TEXT;
