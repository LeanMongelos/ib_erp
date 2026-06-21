-- ItemPresupuesto: campos de equipo (serie, preventivo) + FK inventario
ALTER TABLE "items_presupuesto" ADD COLUMN IF NOT EXISTS "numeroSerie" TEXT;
ALTER TABLE "items_presupuesto" ADD COLUMN IF NOT EXISTS "proximoPreventivo" TIMESTAMP(3);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'items_presupuesto_inventarioId_fkey') THEN
    ALTER TABLE "items_presupuesto" ADD CONSTRAINT "items_presupuesto_inventarioId_fkey"
      FOREIGN KEY ("inventarioId") REFERENCES "inventario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
