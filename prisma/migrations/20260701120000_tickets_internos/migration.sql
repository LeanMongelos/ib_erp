-- CreateEnum
CREATE TYPE "TipoTicket" AS ENUM ('ERROR_SISTEMA', 'CORRECCION_DATOS', 'MEJORA_ERP', 'CONSULTA', 'OTRO');

-- CreateEnum
CREATE TYPE "AreaTicket" AS ENUM ('ADMINISTRACION', 'GERENCIA', 'SERVICIO_TECNICO', 'VENTAS', 'FACTURACION', 'CONTABILIDAD', 'DESARROLLO');

-- CreateEnum
CREATE TYPE "EstadoTicket" AS ENUM ('ABIERTA', 'EN_REVISION', 'EN_PROGRESO', 'ESPERANDO_INFO', 'RESUELTA', 'CERRADA', 'CANCELADA');

-- CreateTable
CREATE TABLE "tickets" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "tipo" "TipoTicket" NOT NULL,
    "areaOrigen" "AreaTicket" NOT NULL,
    "areaDestino" "AreaTicket" NOT NULL DEFAULT 'DESARROLLO',
    "estado" "EstadoTicket" NOT NULL DEFAULT 'ABIERTA',
    "prioridad" "Prioridad" NOT NULL DEFAULT 'NORMAL',
    "solicitanteId" TEXT NOT NULL,
    "asignadoId" TEXT,
    "entidadTipo" TEXT,
    "entidadId" TEXT,
    "resolucion" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,
    "cerradoEn" TIMESTAMP(3),

    CONSTRAINT "tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_comentarios" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "esInterno" BOOLEAN NOT NULL DEFAULT false,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_comentarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_historial" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "estado" "EstadoTicket" NOT NULL,
    "nota" TEXT,
    "usuarioId" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_historial_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tickets_numero_key" ON "tickets"("numero");

-- CreateIndex
CREATE INDEX "tickets_estado_idx" ON "tickets"("estado");

-- CreateIndex
CREATE INDEX "tickets_solicitanteId_idx" ON "tickets"("solicitanteId");

-- CreateIndex
CREATE INDEX "tickets_asignadoId_idx" ON "tickets"("asignadoId");

-- CreateIndex
CREATE INDEX "tickets_areaOrigen_idx" ON "tickets"("areaOrigen");

-- CreateIndex
CREATE INDEX "ticket_comentarios_ticketId_idx" ON "ticket_comentarios"("ticketId");

-- CreateIndex
CREATE INDEX "ticket_historial_ticketId_idx" ON "ticket_historial"("ticketId");

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_solicitanteId_fkey" FOREIGN KEY ("solicitanteId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_asignadoId_fkey" FOREIGN KEY ("asignadoId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_comentarios" ADD CONSTRAINT "ticket_comentarios_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_comentarios" ADD CONSTRAINT "ticket_comentarios_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_historial" ADD CONSTRAINT "ticket_historial_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_historial" ADD CONSTRAINT "ticket_historial_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
