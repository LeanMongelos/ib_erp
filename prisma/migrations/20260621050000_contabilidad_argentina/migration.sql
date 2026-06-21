-- ConfiguracionContable
CREATE TABLE "configuracion_contable" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "monedaFuncional" TEXT NOT NULL DEFAULT 'ARS',
    "cotizacionUsdManual" DOUBLE PRECISION,
    "usaCotizacionBna" BOOLEAN NOT NULL DEFAULT true,
    "agenteRetencionGanancias" BOOLEAN NOT NULL DEFAULT false,
    "agenteRetencionIva" BOOLEAN NOT NULL DEFAULT false,
    "agentePercepcionIva" BOOLEAN NOT NULL DEFAULT false,
    "agenteRetencionIibb" BOOLEAN NOT NULL DEFAULT false,
    "agentePercepcionIibb" BOOLEAN NOT NULL DEFAULT false,
    "inscriptoIibb" BOOLEAN NOT NULL DEFAULT false,
    "numeroInscripcionIibb" TEXT,
    "convenioMultilateralIibb" BOOLEAN NOT NULL DEFAULT false,
    "libroIvaDigital" BOOLEAN NOT NULL DEFAULT true,
    "periodicidadIva" TEXT NOT NULL DEFAULT 'MENSUAL',
    "cierreIvaDia" INTEGER NOT NULL DEFAULT 20,
    "ejercicioActivoId" TEXT,
    "notasContador" TEXT,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "configuracion_contable_pkey" PRIMARY KEY ("id")
);

-- CondicionIvaCat
CREATE TABLE "condiciones_iva_cat" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "alicuotaIvaId" TEXT,
    "requiereCuit" BOOLEAN NOT NULL DEFAULT true,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "esDefault" BOOLEAN NOT NULL DEFAULT false,
    "orden" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "condiciones_iva_cat_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "condiciones_iva_cat_codigo_key" ON "condiciones_iva_cat"("codigo");

-- JurisdiccionIibb
CREATE TABLE "jurisdicciones_iibb" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "provincia" TEXT NOT NULL,
    "alicuotaGeneral" DOUBLE PRECISION,
    "convenioMultilateral" BOOLEAN NOT NULL DEFAULT false,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "jurisdicciones_iibb_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "jurisdicciones_iibb_codigo_key" ON "jurisdicciones_iibb"("codigo");

-- RegimenImpositivo
CREATE TABLE "regimenes_impositivos" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "alicuota" DOUBLE PRECISION NOT NULL,
    "minimoNoImponible" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "baseMinima" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "jurisdiccionIibbId" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "regimenes_impositivos_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "regimenes_impositivos_codigo_key" ON "regimenes_impositivos"("codigo");

-- CondicionPagoCat
CREATE TABLE "condiciones_pago_cat" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "diasPlazo" INTEGER NOT NULL DEFAULT 0,
    "plazosCobranza" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "esDefault" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "condiciones_pago_cat_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "condiciones_pago_cat_codigo_key" ON "condiciones_pago_cat"("codigo");

-- PlanCuenta
CREATE TABLE "plan_cuentas" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "nivel" INTEGER NOT NULL DEFAULT 1,
    "padreId" TEXT,
    "aceptaImputacion" BOOLEAN NOT NULL DEFAULT true,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "plan_cuentas_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "plan_cuentas_codigo_key" ON "plan_cuentas"("codigo");

-- EjercicioContable
CREATE TABLE "ejercicios_contables" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "anio" INTEGER NOT NULL,
    "fechaInicio" TIMESTAMP(3) NOT NULL,
    "fechaFin" TIMESTAMP(3) NOT NULL,
    "cerrado" BOOLEAN NOT NULL DEFAULT false,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ejercicios_contables_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ejercicios_contables_anio_key" ON "ejercicios_contables"("anio");

-- TipoComprobanteAfip
CREATE TABLE "tipos_comprobante_afip" (
    "id" TEXT NOT NULL,
    "codigoAfip" INTEGER NOT NULL,
    "letra" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "aplicaIva" BOOLEAN NOT NULL DEFAULT true,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "tipos_comprobante_afip_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tipos_comprobante_afip_codigoAfip_key" ON "tipos_comprobante_afip"("codigoAfip");

-- TipoDocumentoAfip
CREATE TABLE "tipos_documento_afip" (
    "id" TEXT NOT NULL,
    "codigoAfip" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "tipos_documento_afip_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tipos_documento_afip_codigoAfip_key" ON "tipos_documento_afip"("codigoAfip");

-- ForeignKeys
ALTER TABLE "configuracion_contable" ADD CONSTRAINT "configuracion_contable_ejercicioActivoId_fkey" FOREIGN KEY ("ejercicioActivoId") REFERENCES "ejercicios_contables"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "condiciones_iva_cat" ADD CONSTRAINT "condiciones_iva_cat_alicuotaIvaId_fkey" FOREIGN KEY ("alicuotaIvaId") REFERENCES "alicuotas_iva"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "regimenes_impositivos" ADD CONSTRAINT "regimenes_impositivos_jurisdiccionIibbId_fkey" FOREIGN KEY ("jurisdiccionIibbId") REFERENCES "jurisdicciones_iibb"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "plan_cuentas" ADD CONSTRAINT "plan_cuentas_padreId_fkey" FOREIGN KEY ("padreId") REFERENCES "plan_cuentas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "configuracion_contable_ejercicioActivoId_key" ON "configuracion_contable"("ejercicioActivoId");
