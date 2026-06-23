-- Rename sesionMaxDias → sesionMaxHoras and enforce 8-hour default
ALTER TABLE "politica_seguridad" RENAME COLUMN "sesionMaxDias" TO "sesionMaxHoras";
ALTER TABLE "politica_seguridad" ALTER COLUMN "sesionMaxHoras" SET DEFAULT 8;
UPDATE "politica_seguridad" SET "sesionMaxHoras" = 8;
