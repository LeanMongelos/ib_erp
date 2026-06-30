-- Ajuste negativo de stock (baja / obsoleto) distinto de salida operativa
ALTER TYPE "TipoMovimientoStock" ADD VALUE IF NOT EXISTS 'AJUSTE_NEGATIVO';
