-- Normalizar banco vacío y resolver duplicados antes del unique (numero, banco)
UPDATE "cheques_cobranza" SET "banco" = '' WHERE "banco" IS NULL;

ALTER TABLE "cheques_cobranza" ALTER COLUMN "banco" SET NOT NULL;
ALTER TABLE "cheques_cobranza" ALTER COLUMN "banco" SET DEFAULT '';

-- Sufijo en duplicados (conserva el más antiguo)
WITH ranked AS (
  SELECT id,
    ROW_NUMBER() OVER (PARTITION BY "numero", "banco" ORDER BY "creadoEn" ASC) AS rn
  FROM "cheques_cobranza"
)
UPDATE "cheques_cobranza" c
SET "numero" = c."numero" || '-DUP-' || LEFT(c."id", 6)
FROM ranked r
WHERE c."id" = r."id" AND r.rn > 1;

CREATE UNIQUE INDEX "cheques_cobranza_numero_banco_key" ON "cheques_cobranza"("numero", "banco");
