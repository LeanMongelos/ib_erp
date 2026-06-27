-- CreateEnum
CREATE TYPE "TipoCuentaTesoreria" AS ENUM ('BANCO', 'CAJA');

-- CreateEnum
CREATE TYPE "TipoMovimientoTesoreria" AS ENUM ('SALDO_INICIAL', 'INGRESO', 'EGRESO', 'AJUSTE', 'TRANSFERENCIA');

-- CreateTable
CREATE TABLE "cuentas_tesoreria" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" "TipoCuentaTesoreria" NOT NULL,
    "banco" TEXT,
    "cbu" TEXT,
    "alias" TEXT,
    "moneda" TEXT NOT NULL DEFAULT 'ARS',
    "planCuentaId" TEXT,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "saldoInicialCargado" BOOLEAN NOT NULL DEFAULT false,
    "predeterminada" BOOLEAN NOT NULL DEFAULT false,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cuentas_tesoreria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movimientos_tesoreria" (
    "id" TEXT NOT NULL,
    "cuentaTesoreriaId" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "tipo" "TipoMovimientoTesoreria" NOT NULL,
    "monto" DOUBLE PRECISION NOT NULL,
    "descripcion" TEXT NOT NULL,
    "referencia" TEXT,
    "conciliadoEn" TIMESTAMP(3),
    "conciliadoPorId" TEXT,
    "extractoRef" TEXT,
    "notaConciliacion" TEXT,
    "pagoId" TEXT,
    "pagoProveedorId" TEXT,
    "anuladoEn" TIMESTAMP(3),
    "transferenciaId" TEXT,
    "creadoPorId" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "movimientos_tesoreria_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "pagos" ADD COLUMN "cuentaTesoreriaId" TEXT;

-- CreateIndex
CREATE INDEX "pagos_cuentaTesoreriaId_idx" ON "pagos"("cuentaTesoreriaId");

-- CreateIndex
CREATE UNIQUE INDEX "movimientos_tesoreria_pagoId_key" ON "movimientos_tesoreria"("pagoId");

-- CreateIndex
CREATE INDEX "movimientos_tesoreria_cuentaTesoreriaId_fecha_idx" ON "movimientos_tesoreria"("cuentaTesoreriaId", "fecha");

-- CreateIndex
CREATE INDEX "movimientos_tesoreria_conciliadoEn_idx" ON "movimientos_tesoreria"("conciliadoEn");

-- AddForeignKey
ALTER TABLE "cuentas_tesoreria" ADD CONSTRAINT "cuentas_tesoreria_planCuentaId_fkey" FOREIGN KEY ("planCuentaId") REFERENCES "plan_cuentas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_tesoreria" ADD CONSTRAINT "movimientos_tesoreria_cuentaTesoreriaId_fkey" FOREIGN KEY ("cuentaTesoreriaId") REFERENCES "cuentas_tesoreria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_tesoreria" ADD CONSTRAINT "movimientos_tesoreria_pagoId_fkey" FOREIGN KEY ("pagoId") REFERENCES "pagos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_tesoreria" ADD CONSTRAINT "movimientos_tesoreria_conciliadoPorId_fkey" FOREIGN KEY ("conciliadoPorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_tesoreria" ADD CONSTRAINT "movimientos_tesoreria_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_cuentaTesoreriaId_fkey" FOREIGN KEY ("cuentaTesoreriaId") REFERENCES "cuentas_tesoreria"("id") ON DELETE SET NULL ON UPDATE CASCADE;
