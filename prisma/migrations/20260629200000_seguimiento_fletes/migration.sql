-- CreateEnum
CREATE TYPE "TipoFlete" AS ENUM ('ENTRADA', 'SALIDA');

-- CreateEnum
CREATE TYPE "EstadoFlete" AS ENUM ('BORRADOR', 'EN_TRANSITO', 'RECIBIDO', 'CANCELADO');

-- CreateTable
CREATE TABLE "seguimiento_fletes" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "tipo" "TipoFlete" NOT NULL,
    "estado" "EstadoFlete" NOT NULL DEFAULT 'BORRADOR',
    "fechaEnvio" TIMESTAMP(3),
    "fechaRecibido" TIMESTAMP(3),
    "transportista" TEXT,
    "guiaSeguimiento" TEXT,
    "importe" DOUBLE PRECISION,
    "observaciones" TEXT,
    "proveedorOrigenNombre" TEXT,
    "clienteNombre" TEXT,
    "facturaTransporte" TEXT,
    "ordenCompraId" TEXT,
    "remitoVentaId" TEXT,
    "facturaCompraId" TEXT,
    "facturaId" TEXT,
    "clienteId" TEXT,
    "proveedorOrigenId" TEXT,
    "creadoPorId" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seguimiento_fletes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "seguimiento_fletes_numero_key" ON "seguimiento_fletes"("numero");

-- CreateIndex
CREATE UNIQUE INDEX "seguimiento_fletes_ordenCompraId_key" ON "seguimiento_fletes"("ordenCompraId");

-- CreateIndex
CREATE UNIQUE INDEX "seguimiento_fletes_remitoVentaId_key" ON "seguimiento_fletes"("remitoVentaId");

-- CreateIndex
CREATE INDEX "seguimiento_fletes_tipo_idx" ON "seguimiento_fletes"("tipo");

-- CreateIndex
CREATE INDEX "seguimiento_fletes_estado_idx" ON "seguimiento_fletes"("estado");

-- CreateIndex
CREATE INDEX "seguimiento_fletes_clienteId_idx" ON "seguimiento_fletes"("clienteId");

-- CreateIndex
CREATE INDEX "seguimiento_fletes_proveedorOrigenId_idx" ON "seguimiento_fletes"("proveedorOrigenId");

-- AddForeignKey
ALTER TABLE "seguimiento_fletes" ADD CONSTRAINT "seguimiento_fletes_ordenCompraId_fkey" FOREIGN KEY ("ordenCompraId") REFERENCES "ordenes_compra"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seguimiento_fletes" ADD CONSTRAINT "seguimiento_fletes_remitoVentaId_fkey" FOREIGN KEY ("remitoVentaId") REFERENCES "remitos_venta"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seguimiento_fletes" ADD CONSTRAINT "seguimiento_fletes_facturaCompraId_fkey" FOREIGN KEY ("facturaCompraId") REFERENCES "facturas_compra"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seguimiento_fletes" ADD CONSTRAINT "seguimiento_fletes_facturaId_fkey" FOREIGN KEY ("facturaId") REFERENCES "facturas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seguimiento_fletes" ADD CONSTRAINT "seguimiento_fletes_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seguimiento_fletes" ADD CONSTRAINT "seguimiento_fletes_proveedorOrigenId_fkey" FOREIGN KEY ("proveedorOrigenId") REFERENCES "proveedores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seguimiento_fletes" ADD CONSTRAINT "seguimiento_fletes_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
