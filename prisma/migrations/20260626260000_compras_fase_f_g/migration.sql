-- CreateEnum
CREATE TYPE "ClasificacionOrigenOC" AS ENUM ('REPUESTO_OT', 'STOCK_REPOSICION', 'EQUIPO_VENTA', 'SHOWROOM_MUESTRA', 'GASTO_EDILICIO', 'ALQUILER', 'SERVICIO', 'OTRO');

-- CreateTable
CREATE TABLE "plantillas_oc" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "clasificacionOrigen" "ClasificacionOrigenOC" NOT NULL,
    "proveedorId" TEXT NOT NULL,
    "descripcionDefault" TEXT,
    "justificacionDefault" TEXT,
    "moneda" TEXT NOT NULL DEFAULT 'ARS',
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "recordatorioDiaMes" INTEGER,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plantillas_oc_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plantillas_oc_items" (
    "id" TEXT NOT NULL,
    "plantillaId" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "concepto" TEXT,
    "cantidad" INTEGER NOT NULL,
    "precioUnit" DOUBLE PRECISION NOT NULL,
    "inventarioId" TEXT,

    CONSTRAINT "plantillas_oc_items_pkey" PRIMARY KEY ("id")
);

-- AlterTable ordenes_compra
ALTER TABLE "ordenes_compra" ADD COLUMN "solicitanteId" TEXT;
ALTER TABLE "ordenes_compra" ADD COLUMN "justificacion" TEXT;
ALTER TABLE "ordenes_compra" ADD COLUMN "clasificacionOrigen" "ClasificacionOrigenOC";
ALTER TABLE "ordenes_compra" ADD COLUMN "ordenTrabajoId" TEXT;
ALTER TABLE "ordenes_compra" ADD COLUMN "presupuestoId" TEXT;
ALTER TABLE "ordenes_compra" ADD COLUMN "clienteId" TEXT;
ALTER TABLE "ordenes_compra" ADD COLUMN "depositoDestinoDefaultId" TEXT;
ALTER TABLE "ordenes_compra" ADD COLUMN "moneda" TEXT NOT NULL DEFAULT 'ARS';
ALTER TABLE "ordenes_compra" ADD COLUMN "cotizacionUsd" DOUBLE PRECISION;
ALTER TABLE "ordenes_compra" ADD COLUMN "plantillaOcId" TEXT;

-- AlterTable items_orden_compra
ALTER TABLE "items_orden_compra" ADD COLUMN "bonificacionPct" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "items_orden_compra" ADD COLUMN "precioLista" DOUBLE PRECISION;
ALTER TABLE "items_orden_compra" ADD COLUMN "depositoDestinoId" TEXT;

-- CreateIndex
CREATE INDEX "plantillas_oc_activa_clasificacionOrigen_idx" ON "plantillas_oc"("activa", "clasificacionOrigen");
CREATE INDEX "ordenes_compra_plantillaOcId_idx" ON "ordenes_compra"("plantillaOcId");

-- AddForeignKey
ALTER TABLE "plantillas_oc" ADD CONSTRAINT "plantillas_oc_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "proveedores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "plantillas_oc_items" ADD CONSTRAINT "plantillas_oc_items_plantillaId_fkey" FOREIGN KEY ("plantillaId") REFERENCES "plantillas_oc"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "plantillas_oc_items" ADD CONSTRAINT "plantillas_oc_items_inventarioId_fkey" FOREIGN KEY ("inventarioId") REFERENCES "inventario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ordenes_compra" ADD CONSTRAINT "ordenes_compra_solicitanteId_fkey" FOREIGN KEY ("solicitanteId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ordenes_compra" ADD CONSTRAINT "ordenes_compra_ordenTrabajoId_fkey" FOREIGN KEY ("ordenTrabajoId") REFERENCES "ordenes_trabajo"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ordenes_compra" ADD CONSTRAINT "ordenes_compra_presupuestoId_fkey" FOREIGN KEY ("presupuestoId") REFERENCES "presupuestos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ordenes_compra" ADD CONSTRAINT "ordenes_compra_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ordenes_compra" ADD CONSTRAINT "ordenes_compra_depositoDestinoDefaultId_fkey" FOREIGN KEY ("depositoDestinoDefaultId") REFERENCES "depositos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ordenes_compra" ADD CONSTRAINT "ordenes_compra_plantillaOcId_fkey" FOREIGN KEY ("plantillaOcId") REFERENCES "plantillas_oc"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "items_orden_compra" ADD CONSTRAINT "items_orden_compra_depositoDestinoId_fkey" FOREIGN KEY ("depositoDestinoId") REFERENCES "depositos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
