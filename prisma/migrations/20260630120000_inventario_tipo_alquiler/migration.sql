-- Tipo ALQUILER en catálogo + migrar productos ALQ* existentes
ALTER TYPE "TipoArticuloInventario" ADD VALUE 'ALQUILER';

UPDATE "inventario"
SET
  "tipoArticulo" = 'ALQUILER',
  "esSerializado" = true,
  "modoTrazabilidad" = 'SERIE'
WHERE upper("sku") LIKE 'ALQ%'
  AND "tipoArticulo"::text <> 'ALQUILER';
