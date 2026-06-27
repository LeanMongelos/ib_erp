-- OC workflow: eventos + notificaciones persistidas

CREATE TYPE "TipoEventoOC" AS ENUM (
  'OC_CREADA',
  'OC_ENVIADA_APROBACION',
  'OC_REENVIADA',
  'OC_APROBADA',
  'OC_RECHAZADA',
  'OC_RECEPCION_PARCIAL',
  'OC_RECEPCION_COMPLETA',
  'OC_FC_REGISTRADA',
  'OC_FC_ANULADA',
  'OC_PAGO_PARCIAL',
  'OC_PAGO_COMPLETO',
  'OC_CANCELADA'
);

CREATE TYPE "TipoNotificacionOC" AS ENUM (
  'OC_PENDIENTE_APROBACION',
  'OC_APROBADA',
  'OC_RECHAZADA'
);

CREATE TABLE "eventos_orden_compra" (
  "id" TEXT NOT NULL,
  "ordenCompraId" TEXT NOT NULL,
  "tipo" "TipoEventoOC" NOT NULL,
  "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "usuarioId" TEXT,
  "referencia" TEXT,
  "payload" JSONB,

  CONSTRAINT "eventos_orden_compra_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "notificaciones_usuario" (
  "id" TEXT NOT NULL,
  "usuarioId" TEXT NOT NULL,
  "tipo" "TipoNotificacionOC" NOT NULL,
  "ordenCompraId" TEXT NOT NULL,
  "titulo" TEXT NOT NULL,
  "mensaje" TEXT NOT NULL,
  "href" TEXT NOT NULL,
  "prioridad" TEXT NOT NULL DEFAULT 'importante',
  "creadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "leidaEn" TIMESTAMP(3),
  "resueltaEn" TIMESTAMP(3),

  CONSTRAINT "notificaciones_usuario_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "eventos_orden_compra_ordenCompraId_fecha_idx" ON "eventos_orden_compra"("ordenCompraId", "fecha");

CREATE INDEX "notificaciones_usuario_usuarioId_resueltaEn_idx" ON "notificaciones_usuario"("usuarioId", "resueltaEn");

CREATE INDEX "notificaciones_usuario_ordenCompraId_tipo_idx" ON "notificaciones_usuario"("ordenCompraId", "tipo");

ALTER TABLE "eventos_orden_compra" ADD CONSTRAINT "eventos_orden_compra_ordenCompraId_fkey" FOREIGN KEY ("ordenCompraId") REFERENCES "ordenes_compra"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "eventos_orden_compra" ADD CONSTRAINT "eventos_orden_compra_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "notificaciones_usuario" ADD CONSTRAINT "notificaciones_usuario_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "notificaciones_usuario" ADD CONSTRAINT "notificaciones_usuario_ordenCompraId_fkey" FOREIGN KEY ("ordenCompraId") REFERENCES "ordenes_compra"("id") ON DELETE CASCADE ON UPDATE CASCADE;
