-- Plazos de cobranza con tasa e interés de financiación en presupuestos
ALTER TABLE "presupuestos" ADD COLUMN "tasaFinanciacionPct" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "presupuestos" ADD COLUMN "interesFinanciacion" DOUBLE PRECISION NOT NULL DEFAULT 0;
