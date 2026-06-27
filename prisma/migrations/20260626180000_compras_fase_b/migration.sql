-- CreateEnum
CREATE TYPE "TipoFacturaCompra" AS ENUM ('REMITO', 'CONCEPTOS');

-- CreateEnum
CREATE TYPE "EstadoFacturaCompra" AS ENUM ('BORRADOR', 'REGISTRADA', 'ANULADA');

-- CreateTable
CREATE TABLE "facturas_compra" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "proveedorId" TEXT NOT NULL,
    "tipo" "TipoFacturaCompra" NOT NULL,
    "estado" "EstadoFacturaCompra" NOT NULL DEFAULT 'BORRADOR',
    "fecha" TIMESTAMP(3) NOT NULL,
    "fechaVencimiento" TIMESTAMP(3),
    "puntoVenta" INTEGER NOT NULL,
    "numeroComprobante" INTEGER NOT NULL,
    "tipoComprobanteAfipId" TEXT,
    "neto" DOUBLE PRECISION NOT NULL,
    "iva" DOUBLE PRECISION NOT NULL,
    "total" DOUBLE PRECISION NOT NULL,
    "moneda" TEXT NOT NULL DEFAULT 'ARS',
    "ordenCompraId" TEXT,
    "recepcionCompleta" BOOLEAN NOT NULL DEFAULT false,
    "fcSinRecepcion" BOOLEAN NOT NULL DEFAULT false,
    "notaFcSinRecepcion" TEXT,
    "alertaFcPendienteEn" TIMESTAMP(3),
    "creadoPorId" TEXT,
    "registradaEn" TIMESTAMP(3),
    "anuladaEn" TIMESTAMP(3),
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "facturas_compra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "items_factura_compra" (
    "id" TEXT NOT NULL,
    "facturaCompraId" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "concepto" TEXT,
    "cantidad" DOUBLE PRECISION NOT NULL,
    "precioUnitario" DOUBLE PRECISION NOT NULL,
    "alicuotaIvaPct" DOUBLE PRECISION NOT NULL DEFAULT 21,
    "neto" DOUBLE PRECISION NOT NULL,
    "iva" DOUBLE PRECISION NOT NULL,
    "inventarioId" TEXT,
    "itemOrdenCompraId" TEXT,

    CONSTRAINT "items_factura_compra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vencimientos_pago" (
    "id" TEXT NOT NULL,
    "facturaCompraId" TEXT NOT NULL,
    "numeroCuota" INTEGER NOT NULL DEFAULT 1,
    "fecha" TIMESTAMP(3) NOT NULL,
    "monto" DOUBLE PRECISION NOT NULL,
    "saldo" DOUBLE PRECISION NOT NULL,
    "pagado" BOOLEAN NOT NULL DEFAULT false,
    "pagadoEn" TIMESTAMP(3),
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vencimientos_pago_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "facturas_compra_numero_key" ON "facturas_compra"("numero");

-- CreateIndex
CREATE UNIQUE INDEX "facturas_compra_proveedorId_puntoVenta_numeroComprobante_key" ON "facturas_compra"("proveedorId", "puntoVenta", "numeroComprobante");

-- CreateIndex
CREATE INDEX "facturas_compra_estado_idx" ON "facturas_compra"("estado");

-- CreateIndex
CREATE INDEX "facturas_compra_proveedorId_idx" ON "facturas_compra"("proveedorId");

-- CreateIndex
CREATE INDEX "facturas_compra_fecha_idx" ON "facturas_compra"("fecha");

-- CreateIndex
CREATE INDEX "facturas_compra_tipo_idx" ON "facturas_compra"("tipo");

-- CreateIndex
CREATE UNIQUE INDEX "vencimientos_pago_facturaCompraId_numeroCuota_key" ON "vencimientos_pago"("facturaCompraId", "numeroCuota");

-- CreateIndex
CREATE INDEX "vencimientos_pago_fecha_pagado_idx" ON "vencimientos_pago"("fecha", "pagado");

-- AddForeignKey
ALTER TABLE "facturas_compra" ADD CONSTRAINT "facturas_compra_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "proveedores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facturas_compra" ADD CONSTRAINT "facturas_compra_ordenCompraId_fkey" FOREIGN KEY ("ordenCompraId") REFERENCES "ordenes_compra"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facturas_compra" ADD CONSTRAINT "facturas_compra_tipoComprobanteAfipId_fkey" FOREIGN KEY ("tipoComprobanteAfipId") REFERENCES "tipos_comprobante_afip"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facturas_compra" ADD CONSTRAINT "facturas_compra_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "items_factura_compra" ADD CONSTRAINT "items_factura_compra_facturaCompraId_fkey" FOREIGN KEY ("facturaCompraId") REFERENCES "facturas_compra"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "items_factura_compra" ADD CONSTRAINT "items_factura_compra_inventarioId_fkey" FOREIGN KEY ("inventarioId") REFERENCES "inventario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "items_factura_compra" ADD CONSTRAINT "items_factura_compra_itemOrdenCompraId_fkey" FOREIGN KEY ("itemOrdenCompraId") REFERENCES "items_orden_compra"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vencimientos_pago" ADD CONSTRAINT "vencimientos_pago_facturaCompraId_fkey" FOREIGN KEY ("facturaCompraId") REFERENCES "facturas_compra"("id") ON DELETE CASCADE ON UPDATE CASCADE;
