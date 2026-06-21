-- Fases 3-7: presupuestos, plantillas, AFIP fields, cobranzas, inventario avanzado, OC, preventivo
-- Migración ADITIVA: no altera columnas monetarias existentes.

-- Enums nuevos
CREATE TYPE "TipoPlantilla" AS ENUM ('FACTURA', 'PRESUPUESTO', 'REMITO', 'NOTA_CREDITO', 'NOTA_DEBITO');
CREATE TYPE "EstadoPresupuesto" AS ENUM ('BORRADOR', 'ENVIADO', 'APROBADO', 'RECHAZADO', 'VENCIDO', 'CONVERTIDO');
CREATE TYPE "MedioPago" AS ENUM ('TRANSFERENCIA', 'EFECTIVO', 'CHEQUE', 'TARJETA', 'OTRO');
CREATE TYPE "EstadoOrdenCompra" AS ENUM ('BORRADOR', 'ENVIADA', 'APROBADA', 'PARCIAL', 'RECIBIDA', 'CANCELADA');
CREATE TYPE "TipoMovimientoStock" AS ENUM ('ENTRADA', 'SALIDA', 'AJUSTE', 'TRANSFERENCIA');
CREATE TYPE "EstadoMantenimiento" AS ENUM ('PENDIENTE', 'PROGRAMADO', 'COMPLETADO', 'VENCIDO', 'CANCELADO');

-- Extender enum EstadoFactura
ALTER TYPE "EstadoFactura" ADD VALUE IF NOT EXISTS 'PENDIENTE_CAE';
ALTER TYPE "EstadoFactura" ADD VALUE IF NOT EXISTS 'EMITIDA';
ALTER TYPE "EstadoFactura" ADD VALUE IF NOT EXISTS 'RECHAZADA';

-- Plantillas
CREATE TABLE "plantillas_impresion" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" "TipoPlantilla" NOT NULL,
    "config" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "predeterminado" BOOLEAN NOT NULL DEFAULT false,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "plantillas_impresion_pkey" PRIMARY KEY ("id")
);

-- Presupuestos
CREATE TABLE "presupuestos" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "estado" "EstadoPresupuesto" NOT NULL DEFAULT 'BORRADOR',
    "clienteId" TEXT NOT NULL,
    "emisorId" TEXT,
    "plantillaId" TEXT,
    "vendedorId" TEXT,
    "condicionPago" TEXT,
    "vigenciaDias" INTEGER NOT NULL DEFAULT 15,
    "observaciones" TEXT,
    "formaPago" TEXT,
    "plazoEntrega" TEXT,
    "garantia" TEXT,
    "subtotal" DOUBLE PRECISION NOT NULL,
    "iva" DOUBLE PRECISION NOT NULL,
    "total" DOUBLE PRECISION NOT NULL,
    "bonificacionPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "fechaEmision" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaVencimiento" TIMESTAMP(3),
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "presupuestos_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "presupuestos_numero_key" ON "presupuestos"("numero");

CREATE TABLE "items_presupuesto" (
    "id" TEXT NOT NULL,
    "presupuestoId" TEXT NOT NULL,
    "codigo" TEXT,
    "descripcion" TEXT NOT NULL,
    "descripcionLarga" TEXT,
    "fotoUrl" TEXT,
    "cantidad" INTEGER NOT NULL,
    "precioUnit" DOUBLE PRECISION NOT NULL,
    "bonificacionPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "subtotal" DOUBLE PRECISION NOT NULL,
    "inventarioId" TEXT,
    CONSTRAINT "items_presupuesto_pkey" PRIMARY KEY ("id")
);

-- Cobranzas
CREATE TABLE "pagos" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "monto" DOUBLE PRECISION NOT NULL,
    "medio" "MedioPago" NOT NULL DEFAULT 'TRANSFERENCIA',
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "referencia" TEXT,
    "notas" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "pagos_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "pago_facturas" (
    "pagoId" TEXT NOT NULL,
    "facturaId" TEXT NOT NULL,
    "monto" DOUBLE PRECISION NOT NULL,
    CONSTRAINT "pago_facturas_pkey" PRIMARY KEY ("pagoId","facturaId")
);

-- Inventario avanzado
ALTER TABLE "inventario" ADD COLUMN IF NOT EXISTS "stockMaximo" INTEGER;
ALTER TABLE "inventario" ADD COLUMN IF NOT EXISTS "puntoPedido" INTEGER;
ALTER TABLE "inventario" ADD COLUMN IF NOT EXISTS "fotoUrl" TEXT;

CREATE TABLE "depositos" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "direccion" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "depositos_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "movimientos_stock" (
    "id" TEXT NOT NULL,
    "inventarioId" TEXT NOT NULL,
    "depositoId" TEXT,
    "tipo" "TipoMovimientoStock" NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "stockAntes" INTEGER NOT NULL,
    "stockDespues" INTEGER NOT NULL,
    "motivo" TEXT,
    "referencia" TEXT,
    "usuarioId" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "movimientos_stock_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "movimientos_stock_inventarioId_idx" ON "movimientos_stock"("inventarioId");

-- Órdenes de compra
CREATE TABLE "ordenes_compra" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "proveedorId" TEXT NOT NULL,
    "estado" "EstadoOrdenCompra" NOT NULL DEFAULT 'BORRADOR',
    "subtotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "observaciones" TEXT,
    "fechaEmision" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaEntrega" TIMESTAMP(3),
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ordenes_compra_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ordenes_compra_numero_key" ON "ordenes_compra"("numero");

CREATE TABLE "items_orden_compra" (
    "id" TEXT NOT NULL,
    "ordenCompraId" TEXT NOT NULL,
    "inventarioId" TEXT,
    "descripcion" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "cantidadRecibida" INTEGER NOT NULL DEFAULT 0,
    "precioUnit" DOUBLE PRECISION NOT NULL,
    "subtotal" DOUBLE PRECISION NOT NULL,
    CONSTRAINT "items_orden_compra_pkey" PRIMARY KEY ("id")
);

-- Mantenimiento preventivo
CREATE TABLE "planes_mantenimiento" (
    "id" TEXT NOT NULL,
    "equipoId" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "intervaloDias" INTEGER NOT NULL DEFAULT 180,
    "ultimoServicio" TIMESTAMP(3),
    "proximoServicio" TIMESTAMP(3),
    "estado" "EstadoMantenimiento" NOT NULL DEFAULT 'PENDIENTE',
    "tecnicoId" TEXT,
    "notas" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "planes_mantenimiento_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "planes_mantenimiento_equipoId_idx" ON "planes_mantenimiento"("equipoId");
CREATE INDEX "planes_mantenimiento_proximoServicio_idx" ON "planes_mantenimiento"("proximoServicio");

-- Extender facturas (AFIP + vínculos)
ALTER TABLE "facturas" ADD COLUMN IF NOT EXISTS "fechaPago" TIMESTAMP(3);
ALTER TABLE "facturas" ADD COLUMN IF NOT EXISTS "bonificacionPct" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "facturas" ADD COLUMN IF NOT EXISTS "emisorId" TEXT;
ALTER TABLE "facturas" ADD COLUMN IF NOT EXISTS "plantillaId" TEXT;
ALTER TABLE "facturas" ADD COLUMN IF NOT EXISTS "presupuestoId" TEXT;
ALTER TABLE "facturas" ADD COLUMN IF NOT EXISTS "condicionPago" TEXT;
ALTER TABLE "facturas" ADD COLUMN IF NOT EXISTS "observaciones" TEXT;
ALTER TABLE "facturas" ADD COLUMN IF NOT EXISTS "puntoVenta" INTEGER;
ALTER TABLE "facturas" ADD COLUMN IF NOT EXISTS "numeroAfip" INTEGER;
ALTER TABLE "facturas" ADD COLUMN IF NOT EXISTS "cae" TEXT;
ALTER TABLE "facturas" ADD COLUMN IF NOT EXISTS "caeVencimiento" TIMESTAMP(3);
ALTER TABLE "facturas" ADD COLUMN IF NOT EXISTS "qrData" TEXT;
ALTER TABLE "facturas" ADD COLUMN IF NOT EXISTS "afipObservaciones" TEXT;
ALTER TABLE "facturas" ADD COLUMN IF NOT EXISTS "concepto" INTEGER NOT NULL DEFAULT 1;

CREATE UNIQUE INDEX IF NOT EXISTS "facturas_presupuestoId_key" ON "facturas"("presupuestoId");

-- Extender items_factura
ALTER TABLE "items_factura" ADD COLUMN IF NOT EXISTS "codigo" TEXT;
ALTER TABLE "items_factura" ADD COLUMN IF NOT EXISTS "descripcionLarga" TEXT;
ALTER TABLE "items_factura" ADD COLUMN IF NOT EXISTS "fotoUrl" TEXT;
ALTER TABLE "items_factura" ADD COLUMN IF NOT EXISTS "bonificacionPct" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "items_factura" ADD COLUMN IF NOT EXISTS "inventarioId" TEXT;

-- FKs
ALTER TABLE "presupuestos" ADD CONSTRAINT "presupuestos_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "presupuestos" ADD CONSTRAINT "presupuestos_emisorId_fkey" FOREIGN KEY ("emisorId") REFERENCES "emisores"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "presupuestos" ADD CONSTRAINT "presupuestos_plantillaId_fkey" FOREIGN KEY ("plantillaId") REFERENCES "plantillas_impresion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "presupuestos" ADD CONSTRAINT "presupuestos_vendedorId_fkey" FOREIGN KEY ("vendedorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "items_presupuesto" ADD CONSTRAINT "items_presupuesto_presupuestoId_fkey" FOREIGN KEY ("presupuestoId") REFERENCES "presupuestos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "pagos" ADD CONSTRAINT "pagos_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pago_facturas" ADD CONSTRAINT "pago_facturas_pagoId_fkey" FOREIGN KEY ("pagoId") REFERENCES "pagos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pago_facturas" ADD CONSTRAINT "pago_facturas_facturaId_fkey" FOREIGN KEY ("facturaId") REFERENCES "facturas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "movimientos_stock" ADD CONSTRAINT "movimientos_stock_inventarioId_fkey" FOREIGN KEY ("inventarioId") REFERENCES "inventario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "movimientos_stock" ADD CONSTRAINT "movimientos_stock_depositoId_fkey" FOREIGN KEY ("depositoId") REFERENCES "depositos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ordenes_compra" ADD CONSTRAINT "ordenes_compra_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "proveedores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "items_orden_compra" ADD CONSTRAINT "items_orden_compra_ordenCompraId_fkey" FOREIGN KEY ("ordenCompraId") REFERENCES "ordenes_compra"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "items_orden_compra" ADD CONSTRAINT "items_orden_compra_inventarioId_fkey" FOREIGN KEY ("inventarioId") REFERENCES "inventario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "planes_mantenimiento" ADD CONSTRAINT "planes_mantenimiento_equipoId_fkey" FOREIGN KEY ("equipoId") REFERENCES "equipos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "planes_mantenimiento" ADD CONSTRAINT "planes_mantenimiento_tecnicoId_fkey" FOREIGN KEY ("tecnicoId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "facturas" ADD CONSTRAINT "facturas_emisorId_fkey" FOREIGN KEY ("emisorId") REFERENCES "emisores"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "facturas" ADD CONSTRAINT "facturas_plantillaId_fkey" FOREIGN KEY ("plantillaId") REFERENCES "plantillas_impresion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "facturas" ADD CONSTRAINT "facturas_presupuestoId_fkey" FOREIGN KEY ("presupuestoId") REFERENCES "presupuestos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "items_factura" ADD CONSTRAINT "items_factura_inventarioId_fkey" FOREIGN KEY ("inventarioId") REFERENCES "inventario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
