-- Compras Fase D: alertas dismiss persistidas
CREATE TABLE "alertas_compra_dismiss" (
    "id" TEXT NOT NULL,
    "alertKey" TEXT NOT NULL,
    "dismissedById" TEXT NOT NULL,
    "dismissedEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alertas_compra_dismiss_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "alertas_compra_dismiss_alertKey_dismissedById_key" ON "alertas_compra_dismiss"("alertKey", "dismissedById");
CREATE INDEX "alertas_compra_dismiss_alertKey_idx" ON "alertas_compra_dismiss"("alertKey");

ALTER TABLE "alertas_compra_dismiss" ADD CONSTRAINT "alertas_compra_dismiss_dismissedById_fkey" FOREIGN KEY ("dismissedById") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
