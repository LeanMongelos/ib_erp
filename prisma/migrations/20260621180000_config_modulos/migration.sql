-- Catálogos maestros, notificaciones y política de seguridad

CREATE TABLE "categorias_inventario_cat" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "categorias_inventario_cat_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "categorias_inventario_cat_codigo_key" ON "categorias_inventario_cat"("codigo");

CREATE TABLE "politica_seguridad" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "longitudMinPassword" INTEGER NOT NULL DEFAULT 8,
    "requiereMayuscula" BOOLEAN NOT NULL DEFAULT true,
    "requiereNumero" BOOLEAN NOT NULL DEFAULT true,
    "requiereEspecial" BOOLEAN NOT NULL DEFAULT false,
    "expiracionDias" INTEGER,
    "maxIntentosLogin" INTEGER NOT NULL DEFAULT 5,
    "bloqueoMinutos" INTEGER NOT NULL DEFAULT 15,
    "maxIntentosIpHora" INTEGER NOT NULL DEFAULT 30,
    "sesionMaxDias" INTEGER NOT NULL DEFAULT 30,
    "totpHabilitado" BOOLEAN NOT NULL DEFAULT false,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "politica_seguridad_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "plantillas_notificacion" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "canal" TEXT NOT NULL DEFAULT 'SISTEMA',
    "asunto" TEXT,
    "cuerpo" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "plantillas_notificacion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "plantillas_notificacion_codigo_key" ON "plantillas_notificacion"("codigo");

CREATE TABLE "reglas_notificacion" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "evento" TEXT NOT NULL,
    "diasAnticipacion" INTEGER,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "plantillaId" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "reglas_notificacion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "reglas_notificacion_codigo_key" ON "reglas_notificacion"("codigo");

ALTER TABLE "reglas_notificacion" ADD CONSTRAINT "reglas_notificacion_plantillaId_fkey" FOREIGN KEY ("plantillaId") REFERENCES "plantillas_notificacion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "politica_seguridad" ("id", "actualizadoEn") VALUES ('default', CURRENT_TIMESTAMP);
