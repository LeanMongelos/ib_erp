-- Flujo comercial: Presupuesto → Orden de venta → Remito → Factura

CREATE TYPE "EstadoOrdenVenta" AS ENUM ('CONFIRMADA', 'PARCIALMENTE_REMITIDA', 'REMITIDA', 'FACTURADA', 'CANCELADA');
CREATE TYPE "EstadoRemitoVenta" AS ENUM ('BORRADOR', 'EMITIDO', 'FACTURADO', 'ANULADO');

CREATE TABLE "ordenes_venta" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "estado" "EstadoOrdenVenta" NOT NULL DEFAULT 'CONFIRMADA',
    "presupuestoId" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "observaciones" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ordenes_venta_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ordenes_venta_numero_key" ON "ordenes_venta"("numero");
CREATE UNIQUE INDEX "ordenes_venta_presupuestoId_key" ON "ordenes_venta"("presupuestoId");
CREATE INDEX "ordenes_venta_clienteId_idx" ON "ordenes_venta"("clienteId");

CREATE TABLE "remitos_venta" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "estado" "EstadoRemitoVenta" NOT NULL DEFAULT 'BORRADOR',
    "presupuestoId" TEXT,
    "ordenVentaId" TEXT,
    "clienteId" TEXT NOT NULL,
    "fechaEmision" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "observaciones" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "remitos_venta_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "remitos_venta_numero_key" ON "remitos_venta"("numero");
CREATE INDEX "remitos_venta_clienteId_idx" ON "remitos_venta"("clienteId");
CREATE INDEX "remitos_venta_presupuestoId_idx" ON "remitos_venta"("presupuestoId");
CREATE INDEX "remitos_venta_ordenVentaId_idx" ON "remitos_venta"("ordenVentaId");

CREATE TABLE "items_remito" (
    "id" TEXT NOT NULL,
    "remitoId" TEXT NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "presupuestoItemId" TEXT,
    "inventarioId" TEXT,
    "codigo" TEXT,
    "descripcion" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL DEFAULT 1,
    "inventarioUnidadId" TEXT,
    "numeroSerie" TEXT,
    "equipoId" TEXT,
    CONSTRAINT "items_remito_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "items_remito_remitoId_idx" ON "items_remito"("remitoId");

ALTER TABLE "facturas" ADD COLUMN IF NOT EXISTS "ordenVentaId" TEXT;
ALTER TABLE "facturas" ADD COLUMN IF NOT EXISTS "remitoId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "facturas_ordenVentaId_key" ON "facturas"("ordenVentaId");
CREATE UNIQUE INDEX IF NOT EXISTS "facturas_remitoId_key" ON "facturas"("remitoId");

ALTER TABLE "ordenes_venta" ADD CONSTRAINT "ordenes_venta_presupuestoId_fkey" FOREIGN KEY ("presupuestoId") REFERENCES "presupuestos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ordenes_venta" ADD CONSTRAINT "ordenes_venta_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "remitos_venta" ADD CONSTRAINT "remitos_venta_ordenVentaId_fkey" FOREIGN KEY ("ordenVentaId") REFERENCES "ordenes_venta"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "remitos_venta" ADD CONSTRAINT "remitos_venta_presupuestoId_fkey" FOREIGN KEY ("presupuestoId") REFERENCES "presupuestos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "remitos_venta" ADD CONSTRAINT "remitos_venta_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "items_remito" ADD CONSTRAINT "items_remito_remitoId_fkey" FOREIGN KEY ("remitoId") REFERENCES "remitos_venta"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "items_remito" ADD CONSTRAINT "items_remito_presupuestoItemId_fkey" FOREIGN KEY ("presupuestoItemId") REFERENCES "items_presupuesto"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "items_remito" ADD CONSTRAINT "items_remito_inventarioId_fkey" FOREIGN KEY ("inventarioId") REFERENCES "inventario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "items_remito" ADD CONSTRAINT "items_remito_inventarioUnidadId_fkey" FOREIGN KEY ("inventarioUnidadId") REFERENCES "inventario_unidades"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "items_remito" ADD CONSTRAINT "items_remito_equipoId_fkey" FOREIGN KEY ("equipoId") REFERENCES "equipos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "facturas" ADD CONSTRAINT "facturas_ordenVentaId_fkey" FOREIGN KEY ("ordenVentaId") REFERENCES "ordenes_venta"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "facturas" ADD CONSTRAINT "facturas_remitoId_fkey" FOREIGN KEY ("remitoId") REFERENCES "remitos_venta"("id") ON DELETE SET NULL ON UPDATE CASCADE;
