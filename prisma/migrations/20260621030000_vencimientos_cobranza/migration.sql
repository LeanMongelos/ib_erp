-- CreateEnum
CREATE TYPE "EstadoVencimientoCobranza" AS ENUM ('PENDIENTE', 'AVISO_ENVIADO', 'COBRADO', 'ANULADO');

-- CreateTable
CREATE TABLE "vencimientos_cobranza" (
    "id" TEXT NOT NULL,
    "facturaId" TEXT NOT NULL,
    "numeroCuota" INTEGER NOT NULL,
    "diasDesdeEmision" INTEGER NOT NULL,
    "fechaVencimiento" TIMESTAMP(3) NOT NULL,
    "monto" DOUBLE PRECISION NOT NULL,
    "estado" "EstadoVencimientoCobranza" NOT NULL DEFAULT 'PENDIENTE',
    "avisoEnviadoEn" TIMESTAMP(3),
    "cobradoEn" TIMESTAMP(3),
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vencimientos_cobranza_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "vencimientos_cobranza_fechaVencimiento_estado_idx" ON "vencimientos_cobranza"("fechaVencimiento", "estado");

-- CreateIndex
CREATE UNIQUE INDEX "vencimientos_cobranza_facturaId_numeroCuota_key" ON "vencimientos_cobranza"("facturaId", "numeroCuota");

-- AddForeignKey
ALTER TABLE "vencimientos_cobranza" ADD CONSTRAINT "vencimientos_cobranza_facturaId_fkey" FOREIGN KEY ("facturaId") REFERENCES "facturas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
