# 22 · Mapa de módulos

> Ruta UI → API → lib → permisos. Referencia rápida para IA y devs.

---

## Leyenda

- 🔑 = permiso principal para la acción
- Archivos `lib/` son indicativos (no exhaustivos)

---

## Dashboard y reportes

| UI | API | lib | Permiso |
|----|-----|-----|---------|
| `/dashboard` | `GET /api/dashboard` | `lib/dashboard/metrics.ts` | 🔐 acceso: `DASHBOARD_ACCESS_PERMISSIONS` (OR); KPIs filtrados por `servicio.read`, `clientes.read`, `facturas.read`/`cobranzas.read` |
| `/reportes` | `GET /api/reportes/*` | — | `reportes.read_*` (OR) |

---

## CRM y clientes

| UI | API | lib | Permiso |
|----|-----|-----|---------|
| `/crm` | `GET /api/clientes` | — | `clientes.read` |
| `/crm/nuevo` | `POST /api/clientes` | `lib/clientes/crear-cliente.ts` | `clientes.create` |
| `/crm/[id]` | `GET/PATCH /api/clientes/[id]` | — | read/update |
| `/crm/inbox` | `/api/crm/conversaciones*` | `lib/crm/` · polling 45 s en bandeja | `crm.read`, `crm.reply`, `crm.assign` |
| `/crm/embudo` | `/api/crm/embudo*` | — | `crm.read`, `crm.reply` |
| `/automatizaciones` | — (n8n externo) | `lib/integraciones/guides.ts` | acceso dashboard |
| Sucursales panel | `/api/clientes/[id]/sucursales*` | `lib/geocoding.ts` | `clientes.update` |
| Historial inbox | `GET .../historial` | — | `crm.read` o `clientes.read` |
| Geocoding mapa | `GET /api/geocoding` | `lib/geocoding.ts` | 🔐 |

Componentes clave: `SucursalesEditor`, `ClienteHistorialInbox`, `InboxPanel`, `NuevoClienteForm`.

---

## Comercial

| UI | API | lib | Permiso |
|----|-----|-----|---------|
| `/presupuestos` | `/api/presupuestos*` | — | `presupuestos.*` |
| `/facturacion` | `/api/facturas` | — | `facturas.read` |
| `/facturacion/nueva` | `POST /api/facturas` | `lib/facturas/validar-sucursal-equipo.ts` | `facturas.create` |
| Picker precio sugerido | `GET /api/precios/resolver` | `lib/precios/resolver-precio.ts` | `presupuestos.read` o `facturas.read` |
| Emitir AFIP | `POST .../emitir` | `lib/afip/` | `facturas.emit_afip` |
| `/cobranzas` | `/api/cobranzas*` | `lib/cobranzas/` · `cronograma-cobranzas.ts` | `cobranzas.*` |

Cronograma unificado: facturas + cuotas alquiler sin facturar. Query `GET .../vencimientos?origen=TODOS|FACTURA|ALQUILER`. Ver [`24-alquiler-equipos.md`](24-alquiler-equipos.md) §4.

---

## Alquiler de equipos

| UI | API | lib | Permiso |
|----|-----|-----|---------|
| `/alquiler` | `GET /api/alquiler/resumen` | `lib/alquiler/resumen.ts` | `alquiler.read` |
| `/alquiler/contratos/nuevo` | `POST /api/alquiler/contratos` | — | `alquiler.create` |
| `/alquiler/contratos/[id]` | `GET/PATCH /api/alquiler/contratos/[id]` | — | read/update |
| Activar | `POST .../activar` | `lib/alquiler/activar-contrato.ts` | `alquiler.update` |
| Facturar cuota | `POST .../facturar` | `lib/alquiler/facturar-cuotas.ts` | `alquiler.bill` |
| Finalizar / cancelar | `POST .../finalizar`, `.../cancelar` | `finalizar-contrato.ts`, `estado-contrato.ts` | `alquiler.close` |
| Devolver línea | `POST /api/alquiler/lineas/[id]/devolver` | `devolver-linea.ts` | `alquiler.close` |
| Unidades stock | `GET /api/alquiler/unidades-disponibles` | — | `alquiler.read` |
| Reportes CSV | `GET /api/reportes/alquiler-*` | `lib/reportes-alquiler-*.ts` | `alquiler.export` |

Componentes: `AlquilerDashboard`, `NuevoContratoAlquilerForm`, `ContratoAlquilerDetalle`. Doc canónico: [`24-alquiler-equipos.md`](24-alquiler-equipos.md).

---

## Inventario y compras

| UI | API | lib | Permiso |
|----|-----|-----|---------|
| `/inventario` | `/api/inventario*` | `lib/inventario-kit.ts` | `inventario.*` |
| Transferir stock | `POST /api/inventario/[id]/transferir` | `lib/inventario/transferir-stock.ts` | `inventario.transfer` |
| `/compras` | `/api/ordenes-compra*` | — | `compras.*` |
| Provisión equipo | `POST .../provisionar-equipos` | `lib/equipos/provisionar-venta.ts` | `facturas.create` |

---

## Servicio técnico

| UI | API | lib | Permiso |
|----|-----|-----|---------|
| `/servicio-tecnico` | `/api/ots*` | `lib/ots.ts` | `servicio.*` |
| `/servicio-tecnico/nueva` | `POST /api/ots` | `lib/ots.ts` | `servicio.create` |
| `/servicio-tecnico/[id]` | `GET/PATCH /api/ots/[id]` | checklist en `diagnostico` | `servicio.read` / `update` |
| Informe OT PDF | `GET /api/ots/[id]/pdf` | `lib/ots/render-informe-pdf.tsx` | `servicio.read` |
| `/servicio-tecnico/equipos/[id]` | `/api/equipos/[id]*` | historia clínica | `servicio.read` |
| `/servicio-tecnico/mapa` | `/api/tracking/mapa` | `lib/tracking-automation.ts` | `tracking.read` |
| `/servicio-tecnico/preventivo` | `/api/mantenimiento*` | `PlanMantenimiento` | `preventivo.*` |

---

## Configuración

| UI | API | lib | Permiso |
|----|-----|-----|---------|
| `/configuracion` | — | — | varios |
| `/configuracion/usuarios` | `/api/usuarios`, `/api/roles` | `lib/rbac.ts` | `usuarios.*` |
| `/configuracion/emisores` | `/api/emisores*` | `lib/afip/` | `emisores.*` |
| `/configuracion/plantillas` | `/api/plantillas*` | `lib/plantillas/` | `config.manage_billing_templates` |
| `/configuracion/listas-precios` | `/api/listas-precios*` | `lib/precios/` | `listas_precios.read` / `manage` |
| `/configuracion/integraciones` | `/api/integraciones/*` | `lib/integraciones/` | `config.manage_integrations` |
| `/configuracion/contabilidad` | `/api/contabilidad/*` | contabilidad AR | `config.manage_accounting` |
| `/configuracion/auditoria` | `GET /api/auditoria` | `lib/audit.ts` | `auditoria.read` |
| `/configuracion/logs` | `GET /api/logs` | `lib/error-log.ts` | `logs.read` |
| `/configuracion/seguridad` | `/api/config/seguridad` | — | `config.update` |

---

## Integraciones externas

| Origen | Entrada | Auth |
|--------|---------|------|
| n8n | `/api/n8n/*` | `N8N_API_KEY` |
| Meta WhatsApp / IG / FB | `/api/webhooks/meta` | verify token + HMAC (`lib/crm/adapters/`) |
| Meta WhatsApp (legacy) | `/api/webhooks/whatsapp` | verify token + HMAC |
| Microsoft Graph | OAuth + `worker:crm-graph` | OAuth tokens en BD |
| Cron cobranzas | `/api/cron/cobranzas-vencimientos` | `CRON_SECRET` |
| Cron alquiler cuotas | `/api/cron/alquiler-cuotas` | `CRON_SECRET` · diario 06:15 · `lib/alquiler/procesar-cuotas-alquiler.ts` |
| Cron OT SLA | `/api/cron/ots-vencidas` | `CRON_SECRET` (marca VENCIDA + email SLA próximo) |
| Cron presupuestos | `/api/cron/presupuestos-vencidos` | `CRON_SECRET` |
| Cron stock mínimo | `/api/cron/stock-minimo` | `CRON_SECRET` · diario 07:00 · `lib/inventario/alerta-stock-minimo.ts` |
| Cron resumen semanal | `/api/cron/resumen-semanal` | `CRON_SECRET` · dom 08:00 · `lib/admin/resumen-semanal.ts` |
| Cron notif. operativas | `/api/cron/notificaciones-operativas` | `CRON_SECRET` · preventivo próximo (email) · CRM `cliente.sin_respuesta_2h` (n8n) |

---

## Capas transversales

| Concern | Archivo | Uso |
|---------|---------|-----|
| Auth sesión | `lib/auth.ts`, `middleware.ts` | Login JWT |
| Autorización API | `lib/api-auth.ts` | `requirePermission` |
| Autorización página | `lib/page-guard.ts` | Server components |
| UI permisos | `components/auth/useCan.tsx` | Solo ocultar botones |
| Errores UI | `lib/errores.ts` | Español |
| Errores API | `handleApiError` | + logs técnicos |
| Serialización | `lib/serialize.ts` | Decimal → number JSON |
| Validación Zod | `lib/validation.ts` | Schemas compartidos |

---

## Workers (procesos separados)

| Comando | Cola / trigger | lib |
|---------|------------------|-----|
| `npm run worker:afip` | BullMQ `afip-emision` | `lib/afip/emitir.ts` |
| `npm run worker:crm-email` | IMAP poll | `lib/crm/adapters/` |
| `npm run worker:crm-graph` | Graph poll | `lib/crm/adapters/email-graph` |
| `npm run worker:cobranzas` | Timer | `lib/cobranzas/procesar-vencimientos` |

Ver [`15-ESTADOS-WORKERS-SEGURIDAD.md`](15-ESTADOS-WORKERS-SEGURIDAD.md).
