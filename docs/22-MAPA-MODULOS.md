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
| `/dashboard` | `GET /api/dashboard` | `lib/dashboard/` | 🔐 sesión |
| `/reportes` | `GET /api/reportes/*` | — | `reportes.read_*` |

---

## CRM y clientes

| UI | API | lib | Permiso |
|----|-----|-----|---------|
| `/crm` | `GET /api/clientes` | — | `clientes.read` |
| `/crm/nuevo` | `POST /api/clientes` | `lib/clientes/crear-cliente.ts` | `clientes.create` |
| `/crm/[id]` | `GET/PATCH /api/clientes/[id]` | — | read/update |
| `/crm/inbox` | `/api/crm/conversaciones*` | `lib/crm/` | `crm.read`, `crm.reply` |
| `/crm/embudo` | `/api/crm/embudo*` | — | `crm.read`, `crm.reply` |
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
| Emitir AFIP | `POST .../emitir` | `lib/afip/` | `facturas.emit_afip` |
| `/cobranzas` | `/api/cobranzas*` | `lib/cobranzas/` | `cobranzas.*` |

---

## Inventario y compras

| UI | API | lib | Permiso |
|----|-----|-----|---------|
| `/inventario` | `/api/inventario*` | `lib/inventario-kit.ts` | `inventario.*` |
| `/compras` | `/api/ordenes-compra*` | — | `compras.*` |
| Provisión equipo | `POST .../provisionar-equipos` | `lib/equipos/provisionar-venta.ts` | `facturas.create` |

---

## Servicio técnico

| UI | API | lib | Permiso |
|----|-----|-----|---------|
| `/servicio-tecnico` | `/api/ots*` | `lib/ots.ts` | `servicio.*` |
| `/servicio-tecnico/mapa` | `/api/tracking/mapa` | `lib/tracking-automation.ts` | `tracking.read` |
| `/servicio-tecnico/preventivo` | `/api/mantenimiento*` | — | `preventivo.*` |
| Equipo detalle | `/api/equipos/[id]*` | historia clínica | `servicio.*` |

---

## Configuración

| UI | API | lib | Permiso |
|----|-----|-----|---------|
| `/configuracion` | — | — | varios |
| `/configuracion/usuarios` | `/api/usuarios`, `/api/roles` | `lib/rbac.ts` | `usuarios.*` |
| `/configuracion/emisores` | `/api/emisores*` | `lib/afip/` | `emisores.*` |
| `/configuracion/plantillas` | `/api/plantillas*` | `lib/plantillas/` | `config.manage_billing_templates` |
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
| Meta WhatsApp | `/api/webhooks/whatsapp` | verify token + HMAC |
| Microsoft Graph | OAuth + `worker:crm-graph` | OAuth tokens en BD |
| Cron cobranzas | `/api/cron/cobranzas-vencimientos` | `CRON_SECRET` |

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
