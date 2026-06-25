-- CreateTable
CREATE TABLE "crm_snippets" (
    "id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "cuerpo" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_snippets_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "crm_snippets_activo_orden_idx" ON "crm_snippets"("activo", "orden");
