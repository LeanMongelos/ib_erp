-- Vincular presupuestos con órdenes de trabajo (flujo OT → presupuesto → factura)
ALTER TABLE "presupuestos" ADD COLUMN "otId" TEXT;

ALTER TABLE "presupuestos" ADD CONSTRAINT "presupuestos_otId_fkey"
  FOREIGN KEY ("otId") REFERENCES "ordenes_trabajo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "presupuestos_otId_idx" ON "presupuestos"("otId");
