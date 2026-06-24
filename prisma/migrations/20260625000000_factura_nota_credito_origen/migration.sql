-- Nota de crédito vinculada a factura anulada
ALTER TABLE "facturas" ADD COLUMN "facturaOrigenId" TEXT;

ALTER TABLE "facturas" ADD CONSTRAINT "facturas_facturaOrigenId_fkey"
  FOREIGN KEY ("facturaOrigenId") REFERENCES "facturas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "facturas_facturaOrigenId_idx" ON "facturas"("facturaOrigenId");
