-- Indexes for report queries (ventas-mes, auditoria export)
CREATE INDEX "audit_logs_fecha_idx" ON "audit_logs"("fecha");

CREATE INDEX "facturas_fechaEmision_idx" ON "facturas"("fechaEmision");

CREATE INDEX "facturas_estado_fechaEmision_idx" ON "facturas"("estado", "fechaEmision");
