# 18 · Runbook de operaciones

> “Si pasa X, hacé Y” — referencia rápida para devs y operadores.

---

## 1. La app no carga / error en dashboard

| Síntoma | Causa probable | Solución |
|---------|----------------|----------|
| `Invalid prisma.*.findMany()` | PostgreSQL apagado | `docker compose up -d` → esperar healthy → recargar |
| `ECONNREFUSED` en logs | Docker Desktop cerrado (Windows) | Abrir Docker Desktop, luego `docker compose up -d` |
| 500 en `/dashboard` | BD caída o migración pendiente | `npx prisma migrate deploy` |
| Pantalla blanca | Build corrupto | `npm run build` o en dev: `npm run dev:reset` |

---

## 2. UI sin estilos (CSS roto)

**No es bug de negocio.** Caché webpack corrupta (común en Windows/HMR).

```bash
npm run dev:reset
```

Hard refresh en navegador: Ctrl+Shift+R.

Ver [`DEV-ESTABILIDAD.md`](DEV-ESTABILIDAD.md).

---

## 3. Favicon incorrecto en pestaña

```bash
npm run icons:generate
```

Recargar con Ctrl+Shift+R o ventana incógnito. Archivos: `app/favicon.ico`, `app/icon.png`, `app/apple-icon.png`.

---

## 4. Usuario no ve sección de Configuración

1. Verificar rol y permisos en `/configuracion/usuarios`.
2. Permiso específico (ej. `logs.read`) — correr sync si BD antigua:
   ```bash
   npx tsx --env-file=.env scripts/sync-logs-permiso.ts
   ```
3. **Cerrar sesión y volver a entrar** (JWT cachea permisos).

---

## 5. AFIP no emite / factura en PENDIENTE_CAE

| Paso | Acción |
|------|--------|
| 1 | Ver logs en Configuración → Logs (`origen: worker-afip` o `api`) |
| 2 | Verificar certificado emisor en `/configuracion/emisores` |
| 3 | Confirmar `REDIS_URL` y worker: `npm run worker:afip` |
| 4 | Sin Redis: emisión síncrona vía `POST /api/facturas/[id]/emitir` |
| 5 | Ambiente homolog vs producción en emisor |

Ver [`02-facturacion-afip.md`](02-facturacion-afip.md).

---

## 6. CRM / email no llega

| Paso | Acción |
|------|--------|
| 1 | Configuración → Integraciones → canal EMAIL |
| 2 | Worker correspondiente: `worker:crm-email` o `worker:crm-graph` |
| 3 | Logs con origen `worker-crm` |
| 4 | Variables `CRM_*_POLL_MS`, credenciales Graph/IMAP |

---

## 7. Cobranzas: no llegan avisos de vencimiento

```bash
npm run worker:cobranzas
# o cron HTTP:
curl -X POST https://erp.tudominio.com/api/cron/cobranzas-vencimientos \
  -H "Authorization: Bearer $CRON_SECRET"
```

Verificar `COBRANZA_NOTIFY_EMAIL` en `.env`.

---

## 8. Arrancar / apagar entorno local

```bash
# Encender
docker compose up -d
npm run dev

# Apagar
# Ctrl+C en terminal dev
docker compose down
```

Workers (terminales separadas):

```bash
npm run worker:afip
npm run worker:cobranzas
npm run worker:crm-graph
```

---

## 9. Restaurar permisos de un rol

```bash
npx tsx --env-file=.env scripts/reset-role-permisos.ts ADMINISTRACION
```

Fuente de verdad: `lib/rbac.ts` → `ROLE_PERMISSIONS`.

---

## 10. Datos demo CRM (Graciela / Clínica San Juan)

```bash
npx tsx --env-file=.env scripts/demo-historial-graciela.ts
```

Solo desarrollo/staging.

---

## 11. Verificación rápida post-cambio

```bash
npx tsc --noEmit
npm run smoke
npm run e2e        # si tocaste CRM, sucursales, geocoding
npm run build      # antes de deploy
```

Ver [`21-TESTING-Y-CALIDAD.md`](21-TESTING-Y-CALIDAD.md).

---

## 12. Integridad de datos (I2–I5) — reparación opcional

Chequeo completo post-deploy (solo lectura, bloquea errores críticos):

```bash
npm run integridad:prod
```

Para **advertencias reparables** (OTs con SLA vencido, presupuestos con vigencia pasada):

```bash
# 1. Informe sin cambios (default)
npm run integridad:reparar

# 2. Revisar salida I2 / Pr3 / I3 / I4 / I5

# 3. Solo si el operador confirma — aplicar fixes automáticos seguros
npm run integridad:reparar -- --execute
```

| Código | Auto-reparable | Acción |
|--------|----------------|--------|
| I2 | Sí | Marca OT ABIERTA/EN_PROCESO → VENCIDA si `slaVence` pasó |
| Pr3 | Sí | Marca presupuesto ENVIADO/APROBADO → VENCIDO si `fechaVencimiento` pasó |
| I3 | No | Vincular conversaciones CRM en `/crm/inbox` |
| I4 | No | Un solo predeterminado activo por plantilla/emisor/lista |
| I5 | No | Vincular `clienteId` en negocios del embudo |

Hallazgos I3–I5 requieren intervención manual; no usar `--execute` esperando que los resuelva.

---

## 13. Contactos y escalamiento

| Nivel | Acción |
|-------|--------|
| L1 | Runbook + Logs del sistema |
| L2 | Reproducir en dev con `npm run dev:reset` |
| L3 | Revisar migraciones, workers, `.env` |
| BD corrupta | Restaurar backup — ver [`16-DESPLIEGUE-PRODUCCION.md`](16-DESPLIEGUE-PRODUCCION.md) §6 |
