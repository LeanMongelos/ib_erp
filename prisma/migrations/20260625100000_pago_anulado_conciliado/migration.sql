-- AlterTable
ALTER TABLE "pagos" ADD COLUMN "anuladoEn" TIMESTAMP(3),
ADD COLUMN "conciliadoEn" TIMESTAMP(3),
ADD COLUMN "conciliadoPorId" TEXT;

-- CreateIndex
CREATE INDEX "pagos_anuladoEn_idx" ON "pagos"("anuladoEn");

-- CreateIndex
CREATE INDEX "pagos_conciliadoEn_idx" ON "pagos"("conciliadoEn");

-- AddForeignKey
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_conciliadoPorId_fkey" FOREIGN KEY ("conciliadoPorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
