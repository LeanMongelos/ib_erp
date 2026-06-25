-- CreateEnum
CREATE TYPE "TipoEventoEmbudo" AS ENUM ('MOVIMIENTO', 'CREACION', 'EDICION', 'ELIMINACION', 'REACTIVACION');

-- AlterTable
ALTER TABLE "historial_embudo" ADD COLUMN "tipo" "TipoEventoEmbudo" NOT NULL DEFAULT 'MOVIMIENTO';
ALTER TABLE "historial_embudo" ALTER COLUMN "etapaDesde" DROP NOT NULL;
ALTER TABLE "historial_embudo" ALTER COLUMN "etapaHasta" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "historial_embudo_tipo_idx" ON "historial_embudo"("tipo");
CREATE INDEX "historial_embudo_creadoEn_idx" ON "historial_embudo"("creadoEn");
