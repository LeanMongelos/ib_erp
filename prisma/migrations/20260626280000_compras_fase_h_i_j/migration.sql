-- Fase H: bonificaciones en ítems FC y lista proveedor
ALTER TABLE "items_factura_compra" ADD COLUMN "precioLista" DOUBLE PRECISION;
ALTER TABLE "items_factura_compra" ADD COLUMN "bonificacionPct" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "proveedor_productos" ADD COLUMN "bonificacionPct" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- Fase I: moneda en pagos y nota cuando FC difiere de OC
ALTER TABLE "facturas_compra" ADD COLUMN "notaMonedaOc" TEXT;
ALTER TABLE "pagos_proveedor" ADD COLUMN "moneda" TEXT NOT NULL DEFAULT 'ARS';
