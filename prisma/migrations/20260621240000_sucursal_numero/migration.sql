-- Número de calle separado para geocodificación precisa de sucursales

ALTER TABLE "clientes_sucursales" ADD COLUMN IF NOT EXISTS "numero" TEXT;
