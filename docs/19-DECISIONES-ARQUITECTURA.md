# 19 · Decisiones de arquitectura (ADR resumido)

> Por qué el sistema está armado así. Útil para agentes IA y devs nuevos.

---

## ADR-001 · Monolito Next.js (App Router)

**Decisión:** Una sola app Next.js 14 con UI + API route handlers + server components.

**Motivo:** Equipo pequeño, dominio acoplado (OT ↔ factura ↔ cliente), despliegue simple en VPS.

**Alternativa descartada:** Microservicios — overhead operativo sin beneficio claro a esta escala.

**Consecuencia:** Workers separados solo para tareas async (AFIP, email, cobranzas).

---

## ADR-002 · PostgreSQL + Prisma 7

**Decisión:** PostgreSQL como única BD relacional; Prisma con adapter `@prisma/adapter-pg`.

**Motivo:** Transacciones ACID, JSON para auditoría, tipado TypeScript, migraciones versionadas.

**Consecuencia:** Siempre `lib/prisma.ts`; tras cambio schema → `migrate` + `generate` + reiniciar dev.

---

## ADR-003 · RBAC en JWT (permisos resueltos al login)

**Decisión:** Permisos en token de sesión; catálogo en `lib/rbac.ts` + tablas `Permiso`/`RolPermiso`.

**Motivo:** Evitar join de permisos en cada request.

**Consecuencia:** Cambios de rol requieren re-login. Autorización **real** en API (`requirePermission`), no solo UI.

---

## ADR-004 · Split cliente / servidor (`-client.ts`)

**Decisión:** Validaciones compartidas UI/API en archivos `-client.ts` sin Prisma. Lógica server en `lib/` sin importar desde `'use client'`.

**Motivo:** Next.js no permite `fs`, Prisma ni `api-auth` en bundle cliente.

**Ejemplo:** `validar-sucursal-equipo-client.ts` (formulario) vs `validar-sucursal-equipo.ts` (API).

Ver [`14-CONTRATOS-FRONTERAS.md`](14-CONTRATOS-FRONTERAS.md).

---

## ADR-005 · Sucursales en tres capas

**Decisión:**

| Capa | Entidad | Rol |
|------|---------|-----|
| Fiscal | `Cliente.direccion` | Sede administrativa |
| Catálogo | `ClienteSucursal` | Sedes geocodificadas |
| Operativa | `ItemFactura.sucursalInstalacionId`, `Equipo.sucursalId` | Dónde está el equipo |

**Motivo:** Un hospital tiene muchas sedes; cada venta instala en una sede concreta.

---

## ADR-006 · Auditoría vs logs técnicos

**Decisión:** Tablas separadas `AuditLog` y `SystemLog`.

**Motivo:** Compliance (quién cambió qué) vs diagnóstico (stack traces). Retención distinta (15 días logs).

Ver [`17-OBSERVABILIDAD-Y-LOGS.md`](17-OBSERVABILIDAD-Y-LOGS.md).

---

## ADR-007 · AFIP async con BullMQ + Redis

**Decisión:** Cola `afip-emision` procesada por `worker:afip`; fallback síncrono sin Redis.

**Motivo:** WSFE puede tardar; no bloquear HTTP del usuario.

---

## ADR-008 · Storage abstracto (local / S3)

**Decisión:** `lib/storage.ts` con driver `local` (dev) o `s3` (MinIO prod).

**Motivo:** Certificados AFIP, logos plantillas, adjuntos — mismo API sin cambiar código de negocio.

---

## ADR-009 · UI y errores en español

**Decisión:** `lib/errores.ts` + `handleApiError`; mensajes Zod traducidos.

**Motivo:** Usuarios finales en Argentina; ver [`REGLAS-INTERFAZ-ESPAÑOL.md`](REGLAS-INTERFAZ-ESPAÑOL.md).

---

## ADR-010 · Geocodificación Nominatim (sin API key)

**Decisión:** `GET /api/geocoding` → OpenStreetMap Nominatim con rate limit conservador.

**Motivo:** Costo cero; validación obligatoria en mapa antes de guardar sucursal.

---

## Cuándo revisar estas decisiones

- Equipo > 5 devs con ownership por módulo → evaluar extracción de servicios
- Multi-tenant (varias empresas) → schema + auth redesign
- Volumen AFIP alto → dedicar cluster Redis/workers
