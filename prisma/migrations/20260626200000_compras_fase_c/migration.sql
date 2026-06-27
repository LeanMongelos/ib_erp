-- CreateEnum
CREATE TYPE "EstadoPagoProveedor" AS ENUM ('REGISTRADO', 'ANULADO');

-- CreateEnum
CREATE TYPE "EstadoChequeEmitido" AS ENUM ('EMITIDO', 'DEBITADO', 'ANULADO');

-- AlterTable
ALTER TABLE "ordenes_compra" ADD COLUMN "ultimaRecepcionEn" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "pagos_proveedor" (
    "id" TEXT NOT NULL,
    "proveedorId" TEXT NOT NULL,
    "facturaCompraId" TEXT,
    "monto" DOUBLE PRECISION NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "medio" "MedioPago" NOT NULL DEFAULT 'TRANSFERENCIA',
    "cuentaTesoreriaId" TEXT,
    "referencia" TEXT,
    "notas" TEXT,
    "estado" "EstadoPagoProveedor" NOT NULL DEFAULT 'REGISTRADO',
    "creadoPorId" TEXT NOT NULL,
    "anuladoEn" TIMESTAMP(3),
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pagos_proveedor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imputaciones_pago_proveedor" (
    "id" TEXT NOT NULL,
    "pagoProveedorId" TEXT NOT NULL,
    "vencimientoPagoId" TEXT NOT NULL,
    "monto" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "imputaciones_pago_proveedor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cheques_emitidos" (
    "id" TEXT NOT NULL,
    "pagoProveedorId" TEXT,
    "proveedorId" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "banco" TEXT NOT NULL DEFAULT '',
    "monto" DOUBLE PRECISION NOT NULL,
    "fechaEmision" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaDebito" TIMESTAMP(3),
    "estado" "EstadoChequeEmitido" NOT NULL DEFAULT 'EMITIDO',
    "cuentaTesoreriaId" TEXT NOT NULL,
    "movimientoTesoreriaId" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cheques_emitidos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pagos_proveedor_proveedorId_estado_idx" ON "pagos_proveedor"("proveedorId", "estado");

-- CreateIndex
CREATE INDEX "pagos_proveedor_fecha_idx" ON "pagos_proveedor"("fecha");

-- CreateIndex
CREATE INDEX "pagos_proveedor_cuentaTesoreriaId_idx" ON "pagos_proveedor"("cuentaTesoreriaId");

-- CreateIndex
CREATE INDEX "imputaciones_pago_proveedor_vencimientoPagoId_idx" ON "imputaciones_pago_proveedor"("vencimientoPagoId");

-- CreateIndex
CREATE UNIQUE INDEX "cheques_emitidos_pagoProveedorId_key" ON "cheques_emitidos"("pagoProveedorId");

-- CreateIndex
CREATE UNIQUE INDEX "cheques_emitidos_movimientoTesoreriaId_key" ON "cheques_emitidos"("movimientoTesoreriaId");

-- CreateIndex
CREATE UNIQUE INDEX "cheques_emitidos_numero_banco_key" ON "cheques_emitidos"("numero", "banco");

-- CreateIndex
CREATE INDEX "cheques_emitidos_fechaDebito_estado_idx" ON "cheques_emitidos"("fechaDebito", "estado");

-- CreateIndex
CREATE INDEX "cheques_emitidos_proveedorId_estado_idx" ON "cheques_emitidos"("proveedorId", "estado");

-- CreateIndex
CREATE UNIQUE INDEX "movimientos_tesoreria_pagoProveedorId_key" ON "movimientos_tesoreria"("pagoProveedorId");

-- AddForeignKey
ALTER TABLE "pagos_proveedor" ADD CONSTRAINT "pagos_proveedor_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "proveedores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos_proveedor" ADD CONSTRAINT "pagos_proveedor_facturaCompraId_fkey" FOREIGN KEY ("facturaCompraId") REFERENCES "facturas_compra"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos_proveedor" ADD CONSTRAINT "pagos_proveedor_cuentaTesoreriaId_fkey" FOREIGN KEY ("cuentaTesoreriaId") REFERENCES "cuentas_tesoreria"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos_proveedor" ADD CONSTRAINT "pagos_proveedor_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imputaciones_pago_proveedor" ADD CONSTRAINT "imputaciones_pago_proveedor_pagoProveedorId_fkey" FOREIGN KEY ("pagoProveedorId") REFERENCES "pagos_proveedor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imputaciones_pago_proveedor" ADD CONSTRAINT "imputaciones_pago_proveedor_vencimientoPagoId_fkey" FOREIGN KEY ("vencimientoPagoId") REFERENCES "vencimientos_pago"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cheques_emitidos" ADD CONSTRAINT "cheques_emitidos_pagoProveedorId_fkey" FOREIGN KEY ("pagoProveedorId") REFERENCES "pagos_proveedor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cheques_emitidos" ADD CONSTRAINT "cheques_emitidos_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "proveedores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cheques_emitidos" ADD CONSTRAINT "cheques_emitidos_cuentaTesoreriaId_fkey" FOREIGN KEY ("cuentaTesoreriaId") REFERENCES "cuentas_tesoreria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cheques_emitidos" ADD CONSTRAINT "cheques_emitidos_movimientoTesoreriaId_fkey" FOREIGN KEY ("movimientoTesoreriaId") REFERENCES "movimientos_tesoreria"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_tesoreria" ADD CONSTRAINT "movimientos_tesoreria_pagoProveedorId_fkey" FOREIGN KEY ("pagoProveedorId") REFERENCES "pagos_proveedor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
