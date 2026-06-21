-- Migración: importes de dinero de Float (DoublePrecision) a Decimal(14,2)
-- El cast de double precision a numeric es seguro (Postgres lo realiza con redondeo a la escala).

-- AlterTable
ALTER TABLE "facturas"
  ALTER COLUMN "subtotal" SET DATA TYPE DECIMAL(14,2),
  ALTER COLUMN "iva"      SET DATA TYPE DECIMAL(14,2),
  ALTER COLUMN "total"    SET DATA TYPE DECIMAL(14,2);

-- AlterTable
ALTER TABLE "items_factura"
  ALTER COLUMN "precioUnit" SET DATA TYPE DECIMAL(14,2),
  ALTER COLUMN "subtotal"   SET DATA TYPE DECIMAL(14,2);

-- AlterTable
ALTER TABLE "repuestos_ot"
  ALTER COLUMN "precioUnit" SET DATA TYPE DECIMAL(14,2);

-- AlterTable
ALTER TABLE "inventario"
  ALTER COLUMN "precioUnit" SET DATA TYPE DECIMAL(14,2);
