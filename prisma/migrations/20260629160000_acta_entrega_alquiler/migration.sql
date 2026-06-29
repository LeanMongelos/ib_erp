-- CreateTable
CREATE TABLE "actas_entrega_alquiler" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "contratoId" TEXT NOT NULL,
    "lineaId" TEXT NOT NULL,
    "facturaId" TEXT,
    "clienteNombre" TEXT NOT NULL,
    "clienteDni" TEXT,
    "clienteDireccion" TEXT,
    "clienteTelefono" TEXT,
    "equipoNombre" TEXT NOT NULL,
    "numeroSerie" TEXT,
    "fechaActa" TIMESTAMP(3) NOT NULL,
    "lugar" TEXT NOT NULL DEFAULT 'Formosa',
    "montoAlquiler" DOUBLE PRECISION NOT NULL,
    "periodoAlquiler" TEXT NOT NULL,
    "montoDepositoGarantia" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "observaciones" TEXT,
    "creadoPorId" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "actas_entrega_alquiler_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "actas_entrega_alquiler_numero_key" ON "actas_entrega_alquiler"("numero");

-- CreateIndex
CREATE INDEX "actas_entrega_alquiler_contratoId_idx" ON "actas_entrega_alquiler"("contratoId");

-- CreateIndex
CREATE INDEX "actas_entrega_alquiler_lineaId_idx" ON "actas_entrega_alquiler"("lineaId");

-- AddForeignKey
ALTER TABLE "actas_entrega_alquiler" ADD CONSTRAINT "actas_entrega_alquiler_contratoId_fkey" FOREIGN KEY ("contratoId") REFERENCES "contratos_alquiler"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "actas_entrega_alquiler" ADD CONSTRAINT "actas_entrega_alquiler_lineaId_fkey" FOREIGN KEY ("lineaId") REFERENCES "lineas_alquiler"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "actas_entrega_alquiler" ADD CONSTRAINT "actas_entrega_alquiler_facturaId_fkey" FOREIGN KEY ("facturaId") REFERENCES "facturas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "actas_entrega_alquiler" ADD CONSTRAINT "actas_entrega_alquiler_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
