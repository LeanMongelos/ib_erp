-- Secuencias de numeración configurables (migración desde otro sistema)

CREATE TABLE "secuencias_numeracion" (
    "id" TEXT NOT NULL,
    "clave" TEXT NOT NULL,
    "etiqueta" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "subtipo" TEXT,
    "anio" INTEGER,
    "prefijo" TEXT NOT NULL,
    "padding" INTEGER NOT NULL DEFAULT 4,
    "proximoNumero" INTEGER NOT NULL DEFAULT 1,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "secuencias_numeracion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "secuencias_numeracion_clave_key" ON "secuencias_numeracion"("clave");
