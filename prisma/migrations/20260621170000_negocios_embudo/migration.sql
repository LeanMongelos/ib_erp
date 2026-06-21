-- CreateEnum
CREATE TYPE "EtapaEmbudo" AS ENUM ('ENTRADA', 'CONTACTO', 'DOCUMENTACION', 'PROPUESTA', 'SEGUIMIENTO', 'ANALISIS', 'ENTREGA', 'CIERRE');

-- CreateEnum
CREATE TYPE "UrgenciaEmbudo" AS ENUM ('NORMAL', 'URGENTE');

-- CreateTable
CREATE TABLE "negocios_embudo" (
    "id" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "cliente" TEXT NOT NULL,
    "clienteId" TEXT,
    "productoServicio" TEXT,
    "monto" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "vendedor" TEXT NOT NULL,
    "urgencia" "UrgenciaEmbudo" NOT NULL DEFAULT 'NORMAL',
    "etapa" "EtapaEmbudo" NOT NULL DEFAULT 'ENTRADA',
    "etapaDesde" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "proximaAccionFecha" TIMESTAMP(3),
    "presupuestoId" TEXT,
    "notas" TEXT,
    "datos" JSONB NOT NULL DEFAULT '{}',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "cerradoEn" TIMESTAMP(3),
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "negocios_embudo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "historial_embudo" (
    "id" TEXT NOT NULL,
    "negocioId" TEXT NOT NULL,
    "etapaDesde" "EtapaEmbudo" NOT NULL,
    "etapaHasta" "EtapaEmbudo" NOT NULL,
    "retroceso" BOOLEAN NOT NULL DEFAULT false,
    "datos" JSONB NOT NULL DEFAULT '{}',
    "notas" TEXT,
    "usuarioId" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "historial_embudo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "negocios_embudo_numero_key" ON "negocios_embudo"("numero");

-- CreateIndex
CREATE INDEX "negocios_embudo_etapa_idx" ON "negocios_embudo"("etapa");

-- CreateIndex
CREATE INDEX "negocios_embudo_vendedor_idx" ON "negocios_embudo"("vendedor");

-- CreateIndex
CREATE INDEX "historial_embudo_negocioId_idx" ON "historial_embudo"("negocioId");

-- AddForeignKey
ALTER TABLE "negocios_embudo" ADD CONSTRAINT "negocios_embudo_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "negocios_embudo" ADD CONSTRAINT "negocios_embudo_presupuestoId_fkey" FOREIGN KEY ("presupuestoId") REFERENCES "presupuestos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historial_embudo" ADD CONSTRAINT "historial_embudo_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "negocios_embudo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historial_embudo" ADD CONSTRAINT "historial_embudo_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
