CREATE TABLE "notificaciones_leidas" (
    "usuarioId" TEXT NOT NULL,
    "clave" TEXT NOT NULL,
    "leidaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "notificaciones_leidas_pkey" PRIMARY KEY ("usuarioId","clave")
);
