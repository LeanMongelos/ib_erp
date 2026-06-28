# AI-MASTER — Protocolo obligatorio antes de tocar el ERP

> **Audiencia:** agentes de IA (Cursor, CI, copilots) y desarrolladores.  
> **Objetivo:** minimizar regresiones. **Leer completo antes de editar cualquier archivo.**

---

## 1. Jerarquía de verdad (ante conflicto, gana el de arriba)

| Prioridad | Fuente | Qué define |
|-----------|--------|------------|
| 1 | [`prisma/schema.prisma`](../prisma/schema.prisma) | Modelo de datos real |
| 2 | [`lib/rbac.ts`](../lib/rbac.ts) | Permisos y roles en runtime |
| 3 | [`AGENTS.md`](../AGENTS.md) | Reglas operativas y checklist |
| 4 | [`00-SISTEMA-PUNTA-A-PUNTA.md`](00-SISTEMA-PUNTA-A-PUNTA.md) | Flujos end-to-end |
| 5 | [`00-INFRAESTRUCTURA.md`](00-INFRAESTRUCTURA.md) | Dev, Docker, VPS, CI/CD |
| 6 | [`00-INDICE-CANONICO.md`](00-INDICE-CANONICO.md) | Qué doc usar; evitar duplicados |
| 7 | [`00-ARQUITECTURA-IMPLEMENTADA.md`](00-ARQUITECTURA-IMPLEMENTADA.md) | Patrones de código |
| 8 | Docs de dominio `01–08` | Reglas de negocio por módulo |
| 9 | [`10-roadmap.md`](10-roadmap.md) | Plan futuro — **no** asumir implementado |

**Regla:** si un doc de diseño contradice el código, **el código manda**. Actualizar el doc, no inventar comportamiento.

---

## 2. Mapa mental del sistema (30 segundos)

```
Usuario → Browser → Next.js (App Router)
                      ├─ middleware.ts → páginas dashboard (JWT cookie)
                      ├─ Server Components → prisma (lectura SSR)
                      └─ app/api/* → requirePermission → prisma → JSON

Datos: PostgreSQL · Archivos: storage/ o S3 · Colas: Redis/BullMQ · Automatización: n8n
```

**Naming crítico:** la UI de **clientes** vive bajo `/crm/*`, no `/clientes/*`.

---

## 3. Protocolo de lectura por tipo de tarea

| Si vas a… | Leer primero | Luego |
|-----------|--------------|-------|
| Cualquier cambio | Este archivo + `AGENTS.md` | `00-INDICE-CANONICO.md` |
| Nueva API | `14-CONTRATOS-FRONTERAS.md` | `11-API-ENDPOINTS.md`, `lib/rbac.ts` |
| Nueva página dashboard | `22-MAPA-MODULOS.md` | `lib/page-guard.ts`, permiso en rbac |
| Factura / AFIP / PDF | `13-FLUJOS-COMERCIALES.md` | `02-facturacion-afip.md`, `12-PLANTILLAS-PDF.md` |
| Cliente / sucursal / mapa | `03-clientes.md` | `13-FLUJOS-COMERCIALES.md` §7 |
| CRM / inbox / webhooks | `05-crm-omnicanal.md` | `15-ESTADOS-WORKERS-SEGURIDAD.md` |
| Inventario / OC | `06-inventario-y-compras.md` | `lib/inventario*.ts` |
| Alquiler equipos / cuotas | `24-alquiler-equipos.md` | `lib/alquiler/`, `cronograma-cobranzas.ts` |
| OT / mapa ST | `07-servicio-tecnico.md` | `lib/ots.ts`, `lib/tracking.ts` |
| Schema / migración | `schema.prisma` | `09-modelo-de-datos.md` (referencia) |
| Deploy / prod | `00-INFRAESTRUCTURA.md` | `16-DESPLIEGUE-PRODUCCION.md` |
| Bug en dev (CSS, Prisma) | `DEV-ESTABILIDAD.md` | `18-RUNBOOK-OPERACIONES.md` |
| UI / mensajes español | `REGLAS-INTERFAZ-ESPAÑOL.md` | `lib/errores.ts` |

---

## 4. Reglas de oro (resumen — detalle en AGENTS.md)

1. **Diff mínimo** — no refactorizar fuera del alcance.
2. **Backend autoriza** — `requirePermission` en API; `requirePagePermission` en páginas sensibles; `useCan` solo UX.
3. **No server en client** — nunca `lib/prisma`, `lib/storage`, `lib/api-auth` en `'use client'`.
4. **Validación compartida** — archivos `*-client.ts` sin Prisma para formularios.
5. **Prisma singleton** — solo `import { prisma } from '@/lib/prisma'`.
6. **Respuestas API** — `plain()` + `handleApiError()` + headers de seguridad.
7. **Fiscal** — no borrar facturas emitidas; respetar estados AFIP.
8. **Secretos** — nunca en repo; redactar en JSON al cliente (`lib/security/redact.ts`).
9. **Plantillas PDF** — una predeterminada por tipo; previews en cola.
10. **Post schema change** — migración + `prisma generate` + reinicio dev.

---

## 5. Checklist obligatorio antes de commit

```
[ ] Leí AI-MASTER + docs del módulo tocado
[ ] npx tsc --noEmit (sin errores nuevos)
[ ] API nueva tiene requirePermission y handleApiError
[ ] Página nueva con datos sensibles tiene requirePagePermission
[ ] No importé módulos server-only en client components
[ ] Si cambié schema: migración SQL incluida
[ ] Si agregué permiso: seed o scripts/sync-* correspondiente
[ ] Mensajes de error en español (lib/errores.ts)
[ ] No commiteé .env, storage/, .next/
[ ] Probé flujo mínimo manual o smoke/e2e si aplica
```

---

## 6. Anti-patrones que rompen el ERP

| ❌ No hacer | ✅ Hacer |
|------------|---------|
| `new PrismaClient()` en app/ | `import { prisma } from '@/lib/prisma'` |
| Confiar en `useCan` para seguridad | `requirePermission` en API |
| Enviar objeto Prisma crudo al cliente | `plain()` o select explícito |
| Importar `lib/storage` en cliente | API route + URL firmada / media route |
| Borrar factura con CAE | Anular según flujo AFIP |
| 3 previews PDF simultáneos en dev | Cola secuencial (ver doc 12) |
| Hardcodear permisos en componente | Usar claves de `lib/rbac.ts` |
| `$queryRaw` con input usuario sin bind | Prisma parameterized o Zod previo |
| Cambiar middleware matcher sin revisar APIs públicas | Webhooks/cron/n8n quedan fuera a propósito |

---

## 7. APIs públicas (sin middleware — protección propia)

Estas rutas **no** pasan por `middleware.ts`. Cada una valida su propio mecanismo:

| Ruta | Protección |
|------|------------|
| `/api/auth/*` | NextAuth |
| `/api/webhooks/meta`, `/api/webhooks/whatsapp` | Firma HMAC + appSecret |
| `/api/n8n/*` | Header `Authorization` + `N8N_API_KEY` |
| `/api/cron/*` | Header `Bearer CRON_SECRET` |
| `/api/integraciones/graph/callback` | State HMAC firmado |
| `/api/health` | Ping público (sin datos sensibles) |

---

## 8. Flujos que no se pueden romper

Ver diagramas completos en [`00-SISTEMA-PUNTA-A-PUNTA.md`](00-SISTEMA-PUNTA-A-PUNTA.md).

1. **Login** → JWT con roles/permisos → middleware dashboard  
2. **OT → Presupuesto → Aprobación → Factura → AFIP**  
3. **Venta equipo** → sucursal obligatoria → provisión inventario → mapa ST  
4. **CRM ingest** → conversación → vincular cliente → embudo  
5. **Plantilla PDF** → editor → preview → impresión factura/presupuesto  
6. **Alquiler** → activar → cron cuotas → Cobranzas (facturar → AFIP → cobrar) → sync cuota COBRADA  
7. **Deploy** → git push → GitHub Actions → VPS script → PM2 + Caddy  

---

## 9. Comandos de verificación

```bash
npm run dev              # Desarrollo (puerto .env, default 3001)
npm run dev:reset        # Tras prisma generate o CSS roto
npm run smoke            # Prisma + contabilidad (DB)
npm run e2e              # HTTP: CRM, sucursales, geocoding
npx tsc --noEmit         # Typecheck
npm run build            # Build producción
npm run lint             # ESLint
```

---

## 10. Dónde está cada capa

| Capa | Ubicación |
|------|-----------|
| UI páginas | `app/(dashboard)/**/page.tsx` |
| UI componentes | `components/{modulo}/` |
| API REST | `app/api/**/route.ts` |
| Negocio server | `lib/{modulo}/` |
| Auth / RBAC | `lib/auth.ts`, `lib/api-auth.ts`, `lib/rbac.ts` |
| Validación Zod | `lib/validation.ts` |
| Workers async | `worker/*.ts` |
| Migraciones | `prisma/migrations/` |
| Deploy VPS | `scripts/vps-*.sh`, `.github/workflows/deploy.yml` |

---

## 11. Glosario mínimo

Ver [`20-GLOSARIO-DOMINIO.md`](20-GLOSARIO-DOMINIO.md). Términos clave:

- **Emisor** — entidad fiscal que factura (CUIT, certificado AFIP)
- **Sucursal** — sede física del cliente (`ClienteSucursal`) con geocodificación
- **OT** — orden de trabajo de servicio técnico
- **CAE** — código AFIP de autorización electrónica
- **Embudo** — pipeline comercial CRM (`NegocioEmbudo`)
- **Contrato alquiler** — alquiler mensual de unidades inventario (`ContratoAlquiler`)
- **Cuota alquiler** — cargo mensual por línea (`CuotaAlquiler`, período `YYYY-MM`)
- **MRR** — ingreso recurrente mensual de contratos activos

---

*Última actualización: módulo alquiler equipos + cronograma cobranzas unificado. Mantener este archivo cuando cambie arquitectura transversal.*
