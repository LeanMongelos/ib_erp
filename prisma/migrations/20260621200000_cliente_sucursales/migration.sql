-- Sucursales / sedes de instalación por cliente (distintas de la dirección fiscal)

CREATE TABLE IF NOT EXISTS "clientes_sucursales" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "direccion" TEXT,
    "ciudad" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "notas" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clientes_sucursales_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "clientes_sucursales_clienteId_idx" ON "clientes_sucursales"("clienteId");

ALTER TABLE "clientes_sucursales" ADD CONSTRAINT "clientes_sucursales_clienteId_fkey"
    FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "equipos" ADD COLUMN IF NOT EXISTS "sucursalId" TEXT;
CREATE INDEX IF NOT EXISTS "equipos_sucursalId_idx" ON "equipos"("sucursalId");
ALTER TABLE "equipos" ADD CONSTRAINT "equipos_sucursalId_fkey"
    FOREIGN KEY ("sucursalId") REFERENCES "clientes_sucursales"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "items_factura" ADD COLUMN IF NOT EXISTS "sucursalInstalacionId" TEXT;
ALTER TABLE "items_factura" ADD CONSTRAINT "items_factura_sucursalInstalacionId_fkey"
    FOREIGN KEY ("sucursalInstalacionId") REFERENCES "clientes_sucursales"("id") ON DELETE SET NULL ON UPDATE CASCADE;
