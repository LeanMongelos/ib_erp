# Handoff — Continuación del ERP iBiomédica

> **Audiencia:** desarrollador u operador que retoma el proyecto con **Cursor** (u otro agente de IA).  
> **Última actualización:** 2026-07-02 · **Rama principal:** `master` · **Commit de referencia:** ver `git log` (post rediseño de comprobantes)  
> **Producción:** https://erp-ibiomedica.com.ar

Este documento resume **qué se hizo recientemente**, **cómo venimos trabajando**, **estado actual** y **próximos pasos**. Es la lectura obligatoria **antes** de cualquier tarea nueva si no tenés contexto de la conversación previa.

---

## 0. Prompt sugerido para Cursor (copiar al iniciar chat)

```
Estoy retomando el ERP iBiomédica. Leé en este orden:
1. docs/HANDOFF-CONTINUACION-ERP.md (este handoff — estado y pendientes)
2. docs/AI-MASTER.md + AGENTS.md (reglas del repo)
3. docs/00-INDICE-CANONICO.md (qué doc manda por tema)

Contexto clave:
- Producción: erp-ibiomedica.com.ar, VPS DonWeb, deploy vía push a master → GitHub Actions
- AFIP en go-live: emisor PRODUCCIÓN, PtoVta 12, certificado cargado; falta confirmar primera factura real post-fix B/C (commit 0243e49)
- No commitear .env ni secrets

Continuá desde la sección "Pendientes prioritarios" del handoff.
```

---

## 1. Qué es este proyecto

| Ítem | Valor |
|------|--------|
| Cliente | Ingeniería Biomédica — Formosa, Argentina |
| Repo GitHub | `LeanMongelos/ib_erp` |
| Stack | Next.js 14 App Router, TypeScript, Prisma 7, PostgreSQL, NextAuth, Tailwind, BullMQ/Redis, @afipsdk/afip.js, @react-pdf/renderer |
| UI clientes | Rutas bajo `/crm/*` (no `/clientes/*`) |
| Idioma UI | Español (`lib/errores.ts`) |

**Reglas de trabajo (resumen):** cambios mínimos, backend autoriza con RBAC, no importar server-only en `'use client'`, no commitear `.env`/`storage`/`.next` salvo pedido explícito. Detalle en [`AGENTS.md`](../AGENTS.md) y [`AI-MASTER.md`](AI-MASTER.md).

---

## 2. Orden de lectura para un agente nuevo

| # | Documento | Para qué |
|---|-----------|----------|
| 1 | **Este archivo** | Estado reciente, prod, pendientes |
| 2 | [`AI-MASTER.md`](AI-MASTER.md) | Protocolo antes de editar |
| 3 | [`AGENTS.md`](../AGENTS.md) | Reglas, estructura, checklist |
| 4 | [`00-INDICE-CANONICO.md`](00-INDICE-CANONICO.md) | Fuente única por tema |
| 5 | [`00-INFRAESTRUCTURA.md`](00-INFRAESTRUCTURA.md) | VPS, Docker, CI/CD |
| 6 | [`GO-LIVE-AFIP-VPS.md`](GO-LIVE-AFIP-VPS.md) | Facturación fiscal en prod |
| 7 | [`22-MAPA-MODULOS.md`](22-MAPA-MODULOS.md) | Dónde está cada feature |

Handoffs temáticos adicionales:

| Tema | Doc |
|------|-----|
| Integración ML / visión (partner externo) | [`HANDOFF-INTEGRACION-ML-VISION.md`](HANDOFF-INTEGRACION-ML-VISION.md) |
| Modelo cliente ↔ equipo + API | [`CLIENTES-EQUIPOS-MODELO-API.md`](CLIENTES-EQUIPOS-MODELO-API.md) |

---

## 3. Infraestructura y producción

### 3.1 URLs y acceso

| Recurso | Valor |
|---------|--------|
| App producción | https://erp-ibiomedica.com.ar |
| Health check | `GET /api/health` → `{ ok, db, redis, commit }` |
| VPS | `149.50.152.115` · SSH puerto **5244** · usuario `root` |
| Código en VPS | `/opt/ibiomedica` |
| Panel hosting | DonWeb — reset password root desde panel si se pierde acceso SSH |

### 3.2 Deploy

```
git push origin master
  → GitHub Actions (.github/workflows/deploy.yml)
  → SSH al VPS
  → bash scripts/vps-deploy-from-git.sh
  → health check post-deploy (12 intentos)
```

**Importante (mejora 2026-07-01):** `vps-deploy-from-git.sh` ya **no hace `pm2 stop all`** durante el build. Solo pausa workers; la app `ibiomedica` sigue online. Incluye `ensure_app_online()` si algo falla.

### 3.3 Secretos (nunca en git)

Archivo: `/opt/ibiomedica/.env` en el VPS (y `.env` local en dev).

| Variable | Uso |
|----------|-----|
| `DATABASE_URL` | PostgreSQL |
| `NEXTAUTH_SECRET`, `NEXTAUTH_URL` | Sesión |
| `REDIS_URL` | Cola AFIP/cobranzas |
| `AFIP_ACCESS_TOKEN` | **Obligatorio** — token de [app.afipsdk.com](https://app.afipsdk.com) para `@afipsdk/afip.js` |
| `STORAGE_DRIVER=s3` + `S3_*` | Certificados AFIP en MinIO |
| `CRON_SECRET`, `INTEGRATION_SECRET` | Cron HTTP e integraciones |

Plantilla: [`.env.local.example`](../.env.local.example)

### 3.4 Levantar prod si cae (502)

Tras reinicio del VPS, Docker/PM2 pueden no volver solos. Bloque de recuperación (ejecutar **en el VPS**):

```bash
cd /opt/ibiomedica
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d postgres redis minio
pm2 resurrect 2>/dev/null || true
pm2 restart ibiomedica 2>/dev/null || pm2 start npm --name ibiomedica -- start
bash scripts/vps-start-workers.sh
pm2 save
systemctl restart caddy
curl -s http://127.0.0.1:3000/api/health
```

Scripts útiles: `scripts/vps-diagnose.sh`, `scripts/vps-health-check.sh`, `scripts/verify-prod-health.ps1` (desde Windows).

---

## 4. Trabajo reciente (commits relevantes)

### 2026-07-02 — Rediseño de comprobantes + brochure + entrega + fix cron

| Área | Cambio |
|------|--------|
| **Plantillas** | Factura/Presupuesto/Remito rediseñados con **motor HTML** (Puppeteer). Factura formato **AFIP** (letra, Pto Venta/Nº, CAE/QR, IVA discriminado en A e **IVA incluido por alícuota real** en B/C). Remito con **N° de serie** + firma. Ver [`12-PLANTILLAS-PDF.md`](12-PLANTILLAS-PDF.md). |
| **Migración plantillas** | `scripts/sync-plantillas-html.ts` (paso del deploy, idempotente): migra las plantillas de fábrica al HTML → **ya no hace falta "Restaurar fábrica" manual**. No toca plantillas personalizadas. |
| **Brochure por producto** | `Inventario.brochureUrl` (PDF ≤20 MB) + upload/serve; se ve en la ficha. Ver [`06-inventario-y-compras.md`](06-inventario-y-compras.md). |
| **Entrega factura+brochures** | `GET /api/facturas/[id]/entrega` → PDF único factura + brochures de los equipos vendidos (`pdf-lib`). Botón 📦 en la tabla de facturas. |
| **API ML lectura** | `GET /api/ml/clientes`, `/api/ml/equipos/[id]` (token `ML_API_KEY`, solo lectura). Ver [`HANDOFF-INTEGRACION-ML-VISION.md`](HANDOFF-INTEGRACION-ML-VISION.md). |
| **Errores 400** | `handleApiError` ahora nombra el campo/motivo (no solo "Datos inválidos"). |
| **Seguridad/infra** | Puertos internos (Postgres/Redis/MinIO/n8n) bindeados a `127.0.0.1`. **Cron:** el usuario `deploy` no existía → autodetección a `root` en `vps-install-cron.sh` (todas las tareas programadas estaban muertas). |

### `0243e49` — fix(afip): importes WSFE B/C

**Problema:** AFIP error **10018** al emitir Factura B/C — se enviaba IVA 21% (Id 5) cuando B/C exigen `ImpIVA=0` e `Iva` Id **3**.

**Archivos:**
- [`lib/afip/wsfe-importes.ts`](../lib/afip/wsfe-importes.ts) — `buildImportesWsfe()`
- [`lib/afip/client.ts`](../lib/afip/client.ts) — usa helper en facturas y NC
- [`scripts/test-wsfe-importes.ts`](../scripts/test-wsfe-importes.ts)

**Verificar en prod:** emitir Factura **B** a consumidor final (~$121 total) → debe quedar `EMITIDA` con CAE real.

---

### `cc51232` — feat: presupuestos, asignaciones, informe OT, deploy

| Área | Cambio |
|------|--------|
| **Presupuestos** | Autoguardado borrador (~1,5 s), aviso al salir, botón «Guardar y finalizar», respeta precios manuales en POST |
| **Asignaciones equipo↔cliente** | Tabla `equipos_asignaciones`, migración `20260703120000_equipo_asignaciones`, `lib/equipos/asignaciones.ts`, API `POST /api/equipos/[id]/trasladar`, UI pestaña Asignaciones en `HistoriaClinicaEquipo.tsx` |
| **Informe OT PDF** | Leyenda «Diagnóstico» entre Equipo y Descripción; «Tareas realizadas» (ex checklist) |
| **ML handoff** | `docs/HANDOFF-INTEGRACION-ML-VISION.md`, `npm run seed:ml-handoff`, `npm run export:ml-handoff` |
| **Deploy** | `ensure_app_online`, app principal online durante build; health check deploy 12 intentos |
| **Scripts ops** | `scripts/scheduled-commit-push.ps1`, `scripts/verify-prod-health.ps1` |

**Post-deploy prod (si no se corrió):**
```bash
npx prisma migrate deploy
npm run backfill:asignaciones   # opcional — historial asignaciones
```

---

### Commits anteriores (contexto)

| Commit | Tema |
|--------|------|
| `e94b7a6` | Tickets internos (adjuntos, feedback) |
| `b1626f4` | Módulo tickets / solicitudes internas |
| Presupuestos / alquiler / ventas | Ver `git log --oneline -30` |

---

## 5. Estado AFIP / facturación (go-live en curso)

### 5.1 Configuración actual del emisor (BD + UI)

| Campo | Valor |
|-------|--------|
| Razón social | INGENIERIA BIOMEDICA |
| CUIT | 20-24440827-4 |
| Ambiente | **PRODUCCIÓN** |
| PtoVta | **12** (RECE web services — constancia ARCA; **no usar 1** que es Factuweb imprenta) |
| Certificado | Cargado (.crt + .key) — alias `IB - LM DIGITAL SOLUTION` |
| Token SDK | `AFIP_ACCESS_TOKEN` en `.env` del VPS (cuenta [AfipSDK](https://app.afipsdk.com), lo arma el admin, **no el contador**) |

### 5.2 Errores AFIP ya vistos y solución

| Código | Causa | Solución |
|--------|-------|----------|
| **401** | Falta o token inválido `AFIP_ACCESS_TOKEN` | Cargar token AfipSDK en `.env` + `pm2 restart ibiomedica worker-afip --update-env` |
| **10013** | Factura **A** sin CUIT del cliente | Cargar CUIT en CRM o usar **Factura B** |
| **10018** | Factura **B/C** con IVA discriminado mal armado | Fix `0243e49` — redeploy |

### 5.3 Regla rápida tipo de factura

| Tipo | Cuándo | AFIP |
|------|--------|------|
| **A** | Cliente con CUIT (RI) | Discrimina IVA |
| **B** | Consumidor final / sin CUIT | Total con IVA incluido; `ImpIVA=0` ante AFIP |
| **C** | Casos monotributo / exento | Igual que B ante WSFE |

### 5.4 Checklist go-live

En la UI: **Configuración → Estado go-live / AFIP**  
En el VPS: `npm run go-live:check`

Pendiente operativo: **primera factura EMITIDA con CAE real** (sin texto «SIMULADO») tras deploy `0243e49`.

Docs: [`GO-LIVE-AFIP-VPS.md`](GO-LIVE-AFIP-VPS.md), [`AFIP-PRODUCCION.md`](AFIP-PRODUCCION.md), [`02-facturacion-afip.md`](02-facturacion-afip.md)

---

## 6. Cómo venimos trabajando (convenciones de la sesión)

1. **Commits:** solo cuando el usuario lo pide explícitamente. Mensajes en español o bilingüe corto, estilo `feat(scope):`, `fix(scope):`.
2. **Push a master** dispara deploy automático a producción.
3. **No commitear** `.env`, `.next/`, logs locales.
4. **Cursor:** regla always-on en [`.cursor/rules/ibiomedica-erp.mdc`](../.cursor/rules/ibiomedica-erp.mdc).
5. **Prisma:** tras cambiar schema → migración + `npx prisma generate`; en prod `migrate deploy`.
6. **UI en español;** errores vía `lib/errores.ts`.
7. **Cambios mínimos** — no refactorizar fuera del pedido.

---

## 7. Pendientes prioritarios (para el próximo operador)

### Alta prioridad

- [ ] Confirmar **primera factura real** (Factura B, PtoVta 12) post-deploy `0243e49`
- [ ] Verificar `/api/health` → `redis: ok` (en jul/2026 figuraba `error`; revisar `docker compose` + `REDIS_URL` + `worker-afip`)
- [ ] Ejecutar en prod si aplica: `npm run backfill:asignaciones`

### Media prioridad

- [ ] Configurar `ADMIN_NOTIFY_EMAIL` + SMTP si go-live marca FAIL en alertas
- [ ] Probar Factura **A** con cliente CUIT de prueba
- [ ] Revisar tarjeta go-live sin ítems FAIL

### Baja / backlog documentado

- Partner ML: ver [`HANDOFF-INTEGRACION-ML-VISION.md`](HANDOFF-INTEGRACION-ML-VISION.md)
- Roadmap general: [`10-roadmap.md`](10-roadmap.md)

---

## 8. Comandos frecuentes

```bash
# Desarrollo local
npm run dev
npm run dev:reset
npx tsc --noEmit

# Calidad
npm run test:invariants
npm run go-live:check          # en VPS con .env prod

# AFIP
npx tsx scripts/test-wsfe-importes.ts
npm run smoke:afip-homolog     # VPS, emisor homologación

# Datos / migraciones
npx prisma migrate deploy
npx prisma generate
npm run backfill:asignaciones
npm run seed:ml-handoff
npm run export:ml-handoff

# Prod (VPS)
bash scripts/vps-deploy-from-git.sh
pm2 status
pm2 logs ibiomedica --lines 50
```

---

## 9. Archivos clave tocados recientemente

| Archivo | Rol |
|---------|-----|
| `lib/afip/wsfe-importes.ts` | Importes WSFE A vs B/C |
| `lib/afip/client.ts` | Emisión CAE |
| `lib/ots/render-informe-pdf.tsx` | PDF informe OT |
| `components/servicio-tecnico/OTDetalle.tsx` | UI OT |
| `components/presupuestos/NuevoPresupuestoForm.tsx` | Autoguardado |
| `lib/equipos/asignaciones.ts` | Lógica asignaciones |
| `scripts/vps-deploy-from-git.sh` | Deploy sin tumbar app |
| `prisma/migrations/20260703120000_equipo_asignaciones/` | Schema asignaciones |

---

## 10. Contactos y accesos (completar por el equipo)

| Recurso | Responsable / notas |
|---------|---------------------|
| GitHub `LeanMongelos/ib_erp` | Leandro Mongelos |
| VPS DonWeb | Acceso root — password vía panel DonWeb |
| AfipSDK token | Cuenta en app.afipsdk.com |
| Certificado AFIP | Contador — CUIT 20-24440827-4, alias IB - LM DIGITAL SOLUTION |
| PtoVta WSFE | **12** (constancia ARCA RECE web services) |

---

## 11. Mantener este handoff

Al cerrar una sesión importante:

1. Actualizar **§4** (commits), **§5** (AFIP), **§7** (pendientes).
2. Cambiar **commit de referencia** y fecha en el encabezado.
3. No duplicar docs de dominio — enlazar al canónico en [`00-INDICE-CANONICO.md`](00-INDICE-CANONICO.md).
