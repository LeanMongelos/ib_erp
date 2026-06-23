-- CreateEnum
CREATE TYPE "NivelLog" AS ENUM ('ERROR', 'WARN', 'INFO');

-- CreateTable
CREATE TABLE "system_logs" (
    "id" TEXT NOT NULL,
    "nivel" "NivelLog" NOT NULL DEFAULT 'ERROR',
    "origen" TEXT NOT NULL,
    "ruta" TEXT,
    "metodo" TEXT,
    "mensaje" TEXT NOT NULL,
    "stack" TEXT,
    "usuarioId" TEXT,
    "ip" TEXT,
    "metadata" JSONB,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "system_logs_fecha_idx" ON "system_logs"("fecha");

-- CreateIndex
CREATE INDEX "system_logs_nivel_idx" ON "system_logs"("nivel");

-- CreateIndex
CREATE INDEX "system_logs_origen_idx" ON "system_logs"("origen");

-- CreateIndex
CREATE INDEX "system_logs_usuarioId_idx" ON "system_logs"("usuarioId");
