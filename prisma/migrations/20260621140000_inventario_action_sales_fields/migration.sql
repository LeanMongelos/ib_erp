-- Campos alineados con plantilla Action Sales (importación catálogo)
ALTER TABLE "inventario" ADD COLUMN IF NOT EXISTS "codigo_barras" TEXT;
ALTER TABLE "inventario" ADD COLUMN IF NOT EXISTS "sinonimo" TEXT;
ALTER TABLE "inventario" ADD COLUMN IF NOT EXISTS "descuento_pct" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "inventario" ADD COLUMN IF NOT EXISTS "perfil" TEXT;
ALTER TABLE "inventario" ADD COLUMN IF NOT EXISTS "archivo_ref" TEXT;
