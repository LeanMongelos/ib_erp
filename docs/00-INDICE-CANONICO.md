# 00 — Índice canónico (eliminar confusión entre docs)

> **Propósito:** un solo lugar para saber **qué documento manda** en cada tema.  
> Evita leer 26 archivos con información repetida.

---

## Fuentes únicas por tema

| Tema | Documento CANÓNICO | No duplicar en |
|------|-------------------|----------------|
| Protocolo IA | [`AI-MASTER.md`](AI-MASTER.md) | — |
| Reglas agente | [`../AGENTS.md`](../AGENTS.md) | CONTRIBUTING (solo enlace) |
| Flujo punta a punta | [`00-SISTEMA-PUNTA-A-PUNTA.md`](00-SISTEMA-PUNTA-A-PUNTA.md) | README §visión |
| Infra dev/prod | [`00-INFRAESTRUCTURA.md`](00-INFRAESTRUCTURA.md) | 16 (operativa), scripts vps |
| Arquitectura código | [`00-ARQUITECTURA-IMPLEMENTADA.md`](00-ARQUITECTURA-IMPLEMENTADA.md) | 19 (ADRs) |
| Permisos runtime | [`../lib/rbac.ts`](../lib/rbac.ts) | 01 (diseño), 22 (mapa) |
| Modelo datos | [`../prisma/schema.prisma`](../prisma/schema.prisma) | 09 (referencia histórica) |
| Catálogo API | [`11-API-ENDPOINTS.md`](11-API-ENDPOINTS.md) | 22 (solo rutas principales) |
| Cliente/servidor | [`14-CONTRATOS-FRONTERAS.md`](14-CONTRATOS-FRONTERAS.md) | AGENTS §4 |
| **Clientes + equipos (modelo + API)** | [`CLIENTES-EQUIPOS-MODELO-API.md`](CLIENTES-EQUIPOS-MODELO-API.md) | 03, 07, 09 |
| Handoff continuidad / estado reciente | [`HANDOFF-CONTINUACION-ERP.md`](HANDOFF-CONTINUACION-ERP.md) | — |
| **Handoff integración ML / visión** | [`HANDOFF-INTEGRACION-ML-VISION.md`](HANDOFF-INTEGRACION-ML-VISION.md) | — |
| Flujos comerciales | [`13-FLUJOS-COMERCIALES.md`](13-FLUJOS-COMERCIALES.md) | 02, 06, 07, 24 |
| Alquiler equipos | [`24-alquiler-equipos.md`](24-alquiler-equipos.md) | 06 §stock, 13 §cobranzas |
| PDF / plantillas | [`12-PLANTILLAS-PDF.md`](12-PLANTILLAS-PDF.md) | 02 §plantillas, 08 §3 |
| Estados + workers | [`15-ESTADOS-WORKERS-SEGURIDAD.md`](15-ESTADOS-WORKERS-SEGURIDAD.md) | 00 §workers |
| Logs vs auditoría | [`17-OBSERVABILIDAD-Y-LOGS.md`](17-OBSERVABILIDAD-Y-LOGS.md) | 08 §11, 18 |
| Deploy producción | [`16-DESPLIEGUE-PRODUCCION.md`](16-DESPLIEGUE-PRODUCCION.md) | 00-INFRA §prod |
| Troubleshooting | [`18-RUNBOOK-OPERACIONES.md`](18-RUNBOOK-OPERACIONES.md) | DEV-ESTABILIDAD (solo HMR) |
| Español UI | [`REGLAS-INTERFAZ-ESPAÑOL.md`](REGLAS-INTERFAZ-ESPAÑOL.md) | `lib/errores.ts` (implementación) |
| Mapa rápido módulos | [`22-MAPA-MODULOS.md`](22-MAPA-MODULOS.md) | README §rutas |
| Testing | [`21-TESTING-Y-CALIDAD.md`](21-TESTING-Y-CALIDAD.md) | AGENTS checklist |
| Roadmap futuro | [`10-roadmap.md`](10-roadmap.md) | No mezclar con "implementado" |

---

## Documentos de dominio (negocio)

| Módulo | Doc | Rutas UI | Prefijo permiso API |
|--------|-----|----------|---------------------|
| Clientes | [`03-clientes.md`](03-clientes.md) | `/crm/*` | `clientes.*` |
| CRM omnicanal | [`05-crm-omnicanal.md`](05-crm-omnicanal.md) | `/crm/inbox`, `/crm/embudo` | `crm.*` |
| Facturación | [`02-facturacion-afip.md`](02-facturacion-afip.md) | `/facturacion/*` | `facturas.*` |
| Presupuestos | (en 13) | `/presupuestos/*` | `presupuestos.*` |
| Cobranzas | (en 13, 08, **24**) | `/cobranzas` | `cobranzas.*` |
| Alquiler equipos | [`24-alquiler-equipos.md`](24-alquiler-equipos.md) | `/alquiler/*` | `alquiler.*` |
| Inventario | [`06-inventario-y-compras.md`](06-inventario-y-compras.md) | `/inventario`, `/compras` | `inventario.*`, `compras.*` |
| Proveedores | [`04-proveedores.md`](04-proveedores.md) | `/proveedores/*` | `proveedores.*` |
| Servicio técnico | [`07-servicio-tecnico.md`](07-servicio-tecnico.md) | `/servicio-tecnico/*` | `ots.*`, `equipos.*` |
| Configuración | [`08-configuracion.md`](08-configuracion.md) | `/configuracion/*` | `config.*`, `usuarios.*` |
| RBAC diseño | [`01-roles-y-permisos.md`](01-roles-y-permisos.md) | `/configuracion/usuarios` | — |

---

## Scripts: cuál usar

| Necesidad | Script | NO usar |
|-----------|--------|---------|
| Smoke DB | `npm run smoke` → `e2e-smoke.ts` | — |
| Smoke HTTP | `npm run smoke:http` → `e2e-smoke.mjs` (servidor levantado) | — |
| E2E HTTP | `npm run e2e` → `e2e-revision.ts` | — |
| Dev estable | `npm run dev:reset` | borrar node_modules sin motivo |
| Deploy VPS | GitHub Actions → `vps-deploy-from-git.sh` | `vps-deploy-remote.js` (bootstrap inicial) |
| Permiso logs | `scripts/sync-logs-permiso.ts` | editar BD a mano |

---

## Mantenimiento de docs

Al cambiar código, actualizar **solo el canónico** del tema:

| Cambio en código | Actualizar |
|------------------|------------|
| Nueva ruta API | `11-API-ENDPOINTS.md` + `22-MAPA-MODULOS.md` |
| Nuevo permiso | `lib/rbac.ts` + seed + `01-roles-y-permisos.md` |
| Nuevo modelo Prisma | migración + `schema.prisma` (+ 09 si entidad nueva) |
| Nuevo worker | `15-ESTADOS-WORKERS-SEGURIDAD.md` |
| Nuevo módulo (ej. alquiler) | doc canónico `24-*` + `11` + `22` + `AGENTS.md` + `AI-MASTER.md` |
| Cambio deploy | `00-INFRAESTRUCTURA.md` + `16-DESPLIEGUE-PRODUCCION.md` |

**No** copiar párrafos enteros entre docs — enlazar al canónico.
