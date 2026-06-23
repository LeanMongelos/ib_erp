# 21 · Testing y calidad

> Qué pruebas existen, qué cubren y cuándo ejecutarlas.

---

## 1. Pirámide actual

```
        ┌─────────────┐
        │  Manual QA  │  Flujos críticos en browser
        ├─────────────┤
        │  E2E scripts│  scripts/e2e-revision.ts
        ├─────────────┤
        │  Smoke      │  scripts/e2e-smoke.ts
        ├─────────────┤
        │  tsc + build│  Tipos + compilación Next
        └─────────────┘
```

No hay suite Jest/Vitest unitaria extensa aún — los scripts E2E validan integración real contra BD.

---

## 2. Comandos

| Comando | Duración | Cuándo |
|---------|----------|--------|
| `npx tsc --noEmit` | ~30s | Antes de cada PR; tras cambios de tipos |
| `npm run lint` | ~20s | Opcional pre-commit |
| `npm run smoke` | ~5s | Tras cambios Prisma/contabilidad/equipos |
| `npm run e2e` | ~30s | Tras CRM, sucursales, geocoding, clientes |
| `npm run e2e:all` | ~35s | Pre-deploy staging |
| `npm run build` | ~2min | **Obligatorio** antes de producción |

**Requisito:** Docker + PostgreSQL corriendo; `.env` con `DATABASE_URL`.

---

## 3. Smoke test (`scripts/e2e-smoke.ts`)

Valida:

- Delegates Prisma (alícuotas, contabilidad, cobranzas)
- `ensureAlicuotasIvaDefault`, `ensureContabilidadArgentina`
- Tablas críticas presentes
- `getEquipoHistoriaCompleta`, alertas componentes

**No cubre:** UI, login, facturación completa.

---

## 4. E2E revisión (`scripts/e2e-revision.ts`)

Valida integración:

- Rutas API clave (clientes, sucursales, geocoding, historial CRM)
- Creación cliente con sucursales
- Permisos y respuestas JSON
- Flujos documentados en [`13-FLUJOS-COMERCIALES.md`](13-FLUJOS-COMERCIALES.md)

Ver salida: `OK: N | Errores: 0`.

---

## 5. Checklist manual (pre-release)

- [ ] Login admin + técnico
- [ ] Alta cliente `/crm/nuevo` con sucursal en mapa
- [ ] Factura equipo con sucursal obligatoria
- [ ] OT crear → presupuesto → aprobar
- [ ] CRM inbox + historial cliente
- [ ] Configuración → Logs (error de prueba visible)
- [ ] Preview PDF plantilla (uno a la vez en dev)
- [ ] Favicon correcto en pestaña

---

## 6. CI recomendado (GitHub Actions — futuro)

```yaml
# Ejemplo mínimo
- run: npm ci
- run: npx prisma generate
- run: npm run build
- run: docker compose up -d postgres
- run: npx prisma migrate deploy
- run: npm run e2e:all
```

---

## 7. Qué hacer si falla un test

| Test | Acción |
|------|--------|
| smoke | Revisar migraciones; `npx prisma migrate deploy` |
| e2e geocoding | Nominatim rate limit — reintentar |
| e2e permisos | `npm run db:seed` o reset-role-permisos |
| build | Import server en client — ver [`14-CONTRATOS-FRONTERAS.md`](14-CONTRATOS-FRONTERAS.md) |
| tsc | Regenerar Prisma client |

Ver [`18-RUNBOOK-OPERACIONES.md`](18-RUNBOOK-OPERACIONES.md).

---

## 8. Scripts auxiliares (no son tests)

| Script | Uso |
|--------|-----|
| `demo-historial-graciela.ts` | Datos demo CRM |
| `sync-logs-permiso.ts` | Permiso logs.read en BD |
| `reset-role-permisos.ts` | Restaurar matriz de rol |
| `purge-system-logs.ts` | Limpieza logs > 15 días |
