-- CreateEnum
CREATE TYPE "OrigenProveedor" AS ENUM ('NACIONAL', 'IMPORTADO');

-- AlterTable
ALTER TABLE "clientes" ADD COLUMN     "condicionIva" TEXT,
ADD COLUMN     "condicionPago" TEXT,
ADD COLUMN     "limiteCredito" DOUBLE PRECISION,
ADD COLUMN     "segmento" TEXT,
ADD COLUMN     "sitioWeb" TEXT,
ADD COLUMN     "notas" TEXT;

-- CreateTable
CREATE TABLE "contactos_cliente" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "cargo" TEXT,
    "email" TEXT,
    "telefono" TEXT,
    "principal" BOOLEAN NOT NULL DEFAULT false,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contactos_cliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proveedores" (
    "id" TEXT NOT NULL,
    "razonSocial" TEXT NOT NULL,
    "cuit" TEXT,
    "condicionIva" TEXT,
    "rubro" TEXT,
    "origen" "OrigenProveedor" NOT NULL DEFAULT 'NACIONAL',
    "moneda" TEXT NOT NULL DEFAULT 'ARS',
    "email" TEXT,
    "telefono" TEXT,
    "sitioWeb" TEXT,
    "direccion" TEXT,
    "ciudad" TEXT,
    "marcas" TEXT,
    "condicionPago" TEXT,
    "financiacionPct" DOUBLE PRECISION,
    "plazoEntregaDias" INTEGER,
    "minimoCompra" DOUBLE PRECISION,
    "notas" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "proveedores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contactos_proveedor" (
    "id" TEXT NOT NULL,
    "proveedorId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "cargo" TEXT,
    "email" TEXT,
    "telefono" TEXT,
    "whatsapp" TEXT,
    "principal" BOOLEAN NOT NULL DEFAULT false,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contactos_proveedor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "condiciones_proveedor" (
    "id" TEXT NOT NULL,
    "proveedorId" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "plazoDias" INTEGER NOT NULL DEFAULT 0,
    "recargoPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "descuentoPct" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "condiciones_proveedor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proveedor_productos" (
    "id" TEXT NOT NULL,
    "proveedorId" TEXT NOT NULL,
    "inventarioId" TEXT,
    "nombreProducto" TEXT NOT NULL,
    "costo" DOUBLE PRECISION NOT NULL,
    "moneda" TEXT NOT NULL DEFAULT 'ARS',
    "leadTimeDias" INTEGER,
    "garantiaMeses" INTEGER,
    "vigenteDesde" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "proveedor_productos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "contactos_cliente_clienteId_idx" ON "contactos_cliente"("clienteId");

-- CreateIndex
CREATE INDEX "contactos_proveedor_proveedorId_idx" ON "contactos_proveedor"("proveedorId");

-- CreateIndex
CREATE INDEX "condiciones_proveedor_proveedorId_idx" ON "condiciones_proveedor"("proveedorId");

-- CreateIndex
CREATE INDEX "proveedor_productos_proveedorId_idx" ON "proveedor_productos"("proveedorId");

-- CreateIndex
CREATE INDEX "proveedor_productos_inventarioId_idx" ON "proveedor_productos"("inventarioId");

-- AddForeignKey
ALTER TABLE "contactos_cliente" ADD CONSTRAINT "contactos_cliente_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contactos_proveedor" ADD CONSTRAINT "contactos_proveedor_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "proveedores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "condiciones_proveedor" ADD CONSTRAINT "condiciones_proveedor_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "proveedores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proveedor_productos" ADD CONSTRAINT "proveedor_productos_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "proveedores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proveedor_productos" ADD CONSTRAINT "proveedor_productos_inventarioId_fkey" FOREIGN KEY ("inventarioId") REFERENCES "inventario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
