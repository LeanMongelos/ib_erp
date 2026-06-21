# AGENTS.md — Guía para agentes de código (Cursor / CI)

> **Proyecto:** iBiomédica ERP · Cliente: Ingeniería Biomédica (Formosa, AR)  
> **Stack:** Next.js 14 App Router · Prisma 7 · PostgreSQL · NextAuth · Tailwind · @react-pdf/renderer

Este archivo es la **fuente de verdad operativa** para no romper módulos al tocar otros. Leer antes de implementar.

---

## 1. Reglas de oro (NO negociables)

1. **Cambios mínimos** — No refactorizar ni “mejorar” código no relacionado con la tarea.
2. **UI y errores en español** — Ver [`docs/REGLAS-INTERFAZ-ESPAÑOL.md`](docs/REGLAS-INTERFAZ-ESPAÑOL.md) y [`lib/errores.ts`](lib/errores.ts).
3. **Autorización en backend** — `requirePermission` / `requireAuth` en **toda** API; la UI solo oculta botones.
4. **Cliente vs servidor** — Ver [`docs/14-CONTRATOS-FRONTERAS.md`](docs/14-CONTRATOS-FRONTERAS.md). **Nunca** importar `lib/storage.ts`, `fs`, `lib/api-auth.ts`, o `*.server.ts` desde componentes `'use client'`. Validaciones compartidas: usar archivos `-client.ts` sin Prisma (ej. `validar-sucursal-equipo-client.ts`).
5. **Prisma** — Usar `lib/prisma.ts` (proxy). Tras cambiar schema: `npx prisma generate` + reiniciar dev. Ver [`docs/DEV-ESTABILIDAD.md`](docs/DEV-ESTABILIDAD.md).
6. **Plantillas PDF** — Una predeterminada por tipo (`predeterminado: true`). Previews en cola (no 3 PDFs simultáneos en dev). Ver [`docs/12-PLANTILLAS-PDF.md`](docs/12-PLANTILLAS-PDF.md).
7. **Dinero / fiscal** — No borrar físicamente facturas emitidas. Respetar estados AFIP.
8. **No commitear** `.env`, `storage/`, `.next/` unless explicitly asked.

---

## 2. Estructura del repositorio

```
app/
  (auth)/login/          # Login
  (dashboard)/           # UI protegida por middleware
  api/                   # Route handlers REST (ver docs/11-API-ENDPOINTS.md)
components/              # React client + shared UI
lib/                     # Lógica de negocio, server-only helpers
  plantillas/            # Motor PDF + editor
  afip/                  # Cliente AFIP
  errores.ts             # Mensajes UI en español
  prisma.ts              # Cliente Prisma singleton
  rbac.ts                # Permisos
  api-auth.ts            # requireAuth / requirePermission
prisma/
  schema.prisma          # Modelo de datos
  seed.ts                # Datos demo + plantillas default
docs/                    # Documentación (este índice)
worker/                  # BullMQ workers (AFIP, CRM email, cobranzas)
scripts/                 # dev-reset, e2e-smoke, e2e-revision, demo-historial-graciela
public/                  # Assets estáticos (logo.png)
storage/                 # Archivos subidos (gitignored)
```

---

## 3. Flujos críticos (no romper)

| Flujo | Documento |
|-------|-----------|
| OT → Presupuesto → Aprobación → Factura | [`docs/13-FLUJOS-COMERCIALES.md`](docs/13-FLUJOS-COMERCIALES.md) |
| Venta de equipos (inventario → cliente) | [`docs/06-inventario-y-compras.md`](docs/06-inventario-y-compras.md) §6 · `lib/equipos/provisionar-venta.ts` |
| Sucursales + geocodificación + mapa | [`docs/03-clientes.md`](docs/03-clientes.md) · `lib/geocoding.ts` · `components/clientes/SucursalesEditor.tsx` |
| CRM bandeja + historial cliente | [`docs/05-crm-omnicanal.md`](docs/05-crm-omnicanal.md) · `ClienteHistorialInbox.tsx` |
| Factura equipo → sucursal obligatoria | [`docs/13-FLUJOS-COMERCIALES.md`](docs/13-FLUJOS-COMERCIALES.md) §7 · `validar-sucursal-equipo-client.ts` (cliente) / `validar-sucursal-equipo.ts` (servidor) |
| Plantillas / PDF / editor visual | [`docs/12-PLANTILLAS-PDF.md`](docs/12-PLANTILLAS-PDF.md) |
| Facturación AFIP | [`docs/02-facturacion-afip.md`](docs/02-facturacion-afip.md) |
| RBAC | [`docs/01-roles-y-permisos.md`](docs/01-roles-y-permisos.md) |
| Estados / workers / seguridad | [`docs/15-ESTADOS-WORKERS-SEGURIDAD.md`](docs/15-ESTADOS-WORKERS-SEGURIDAD.md) |
| Modelo Prisma | [`docs/09-modelo-de-datos.md`](docs/09-modelo-de-datos.md) + `prisma/schema.prisma` |

---

## 4. Comandos útiles

```bash
npm run dev              # Desarrollo
npm run dev:reset        # Borra .next + prisma generate + dev (Windows-friendly)
npm run smoke            # Smoke test Prisma + contabilidad
npm run e2e              # E2E CRM, sucursales, historial, geocoding
npm run e2e:all          # smoke + e2e
npx prisma migrate deploy
npx prisma generate
npm run db:seed          # Seed demo (plantillas, usuarios, catálogos)
```

---

## 5. Checklist antes de cerrar un PR / tarea

- [ ] `npx tsc --noEmit` sin errores
- [ ] No importar módulos server-only en `'use client'`
- [ ] Errores API pasan por `handleApiError` (mensajes en español)
- [ ] Permiso RBAC correcto en API nueva
- [ ] Si tocaste `schema.prisma`: migración + generate documentados
- [ ] Si tocaste plantillas: probar preview GET y editor visual
- [ ] Si UI sin estilos en dev: `npm run dev:reset` (no es bug de negocio)

---

## 6. Índice completo de documentación

Ver [`docs/README.md`](docs/README.md) — incluye arquitectura, APIs, contratos y reglas de negocio por módulo.
