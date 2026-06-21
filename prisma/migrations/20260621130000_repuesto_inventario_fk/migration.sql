-- AlterTable
ALTER TABLE "repuestos_ot" ADD COLUMN IF NOT EXISTS "inventarioId" TEXT;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'repuestos_ot_inventarioId_fkey'
  ) THEN
    ALTER TABLE "repuestos_ot"
      ADD CONSTRAINT "repuestos_ot_inventarioId_fkey"
      FOREIGN KEY ("inventarioId") REFERENCES "inventario"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
