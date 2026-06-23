# Contribuir a iBiomédica ERP

Guía breve para desarrolladores y agentes de código. La referencia completa está en **[AGENTS.md](AGENTS.md)**.

---

## Antes de codear

1. Leer **[AGENTS.md](AGENTS.md)** (reglas de oro).
2. Identificar módulo en **[docs/22-MAPA-MODULOS.md](docs/22-MAPA-MODULOS.md)**.
3. Si tocás flujo comercial → **[docs/13-FLUJOS-COMERCIALES.md](docs/13-FLUJOS-COMERCIALES.md)**.
4. Si tocás cliente/servidor → **[docs/14-CONTRATOS-FRONTERAS.md](docs/14-CONTRATOS-FRONTERAS.md)**.

---

## Entorno local

```bash
cp .env.local.example .env
docker compose up -d
npm install
npx prisma migrate deploy
npm run db:seed
npm run dev
```

Problemas de CSS: `npm run dev:reset`. Ver **[docs/DEV-ESTABILIDAD.md](docs/DEV-ESTABILIDAD.md)**.

---

## Convenciones

| Tema | Regla |
|------|-------|
| Idioma UI/errores | Español (`lib/errores.ts`) |
| API auth | `requirePermission('modulo.accion')` en cada route |
| Client components | No importar Prisma, `api-auth`, `storage`, `fs` |
| Validación compartida | Archivo `-client.ts` para UI; servidor aparte |
| Dinero | `Decimal` en Prisma; `plain()` al serializar |
| Migraciones | `prisma migrate dev` en dev; nombre descriptivo |
| Commits | Mensaje claro en español o inglés; no commitear `.env` |

---

## Checklist antes de PR

- [ ] `npx tsc --noEmit`
- [ ] `npm run smoke` (mínimo)
- [ ] `npm run e2e` si tocaste CRM/sucursales/geocoding
- [ ] Permiso RBAC en API nueva
- [ ] Errores vía `handleApiError`
- [ ] Docs actualizados si cambió contrato API o modelo
- [ ] `npm run build` antes de merge a main

Ver **[docs/21-TESTING-Y-CALIDAD.md](docs/21-TESTING-Y-CALIDAD.md)**.

---

## Documentación

Índice: **[docs/README.md](docs/README.md)**.

Al agregar feature:

- Endpoint → `docs/11-API-ENDPOINTS.md`
- Modelo Prisma → `docs/09-modelo-de-datos.md` + migración
- Config UI → `docs/08-configuracion.md`
- Runbook si hay operación nueva → `docs/18-RUNBOOK-OPERACIONES.md`

---

## Ayuda operativa

| Problema | Doc |
|----------|-----|
| BD caída, favicon, permisos | [docs/18-RUNBOOK-OPERACIONES.md](docs/18-RUNBOOK-OPERACIONES.md) |
| Deploy VPS | [docs/16-DESPLIEGUE-PRODUCCION.md](docs/16-DESPLIEGUE-PRODUCCION.md) |
| Logs vs auditoría | [docs/17-OBSERVABILIDAD-Y-LOGS.md](docs/17-OBSERVABILIDAD-Y-LOGS.md) |
