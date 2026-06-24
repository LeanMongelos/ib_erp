# Capacitación de operadores — iBiomédica ERP

> Guía por rol para el equipo de Ingeniería Biomédica (Formosa).  
> Complementa [`INICIO-RAPIDO-OPERADOR.md`](INICIO-RAPIDO-OPERADOR.md) y [`01-roles-y-permisos.md`](01-roles-y-permisos.md).

---

## Antes de empezar (todos los roles)

1. **Login:** `https://erp-ibiomedica.com.ar/login` — usar usuario real (no demo de seed en producción).
2. **Perfil:** Configuración → Mi perfil — actualizar teléfono y contraseña.
3. **Permisos:** Si no ves un módulo, pedir al administrador que revise tu rol en **Configuración → Usuarios**.
4. **Cerrar sesión y volver a entrar** después de un cambio de rol (el JWT cachea permisos).

---

## Administrador / Gerente (`SUPERADMIN`, `GERENTE`)

**Responsabilidad:** configuración del sistema, usuarios, emisores AFIP, integraciones y supervisión.

| Tarea | Dónde | Notas |
|-------|-------|-------|
| Alta de usuarios y roles | `/configuracion/usuarios` | Asignar solo los roles necesarios |
| Emisores y certificados AFIP | `/configuracion/emisores` | No pasar a PRODUCCIÓN sin certificados |
| SMTP / email CRM | `/configuracion/integraciones` | IMAP o Graph para bandeja |
| Checklist go-live | Terminal VPS: `npm run go-live:check` | Sin FAIL antes de facturar |
| Logs y errores | `/configuracion/logs` | Revisar tras deploy o incidente |
| Auditoría permisos | `npm run audit:permisos` | Roles sin permisos críticos |

**Flujo típico del día:** revisar logs → verificar health → atender alertas de stock/cobranzas → dar de alta usuarios nuevos si hace falta.

---

## Vendedor / Comercial (`VENTAS`, `ADMINISTRACION` con ventas)

**Responsabilidad:** clientes, presupuestos, CRM y seguimiento comercial.

| Tarea | Dónde | Notas |
|-------|-------|-------|
| Clientes y sucursales | `/crm` | Mapa, historial, contactos |
| Import masivo clientes | `/crm` → Importar CSV | Plantilla desde el botón |
| Presupuestos | `/presupuestos` | Enviar por email al cliente |
| Embudo comercial | `/crm/embudo` | Estados del pipeline |
| OT desde venta | Desde presupuesto aprobado | Ver [`13-FLUJOS-COMERCIALES.md`](13-FLUJOS-COMERCIALES.md) |

**Buenas prácticas:**
- Cargar **sucursal con dirección** antes de facturar equipos.
- Registrar interacciones en el historial del cliente (CRM).
- No emitir facturas AFIP si no tenés rol `facturas.emit_afip`.

---

## Técnico de servicio (`TECNICO`)

**Responsabilidad:** órdenes de trabajo, equipos en cliente, repuestos e inventario de lectura.

| Tarea | Dónde | Notas |
|-------|-------|-------|
| Bandeja de OTs | `/servicio-tecnico` | Filtrar por asignado / estado |
| Detalle de OT | `/servicio-tecnico/[id]` | Repuestos, fotos, cierre |
| Equipos del cliente | `/servicio-tecnico/equipos/[id]` | Historial y plan preventivo |
| Mapa de visitas | `/servicio-tecnico/mapa` | Sucursales geocodificadas |
| Consultar stock | `/inventario` | Solo lectura si no tenés `inventario.adjust_stock` |

**Buenas prácticas:**
- Cerrar la OT con **repuestos consumidos** para descontar stock.
- Subir fotos y observaciones en el detalle de la OT.
- Si la OT está asignada a otro técnico, coordinar antes de modificar.

---

## Compras y cobranzas (`ADMINISTRACION`, `CONTABILIDAD`, roles con `compras.*` / `cobranzas.*`)

**Responsabilidad:** proveedores, órdenes de compra, stock bajo mínimo y cobranzas.

| Tarea | Dónde | Notas |
|-------|-------|-------|
| Proveedores | `/proveedores` | Import CSV disponible |
| Stock bajo mínimo | `/inventario?bajo=1` o badge en nav | Generar OC desde faltantes |
| Órdenes de compra | `/compras` | Aprobar y recepcionar |
| Cobranzas | `/cobranzas` | Cuotas, pagos, conciliación |
| Reportes operativos | `/reportes` | Exportaciones CSV según permiso |

**Buenas prácticas:**
- Revisar **inventario bajo mínimo** a primera hora.
- Registrar pagos con fecha y medio correcto.
- No borrar facturas emitidas — usar nota de crédito si aplica.

---

## Checklist al dar de alta un usuario nuevo

1. Crear usuario en `/configuracion/usuarios` con email corporativo.
2. Asignar **un rol principal** (evitar mezclar SUPERADMIN con roles operativos salvo necesidad).
3. Ejecutar `npm run audit:permisos` si se modificó la matriz RBAC.
4. Pedir al usuario que entre, cambie contraseña y recorra su sección de esta guía.
5. Verificar que ve el menú esperado (CRM, ST, Compras, etc.).

---

## Soporte y escalamiento

| Problema | Acción |
|----------|--------|
| No veo un módulo | Admin revisa rol → usuario cierra sesión |
| Error al facturar AFIP | Ver [`02-facturacion-afip.md`](02-facturacion-afip.md) · Logs |
| Email CRM no llega | Integraciones + worker PM2 |
| App caída | Admin: `npm run verify:infra` en VPS |

Runbook completo: [`RUNBOOK-PRODUCCION.md`](RUNBOOK-PRODUCCION.md).
