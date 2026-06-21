-- Moneda en inventario, presupuestos y facturas
ALTER TABLE "inventario" ADD COLUMN "moneda" TEXT NOT NULL DEFAULT 'ARS';
ALTER TABLE "presupuestos" ADD COLUMN "moneda" TEXT NOT NULL DEFAULT 'ARS';
ALTER TABLE "presupuestos" ADD COLUMN "cotizacionUsd" DOUBLE PRECISION;
ALTER TABLE "facturas" ADD COLUMN "moneda" TEXT NOT NULL DEFAULT 'ARS';
ALTER TABLE "facturas" ADD COLUMN "cotizacionUsd" DOUBLE PRECISION;
