-- Fase 9: CRM omnicanal

CREATE TYPE "TipoCanalIntegracion" AS ENUM ('WHATSAPP', 'INSTAGRAM', 'FACEBOOK', 'EMAIL_IMAP', 'EMAIL_GRAPH', 'N8N');
CREATE TYPE "EstadoCanalIntegracion" AS ENUM ('NO_CONFIGURADO', 'PENDIENTE', 'CONECTADO', 'ERROR');
CREATE TYPE "EstadoConversacionCRM" AS ENUM ('ABIERTA', 'PENDIENTE', 'CERRADA');
CREATE TYPE "DireccionMensajeCRM" AS ENUM ('ENTRANTE', 'SALIENTE');

CREATE TABLE IF NOT EXISTS "canales_integracion" (
  "id" TEXT NOT NULL,
  "tipo" "TipoCanalIntegracion" NOT NULL,
  "nombre" TEXT NOT NULL,
  "activo" BOOLEAN NOT NULL DEFAULT false,
  "estado" "EstadoCanalIntegracion" NOT NULL DEFAULT 'NO_CONFIGURADO',
  "config" JSONB NOT NULL DEFAULT '{}',
  "webhookUrl" TEXT,
  "pasoCompletado" INTEGER NOT NULL DEFAULT 0,
  "ultimoSync" TIMESTAMP(3),
  "errorMensaje" TEXT,
  "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "actualizadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "canales_integracion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "canales_integracion_tipo_key" ON "canales_integracion"("tipo");

CREATE TABLE IF NOT EXISTS "conversaciones_crm" (
  "id" TEXT NOT NULL,
  "canalId" TEXT NOT NULL,
  "externalId" TEXT,
  "estado" "EstadoConversacionCRM" NOT NULL DEFAULT 'ABIERTA',
  "asignadoId" TEXT,
  "clienteId" TEXT,
  "contactoNombre" TEXT NOT NULL,
  "contactoHandle" TEXT NOT NULL,
  "preview" TEXT,
  "etiquetas" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "sinLeer" INTEGER NOT NULL DEFAULT 0,
  "ultimoMensajeEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "conversaciones_crm_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "conversaciones_crm_canalId_idx" ON "conversaciones_crm"("canalId");
CREATE INDEX IF NOT EXISTS "conversaciones_crm_estado_idx" ON "conversaciones_crm"("estado");
CREATE INDEX IF NOT EXISTS "conversaciones_crm_ultimoMensajeEn_idx" ON "conversaciones_crm"("ultimoMensajeEn");

CREATE TABLE IF NOT EXISTS "mensajes_crm" (
  "id" TEXT NOT NULL,
  "conversacionId" TEXT NOT NULL,
  "direccion" "DireccionMensajeCRM" NOT NULL,
  "tipo" TEXT NOT NULL DEFAULT 'TEXTO',
  "contenido" TEXT NOT NULL,
  "adjuntoUrl" TEXT,
  "externalMsgId" TEXT,
  "usuarioId" TEXT,
  "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "mensajes_crm_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "mensajes_crm_conversacionId_idx" ON "mensajes_crm"("conversacionId");

ALTER TABLE "conversaciones_crm" ADD CONSTRAINT "conversaciones_crm_canalId_fkey"
  FOREIGN KEY ("canalId") REFERENCES "canales_integracion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "conversaciones_crm" ADD CONSTRAINT "conversaciones_crm_clienteId_fkey"
  FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "conversaciones_crm" ADD CONSTRAINT "conversaciones_crm_asignadoId_fkey"
  FOREIGN KEY ("asignadoId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "mensajes_crm" ADD CONSTRAINT "mensajes_crm_conversacionId_fkey"
  FOREIGN KEY ("conversacionId") REFERENCES "conversaciones_crm"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "mensajes_crm" ADD CONSTRAINT "mensajes_crm_usuarioId_fkey"
  FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
