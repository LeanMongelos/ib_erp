-- Sesión por inactividad: default 5 horas
ALTER TABLE "politica_seguridad" ALTER COLUMN "sesionMaxHoras" SET DEFAULT 5;
UPDATE "politica_seguridad" SET "sesionMaxHoras" = 5 WHERE id = 'default';
