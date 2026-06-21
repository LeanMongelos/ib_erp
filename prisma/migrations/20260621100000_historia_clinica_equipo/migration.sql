-- Historia clínica del equipo (Servicio Técnico)

CREATE TYPE "TipoComponenteEquipo" AS ENUM ('BATERIA', 'FILTRO', 'CALIBRACION', 'SENSOR', 'OTRO');
CREATE TYPE "TipoEntradaHistoriaClinica" AS ENUM ('OT', 'PREVENTIVO', 'NOTA', 'INSTALACION', 'COMPONENTE', 'TRACKING', 'CAMBIO_ESTADO');

ALTER TABLE "equipos" ADD COLUMN IF NOT EXISTS "modeloExacto" TEXT;
ALTER TABLE "equipos" ADD COLUMN IF NOT EXISTS "codigoInterno" TEXT;
ALTER TABLE "equipos" ADD COLUMN IF NOT EXISTS "firmwareVersion" TEXT;
ALTER TABLE "equipos" ADD COLUMN IF NOT EXISTS "softwareVersion" TEXT;
ALTER TABLE "equipos" ADD COLUMN IF NOT EXISTS "fechaInstalacion" TIMESTAMP(3);
ALTER TABLE "equipos" ADD COLUMN IF NOT EXISTS "servicioInstalacion" TEXT;
ALTER TABLE "equipos" ADD COLUMN IF NOT EXISTS "pisoSala" TEXT;
ALTER TABLE "equipos" ADD COLUMN IF NOT EXISTS "contactoResponsable" TEXT;
ALTER TABLE "equipos" ADD COLUMN IF NOT EXISTS "notasTecnicas" TEXT;
ALTER TABLE "equipos" ADD COLUMN IF NOT EXISTS "proveedorOrigenId" TEXT;
ALTER TABLE "equipos" ADD COLUMN IF NOT EXISTS "referenciaCompra" TEXT;
ALTER TABLE "equipos" ADD COLUMN IF NOT EXISTS "instaladoPorUsuarioId" TEXT;

ALTER TABLE "equipos" ADD CONSTRAINT "equipos_proveedorOrigenId_fkey"
  FOREIGN KEY ("proveedorOrigenId") REFERENCES "proveedores"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "equipos" ADD CONSTRAINT "equipos_instaladoPorUsuarioId_fkey"
  FOREIGN KEY ("instaladoPorUsuarioId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "equipo_accesorios" (
    "id" TEXT NOT NULL,
    "equipoId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "inventarioId" TEXT,
    "cantidad" INTEGER NOT NULL DEFAULT 1,
    "obligatorio" BOOLEAN NOT NULL DEFAULT true,
    "notas" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "equipo_accesorios_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "equipo_componentes" (
    "id" TEXT NOT NULL,
    "equipoId" TEXT NOT NULL,
    "tipo" "TipoComponenteEquipo" NOT NULL DEFAULT 'OTRO',
    "descripcion" TEXT NOT NULL,
    "numeroSerie" TEXT,
    "instaladoEn" TIMESTAMP(3),
    "venceEn" TIMESTAMP(3),
    "alertaDiasAntes" INTEGER NOT NULL DEFAULT 30,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "notas" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "equipo_componentes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "historia_clinica_entradas" (
    "id" TEXT NOT NULL,
    "equipoId" TEXT NOT NULL,
    "tipo" "TipoEntradaHistoriaClinica" NOT NULL,
    "titulo" TEXT NOT NULL,
    "contenido" TEXT,
    "referenciaId" TEXT,
    "usuarioId" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "historia_clinica_entradas_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "equipo_accesorios_equipoId_idx" ON "equipo_accesorios"("equipoId");
CREATE INDEX "equipo_componentes_equipoId_idx" ON "equipo_componentes"("equipoId");
CREATE INDEX "equipo_componentes_venceEn_idx" ON "equipo_componentes"("venceEn");
CREATE INDEX "historia_clinica_entradas_equipoId_fecha_idx" ON "historia_clinica_entradas"("equipoId", "fecha");

ALTER TABLE "equipo_accesorios" ADD CONSTRAINT "equipo_accesorios_equipoId_fkey"
  FOREIGN KEY ("equipoId") REFERENCES "equipos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "equipo_accesorios" ADD CONSTRAINT "equipo_accesorios_inventarioId_fkey"
  FOREIGN KEY ("inventarioId") REFERENCES "inventario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "equipo_componentes" ADD CONSTRAINT "equipo_componentes_equipoId_fkey"
  FOREIGN KEY ("equipoId") REFERENCES "equipos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "historia_clinica_entradas" ADD CONSTRAINT "historia_clinica_entradas_equipoId_fkey"
  FOREIGN KEY ("equipoId") REFERENCES "equipos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "historia_clinica_entradas" ADD CONSTRAINT "historia_clinica_entradas_usuarioId_fkey"
  FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
