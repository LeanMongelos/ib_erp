# Inicio rápido — Operador iBiomédica ERP

> Guía de una página para el equipo de Ingeniería Biomédica (Formosa).  
> Producción: **https://erp-ibiomedica.com.ar**

---

## 1. Ingresar al sistema

1. Abrí **https://erp-ibiomedica.com.ar/login**
2. Usá tu email y contraseña (las entrega el administrador).
3. Si no ves un menú o botón, **cerrá sesión y volvé a entrar** (los permisos se actualizan al iniciar sesión).
4. Barra superior: **Buscar** (Ctrl+K), campanas de avisos, tu perfil.

| Rol típico | Qué ve |
|------------|--------|
| Administración / Gerencia | Todo + Configuración |
| Comercial | CRM, presupuestos, facturación |
| Técnico | Servicio técnico, equipos, mapa |
| Cobranzas | Facturación + Cobranzas |

---

## 2. Dónde está cada cosa

| Necesito… | Menú |
|-----------|------|
| Clientes y contactos | **CRM** → listado o ficha `/crm/[cliente]` |
| Presupuesto comercial | **Presupuestos** |
| Factura AFIP | **Facturación** |
| Cobrar cuotas | **Cobranzas** |
| Orden de trabajo (OT) | **Servicio técnico** |
| Equipos instalados | Servicio técnico → equipo o mapa |
| Stock y repuestos | **Inventario** |
| Proveedores y compras | **Proveedores** / **Compras** |
| Reportes y export CSV | **Reportes** |
| Usuarios, emisores, logs | **Configuración** |

---

## 3. Primera factura (resumen)

1. **Cliente** — CRM → buscar o crear cliente con CUIT y sucursal (obligatoria si vendés equipos).
2. **Presupuesto (opcional)** — Presupuestos → Nuevo → ítems, plazos de cobranza → Enviar / Aprobar.
3. **Factura** — Facturación → Nueva factura (o desde presupuesto aprobado / OT cerrada).
4. Completar emisor, tipo comprobante, ítems, condición de pago.
5. **Emitir AFIP** — botón Emitir; esperar estado **EMITIDA** (CAE). Si queda en PENDIENTE_CAE, revisar Configuración → Logs (`worker-afip`).
6. PDF — descargar desde la lista de facturación.

Flujo detallado: [`docs/13-FLUJOS-COMERCIALES.md`](13-FLUJOS-COMERCIALES.md).

---

## 4. Primera orden de trabajo (OT)

1. CRM → elegir cliente (y equipo si ya está cargado).
2. **Servicio técnico** → Nueva OT (o desde ficha de equipo).
3. Completar descripción, diagnóstico, técnico asignado.
4. Durante la OT: repuestos desde inventario, visitas en mapa si aplica.
5. Al cerrar: podés generar **presupuesto** o **factura** desde el flujo comercial de la OT.

Detalle: [`docs/07-servicio-tecnico.md`](07-servicio-tecnico.md).

---

## 5. Cobranzas

1. Al emitir factura con plazos (30-60-90, etc.) el ERP genera **cuotas** automáticamente.
2. **Cobranzas** — listado de vencimientos pendientes y vencidos.
3. **Registrar pago** — imputá el monto; el saldo se actualiza en la factura.
4. Avisos automáticos — cron/worker en el servidor; fallos aparecen en campana admin (Configuración → Logs, origen `cobranza`).

---

## 6. Alertas y soporte

| Síntoma | Dónde mirar |
|---------|-------------|
| Campana ámbar (admin) | WARN recientes: AFIP, integridad, cobranzas |
| Factura rechazada | Facturación + Logs (`afip-notify`, `worker-afip`) |
| Email CRM no llega | Configuración → Integraciones |
| Algo “roto” en pantalla | Runbook: [`18-RUNBOOK-OPERACIONES.md`](18-RUNBOOK-OPERACIONES.md) |

**Escalamiento:** L1 runbook + logs → L2 reproducir en dev → L3 administrador / soporte técnico.

---

## 7. Atajos útiles

- **Ctrl+K** — búsqueda global (cliente, factura `B-10001`, presupuesto, OT, producto).
- **Configuración → Logs** — errores técnicos (retención 15 días).
- **Configuración → Auditoría** — quién hizo qué en el negocio.

---

*Última revisión: Fase Z · erp-ibiomedica.com.ar*
