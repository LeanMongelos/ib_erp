-- Renombrar descuento global → ajuste global (negativo = descuento, positivo = recargo)
ALTER TABLE "listas_precios" RENAME COLUMN "descuentoGlobalPct" TO "ajusteGlobalPct";

-- Valores positivos eran descuentos: convertir a ajuste negativo
UPDATE "listas_precios" SET "ajusteGlobalPct" = -"ajusteGlobalPct" WHERE "ajusteGlobalPct" > 0;

ALTER TABLE "listas_precios" ADD COLUMN "notas" TEXT;
