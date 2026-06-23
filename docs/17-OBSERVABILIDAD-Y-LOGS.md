# 17 · Observabilidad y logs

> Cómo diagnosticar errores reportados por usuarios y distinguir auditoría de logs técnicos.

---

## 1. Dos sistemas distintos

| | **Auditoría** | **Logs del sistema** |
|---|---------------|----------------------|
| **Propósito** | Quién cambió qué (negocio) | Qué se rompió (técnico) |
| **Modelo** | `AuditLog` | `SystemLog` |
| **UI** | `/configuracion/auditoria` | `/configuracion/logs` |
| **Permiso** | `auditoria.read` | `logs.read` |
| **Helper** | `lib/audit.ts` → `registrarAuditoria()` | `lib/error-log.ts` → `registrarError()` |
| **Contenido** | acción, entidad, antes/después JSON | mensaje, stack, ruta, origen, usuario |
| **Retención** | Indefinida (compliance) | **15 días** (auto-purge) |

**Regla:** no mezclar stack traces en auditoría ni acciones de usuario en logs técnicos.

---

## 2. Captura automática

### API (errores 500)

`lib/api-auth.ts` → `handleApiError()` → `persistirErrorApi()`:

- Mensaje y stack del error
- Usuario de sesión (si hay)
- Ruta y método HTTP (si se pasa `ctx.req`)
- Origen: `api`

### Workers

| Worker | Origen en log |
|--------|---------------|
| `worker/afip-worker.ts` | `worker-afip` |
| `worker/crm-graph-worker.ts` | `worker-crm` |
| `worker/cobranzas-vencimientos-worker.ts` | `worker-cobranzas` |

Usan `registrarErrorDesdeExcepcion()` en bloques `catch`.

### Manual (desde código server)

```typescript
import { registrarError } from '@/lib/error-log'

await registrarError({
  origen: 'api',
  mensaje: 'Descripción corta',
  ruta: '/api/ejemplo',
  metadata: { facturaId: '...' },
})
```

Nunca debe fallar la operación principal (fire-and-forget).

---

## 3. UI de logs (`/configuracion/logs`)

- Filtros: día (últimos 15), nivel, origen, usuario, búsqueda texto
- Pills por día con contador de eventos
- Expandir fila → stack trace + metadata JSON
- Paginación 40 por página

Roles con acceso: **SUPERADMIN** (wildcard), **GERENTE** (`logs.read`).

Tras agregar permiso en BD existente:

```bash
npx tsx --env-file=.env scripts/sync-logs-permiso.ts
```

Usuarios ya logueados deben **cerrar sesión y volver a entrar** para ver la tarjeta en Configuración.

---

## 4. API

| Método | Ruta | Permiso |
|--------|------|---------|
| GET | `/api/logs` | `logs.read` |

Query params: `page`, `limit`, `q`, `nivel` (ERROR/WARN/INFO), `origen`, `usuarioId`, `dia` (YYYY-MM-DD).

Respuesta incluye `resumenDias` (últimos 15 días) en `filtros.dias`.

---

## 5. Retención y purga

- Constante: `LOG_RETENTION_DAYS = 15` en `lib/error-log.ts`
- Purga en caliente: como máximo 1 vez por hora al registrar un log
- Purga manual / cron:

```bash
npm run logs:purge
```

Cron sugerido (VPS): diario a las 04:00 — ver [`16-DESPLIEGUE-PRODUCCION.md`](16-DESPLIEGUE-PRODUCCION.md) §8.

---

## 6. Flujo cuando un usuario reporta un error

1. Pedir **hora aproximada**, **pantalla** y **acción** (ej. “facturar equipo”).
2. Ir a **Configuración → Logs del sistema**.
3. Filtrar por **día** y buscar ruta (`/api/facturas`, `/dashboard`, etc.).
4. Abrir stack trace → reproducir en dev con mismos datos.
5. Si fue acción intencional del usuario → revisar también **Auditoría**.

---

## 7. Errores que NO aparecen en logs

- 400 validación Zod (esperado)
- 401 / 403 (auth — no se persisten como ERROR)
- Errores solo en consola del navegador (usar DevTools)
- BD caída antes de conectar Prisma → ver runbook §1

---

## 8. Mejoras futuras (opcional)

- Sentry / OpenTelemetry para trazas distribuidas
- Alertas email cuando `nivel=ERROR` supera umbral
- Health endpoint `/api/health` (no implementado aún)
