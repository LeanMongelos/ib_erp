# 20 · Glosario de dominio

> Términos de negocio y técnicos usados en iBiomédica ERP (Formosa, AR).

---

## Comercial y fiscal

| Término | Significado |
|---------|-------------|
| **Presupuesto** | Cotización formal antes de la venta. Estados: BORRADOR → ENVIADO → APROBADO → CONVERTIDO. |
| **Factura** | Comprobante fiscal. Borrador editable hasta emisión AFIP. |
| **CAE** | Código de Autorización Electrónico (AFIP). Obligatorio para factura válida. |
| **Emisor** | CUIT que factura (puede haber varios). Certificado digital por emisor. |
| **Punto de venta** | Numeración AFIP asociada al emisor. |
| **Nota de crédito/débito** | Ajuste sobre factura emitida. |
| **Cobranza** | Registro de pago del cliente contra factura(s). |
| **Vencimiento de cobranza** | Plazo de pago (30/60/90 días) con avisos automáticos. |
| **Alícuota IVA** | Porcentaje de IVA (21%, 10.5%, etc.). |

---

## Clientes y ubicación

| Término | Significado |
|---------|-------------|
| **Cliente** | Entidad comercial (hospital, clínica, organismo público). |
| **Sede fiscal** | Dirección administrativa del `Cliente` (opcional en alta). |
| **Sucursal** | `ClienteSucursal` — sede física geocodificada (calle + número + ciudad + lat/lng). |
| **Sucursal de instalación** | Sucursal donde se instala un equipo facturado (`ItemFactura.sucursalInstalacionId`). |
| **Organismo público** | Tipo de cliente (`ORGANISMO_PUBLICO`) para ministerios y entidades multi-sede. |
| **Ficha 360°** | Vista `/crm/[id]` con datos, métricas, sucursales e historial. |

---

## Inventario y equipos

| Término | Significado |
|---------|-------------|
| **Inventario** | Catálogo de productos/repuestos en stock. |
| **Equipo** | Unidad serializada en campo (monitor, incubadora). Tiene `numeroSerie`, cliente, sucursal. |
| **Kit** | Conjunto de ítems de inventario vendidos como paquete con un equipo padre. |
| **Provisión de venta** | Crear equipo + kit + preventivo + posición mapa al facturar ítem EQUIPO. |
| **Historia clínica (equipo)** | Bitácora de eventos del equipo (OT, componentes, notas). |

---

## Servicio técnico

| Término | Significado |
|---------|-------------|
| **OT** | Orden de Trabajo — solicitud de reparación/servicio. |
| **SLA** | Tiempo límite de resolución; OT vencida si `slaVence < now` y sigue abierta. |
| **Preventivo** | Mantenimiento programado (`PlanPreventivo` / visitas). |
| **Tracking** | Eventos de ubicación/recorrido del técnico en mapa. |
| **Repuesto OT** | Ítem de inventario consumido en una OT. |

---

## CRM

| Término | Significado |
|---------|-------------|
| **Conversación** | Hilo omnicanal (email, WhatsApp, etc.). |
| **Bandeja / Inbox** | `/crm/inbox` — conversaciones asignadas. |
| **Embudo** | Kanban de negocios comerciales (`NegocioEmbudo`). |
| **Prospecto** | Contacto aún no vinculado como `Cliente`. |
| **Historial cliente (inbox)** | OTs y productos facturados visibles al atender conversación. |

---

## Sistema y seguridad

| Término | Significado |
|---------|-------------|
| **RBAC** | Control de acceso por roles y permisos (`usuarios.read`, `facturas.create`, …). |
| **SUPERADMIN** | Rol con permiso wildcard `*`. |
| **Auditoría** | Registro inmutable de acciones de usuario (`AuditLog`). |
| **Log del sistema** | Error técnico con stack (`SystemLog`), retención 15 días. |
| **Worker** | Proceso Node separado (AFIP, email, cobranzas). |
| **n8n** | Automatizaciones externas vía webhooks `/api/n8n/*`. |
| **Plantilla de impresión** | Layout JSON para PDF de factura/presupuesto/remito. |

---

## Abreviaturas

| Sigla | Significado |
|-------|-------------|
| **AFIP** | Administración Federal de Ingresos Públicos |
| **WSAA / WSFE** | Web services autenticación y facturación electrónica |
| **OT** | Orden de Trabajo |
| **OC** | Orden de Compra |
| **ST** | Servicio Técnico |
| **CRM** | Customer Relationship Management |
| **ERP** | Enterprise Resource Planning |
