-- Versionado y trazabilidad de revisiones de presupuesto
ALTER TABLE "presupuestos" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "presupuestos" ADD COLUMN "presupuestoRaizId" TEXT;
ALTER TABLE "presupuestos" ADD COLUMN "presupuestoOrigenId" TEXT;

CREATE INDEX "presupuestos_presupuestoRaizId_idx" ON "presupuestos"("presupuestoRaizId");
CREATE INDEX "presupuestos_presupuestoOrigenId_idx" ON "presupuestos"("presupuestoOrigenId");

ALTER TABLE "presupuestos" ADD CONSTRAINT "presupuestos_presupuestoRaizId_fkey"
  FOREIGN KEY ("presupuestoRaizId") REFERENCES "presupuestos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "presupuestos" ADD CONSTRAINT "presupuestos_presupuestoOrigenId_fkey"
  FOREIGN KEY ("presupuestoOrigenId") REFERENCES "presupuestos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
