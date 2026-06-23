-- CreateEnum
CREATE TYPE "TipoListaPrecios" AS ENUM ('MINORISTA', 'MAYORISTA', 'INSTITUCIONAL', 'PROMOCION', 'ESPECIAL');

-- CreateTable
CREATE TABLE "listas_precios" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" "TipoListaPrecios" NOT NULL,
    "moneda" TEXT NOT NULL DEFAULT 'ARS',
    "descuentoGlobalPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "vigenciaDesde" TIMESTAMP(3),
    "vigenciaHasta" TIMESTAMP(3),
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "predeterminada" BOOLEAN NOT NULL DEFAULT false,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "listas_precios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lista_precios_items" (
    "id" TEXT NOT NULL,
    "listaPreciosId" TEXT NOT NULL,
    "inventarioId" TEXT NOT NULL,
    "precioUnit" DOUBLE PRECISION NOT NULL,
    "bonificacionPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "vigenciaDesde" TIMESTAMP(3),
    "vigenciaHasta" TIMESTAMP(3),

    CONSTRAINT "lista_precios_items_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "clientes" ADD COLUMN "listaPreciosId" TEXT,
ADD COLUMN "esMayorista" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "monedaPreferida" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "listas_precios_codigo_key" ON "listas_precios"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "lista_precios_items_listaPreciosId_inventarioId_key" ON "lista_precios_items"("listaPreciosId", "inventarioId");

-- AddForeignKey
ALTER TABLE "clientes" ADD CONSTRAINT "clientes_listaPreciosId_fkey" FOREIGN KEY ("listaPreciosId") REFERENCES "listas_precios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lista_precios_items" ADD CONSTRAINT "lista_precios_items_listaPreciosId_fkey" FOREIGN KEY ("listaPreciosId") REFERENCES "listas_precios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lista_precios_items" ADD CONSTRAINT "lista_precios_items_inventarioId_fkey" FOREIGN KEY ("inventarioId") REFERENCES "inventario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
