-- Cartera de cheques recibidos en cobranzas
CREATE TYPE "EstadoChequeCobranza" AS ENUM ('EN_CARTERA', 'DEPOSITADO', 'RECHAZADO', 'ANULADO');

CREATE TABLE "cheques_cobranza" (
    "id" TEXT NOT NULL,
    "pagoId" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "banco" TEXT,
    "titular" TEXT,
    "monto" DOUBLE PRECISION NOT NULL,
    "fechaRecepcion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaVencimiento" TIMESTAMP(3) NOT NULL,
    "estado" "EstadoChequeCobranza" NOT NULL DEFAULT 'EN_CARTERA',
    "fechaDeposito" TIMESTAMP(3),
    "recordatorioEnviadoEn" TIMESTAMP(3),
    "notas" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cheques_cobranza_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "cheques_cobranza_pagoId_key" ON "cheques_cobranza"("pagoId");
CREATE INDEX "cheques_cobranza_fechaVencimiento_estado_idx" ON "cheques_cobranza"("fechaVencimiento", "estado");
CREATE INDEX "cheques_cobranza_clienteId_estado_idx" ON "cheques_cobranza"("clienteId", "estado");

ALTER TABLE "cheques_cobranza" ADD CONSTRAINT "cheques_cobranza_pagoId_fkey" FOREIGN KEY ("pagoId") REFERENCES "pagos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cheques_cobranza" ADD CONSTRAINT "cheques_cobranza_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
