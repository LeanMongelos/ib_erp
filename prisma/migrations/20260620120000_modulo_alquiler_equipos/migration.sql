-- AlterEnum
ALTER TYPE "OrigenEquipo" ADD VALUE 'ALQUILER';

-- AlterEnum
ALTER TYPE "EstadoInventarioUnidad" ADD VALUE 'EN_ALQUILER';

-- CreateEnum
CREATE TYPE "EstadoContratoAlquiler" AS ENUM ('BORRADOR', 'ACTIVO', 'SUSPENDIDO', 'FINALIZADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "EstadoCuotaAlquiler" AS ENUM ('PENDIENTE', 'FACTURADA', 'COBRADA', 'VENCIDA', 'ANULADA');

-- CreateTable
CREATE TABLE "contratos_alquiler" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "estado" "EstadoContratoAlquiler" NOT NULL DEFAULT 'BORRADOR',
    "fechaInicio" TIMESTAMP(3),
    "fechaFin" TIMESTAMP(3),
    "diaFacturacion" INTEGER NOT NULL DEFAULT 1,
    "observaciones" TEXT,
    "creadoPorId" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contratos_alquiler_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lineas_alquiler" (
    "id" TEXT NOT NULL,
    "contratoId" TEXT NOT NULL,
    "inventarioUnidadId" TEXT NOT NULL,
    "equipoId" TEXT,
    "montoMensual" DOUBLE PRECISION NOT NULL,
    "beneficiarioNombre" TEXT,
    "beneficiarioDocumento" TEXT,
    "beneficiarioTelefono" TEXT,
    "beneficiarioEmail" TEXT,
    "domicilio" TEXT,
    "localidad" TEXT,
    "provincia" TEXT,
    "codigoPostal" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "fechaEntrega" TIMESTAMP(3),
    "fechaDevolucion" TIMESTAMP(3),
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "observaciones" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lineas_alquiler_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cuotas_alquiler" (
    "id" TEXT NOT NULL,
    "contratoId" TEXT NOT NULL,
    "lineaId" TEXT NOT NULL,
    "periodo" TEXT NOT NULL,
    "monto" DOUBLE PRECISION NOT NULL,
    "vencimiento" TIMESTAMP(3) NOT NULL,
    "estado" "EstadoCuotaAlquiler" NOT NULL DEFAULT 'PENDIENTE',
    "facturaId" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cuotas_alquiler_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "contratos_alquiler_numero_key" ON "contratos_alquiler"("numero");

-- CreateIndex
CREATE INDEX "contratos_alquiler_clienteId_estado_idx" ON "contratos_alquiler"("clienteId", "estado");

-- CreateIndex
CREATE INDEX "contratos_alquiler_estado_idx" ON "contratos_alquiler"("estado");

-- CreateIndex
CREATE INDEX "lineas_alquiler_contratoId_idx" ON "lineas_alquiler"("contratoId");

-- CreateIndex
CREATE INDEX "lineas_alquiler_inventarioUnidadId_idx" ON "lineas_alquiler"("inventarioUnidadId");

-- CreateIndex
CREATE INDEX "lineas_alquiler_equipoId_idx" ON "lineas_alquiler"("equipoId");

-- CreateIndex
CREATE UNIQUE INDEX "cuotas_alquiler_lineaId_periodo_key" ON "cuotas_alquiler"("lineaId", "periodo");

-- CreateIndex
CREATE INDEX "cuotas_alquiler_contratoId_periodo_idx" ON "cuotas_alquiler"("contratoId", "periodo");

-- CreateIndex
CREATE INDEX "cuotas_alquiler_estado_vencimiento_idx" ON "cuotas_alquiler"("estado", "vencimiento");

-- AddForeignKey
ALTER TABLE "contratos_alquiler" ADD CONSTRAINT "contratos_alquiler_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contratos_alquiler" ADD CONSTRAINT "contratos_alquiler_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lineas_alquiler" ADD CONSTRAINT "lineas_alquiler_contratoId_fkey" FOREIGN KEY ("contratoId") REFERENCES "contratos_alquiler"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lineas_alquiler" ADD CONSTRAINT "lineas_alquiler_inventarioUnidadId_fkey" FOREIGN KEY ("inventarioUnidadId") REFERENCES "inventario_unidades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lineas_alquiler" ADD CONSTRAINT "lineas_alquiler_equipoId_fkey" FOREIGN KEY ("equipoId") REFERENCES "equipos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cuotas_alquiler" ADD CONSTRAINT "cuotas_alquiler_contratoId_fkey" FOREIGN KEY ("contratoId") REFERENCES "contratos_alquiler"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cuotas_alquiler" ADD CONSTRAINT "cuotas_alquiler_lineaId_fkey" FOREIGN KEY ("lineaId") REFERENCES "lineas_alquiler"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cuotas_alquiler" ADD CONSTRAINT "cuotas_alquiler_facturaId_fkey" FOREIGN KEY ("facturaId") REFERENCES "facturas"("id") ON DELETE SET NULL ON UPDATE CASCADE;
