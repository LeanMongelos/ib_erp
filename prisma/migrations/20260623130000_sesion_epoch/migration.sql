-- Invalidación global de sesiones JWT (incrementar sesionEpoch fuerza re-login)
ALTER TABLE "politica_seguridad" ADD COLUMN "sesionEpoch" INTEGER NOT NULL DEFAULT 1;
