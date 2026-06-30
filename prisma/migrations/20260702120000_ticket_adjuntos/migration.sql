-- CreateTable
CREATE TABLE "ticket_adjuntos" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "comentarioId" TEXT,
    "url" TEXT NOT NULL,
    "nombre" TEXT,
    "mimeType" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_adjuntos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ticket_adjuntos_ticketId_idx" ON "ticket_adjuntos"("ticketId");

-- AddForeignKey
ALTER TABLE "ticket_adjuntos" ADD CONSTRAINT "ticket_adjuntos_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_adjuntos" ADD CONSTRAINT "ticket_adjuntos_comentarioId_fkey" FOREIGN KEY ("comentarioId") REFERENCES "ticket_comentarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_adjuntos" ADD CONSTRAINT "ticket_adjuntos_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
