# Runbook de producción — iBiomédica ERP

> Una sola página para el operador en el VPS. No es guía de desarrollo.

---

## Antes del go-live

| Paso | Comando / acción |
|------|------------------|
| Checklist unificado | `npm run go-live:check` |
| Detalle AFIP | [`AFIP-PRODUCCION.md`](AFIP-PRODUCCION.md) |
| Variables `.env` | [`16-DESPLIEGUE-PRODUCCION.md`](16-DESPLIEGUE-PRODUCCION.md) §3 |
| Usuarios demo | **No** usar seed en prod — crear admin real |

---

## Deploy y actualizaciones

```bash
cd /opt/ibiomedica
bash scripts/vps-deploy-from-git.sh
```

Incluye: pull, validación env, build, `test:invariants`, `integridad:prod`, reinicio PM2 y workers.

**Primera vez (workers):** `bash scripts/vps-start-workers.sh`

**Cron del sistema:** `sudo APP_URL=https://tu-dominio bash scripts/vps-install-cron.sh`

Detalle: [`16-DESPLIEGUE-PRODUCCION.md`](16-DESPLIEGUE-PRODUCCION.md) §5–§8.

---

## Día 1 — checklist operador

1. `npm run go-live:check` → sin FAIL
2. `npm run post-go-live:smoke` → health + PM2 online
3. Login con usuario real (no demo)
4. Configuración → Emisores → certificados PRODUCCION cargados
5. Configuración → Integraciones → SMTP o EMAIL_IMAP conectado
6. Emitir **una** factura de prueba baja → verificar CAE + PDF + email cliente (si tiene email)
7. Configuración → Logs → sin errores críticos recientes

---

## Monitoreo (UptimeRobot / similar)

**URL:** `GET https://erp-ibiomedica.com.ar/api/health`

**Respuesta esperada (HTTP 200):**

```json
{
  "ok": true,
  "db": "ok",
  "redis": "ok",
  "version": "0.1.0",
  "commit": "36a15d0abcd",
  "ts": "2026-06-24T12:00:00.000Z"
}
```

- `"ok": false` o HTTP **503** → PostgreSQL caído (alerta inmediata).
- `"redis": "skipped"` → normal si no hay `REDIS_URL`.
- `"redis": "error"` → cola AFIP afectada; revisar Redis/PM2.

| Campo UptimeRobot | Valor |
|-------------------|-------|
| Tipo | HTTP(s) |
| URL | `https://erp-ibiomedica.com.ar/api/health` |
| Intervalo | 5 min |
| Alerta | Si HTTP ≠ 200 o `"ok"` ≠ true |

| Campo | Qué mirar |
|-------|-----------|
| `db` | PostgreSQL |
| `redis` | Cola AFIP (opcional si no hay `REDIS_URL`) |
| `commit` | Versión desplegada |

---

## Cron en producción

| Tarea | Cuándo |
|-------|--------|
| Backup PostgreSQL | 03:00 diario |
| Backup off-site (S3/rsync) | 03:30 diario |
| Purga logs | 04:00 diario |
| OT SLA vencidas | Cada hora |
| Presupuestos vencidos | 05:00 diario |
| Cobranzas vencimientos | 06:00 diario |
| Stock mínimo (email admin) | 07:00 diario |

Instalación: `scripts/vps-install-cron.sh`. Manual: [`16-DESPLIEGUE-PRODUCCION.md`](16-DESPLIEGUE-PRODUCCION.md) §8.

---

## Backup y restauración

```bash
bash scripts/vps-backup-postgres.sh
bash scripts/vps-backup-offsite.sh   # requiere BACKUP_OFFSITE_* en .env
```

Retención 30 días local. Copia off-site vía `BACKUP_OFFSITE_RSYNC_TARGET` o `BACKUP_OFFSITE_S3_BUCKET` + `BACKUP_OFFSITE_S3_PREFIX` (ver `.env.local.example`).

| Variable | Uso |
|----------|-----|
| `BACKUP_DIR` | Origen local (default `/var/backups/ibiomedica`) |
| `BACKUP_OFFSITE_RSYNC_TARGET` | `user@host:/ruta/` — usa `rsync` |
| `BACKUP_OFFSITE_S3_BUCKET` | Bucket S3 — usa `aws s3 cp` si `aws` está instalado |
| `BACKUP_OFFSITE_S3_PREFIX` | Prefijo en bucket (default `ibiomedica/backups`) |

Reinstalar cron tras cambios: `sudo bash scripts/vps-install-cron.sh`

### Disaster recovery (restaurar BD)

1. **Detener escrituras:** `pm2 stop ibiomedica worker-afip worker-cobranzas worker-crm-email worker-crm-graph`
2. **Ver backup disponible:** `bash scripts/vps-restore-postgres.sh --dry-run`
3. **Restaurar** (sobrescribe la BD — pide escribir `RESTAURAR`): `bash scripts/vps-restore-postgres.sh --restore`
4. **Reiniciar:** `pm2 start ibiomedica worker-afip worker-cobranzas --update-env`
5. **Verificar:** `curl -sf https://erp-ibiomedica.com.ar/api/health` · `npm run go-live:check`

Detalle técnico: [`16-DESPLIEGUE-PRODUCCION.md`](16-DESPLIEGUE-PRODUCCION.md) §6.

---

## Smoke post go-live

```bash
npm run post-go-live:smoke
```

Verifica: `go-live:check`, health HTTP, workers PM2. Opcional AFIP homologación.

---

## Factura RECHAZADA por AFIP

| Paso | Acción |
|------|--------|
| 1 | Facturación → abrir factura → leer **Observaciones AFIP** |
| 2 | Configuración → Logs → filtrar `worker-afip` o `afip-notify` |
| 3 | Verificar emisor: certificado vigente, ambiente correcto, punto de venta |
| 4 | Corregir datos (CUIT cliente, montos, tipo comprobante) |
| 5 | Reintentar emisión desde la factura (estado `RECHAZADA` permite reemitir) |

**Alerta admin:** un email a `ADMIN_NOTIFY_EMAIL` por factura rechazada (sin spam).

Causas frecuentes: certificado vencido, CUIT inválido, PtoVta no habilitado en AFIP, emisor PRODUCCION sin certificados.

Detalle: [`02-facturacion-afip.md`](02-facturacion-afip.md) · [`AFIP-PRODUCCION.md`](AFIP-PRODUCCION.md).

---

## Email factura al cliente

Tras emisión `EMITIDA`, el ERP envía PDF al email del cliente (si tiene email cargado).

| Control | Cómo |
|---------|------|
| Desactivar global | `FACTURA_EMAIL_CLIENTE=false` en `.env` |
| Opt-out por cliente | Agregar `[no-email-factura]` en notas del cliente |
| Sin email | No envía — revisar ficha cliente o contacto principal |
| Fallo de envío | No bloquea emisión — ver Logs (`factura-cliente-email`) |

Plantilla editable: Configuración → Notificaciones → `FACTURA_EMITIDA`.

---

## Email recordatorio cobranza al cliente

El cron/worker de cobranzas envía recordatorio al email del cliente cuando una cuota **vence** o está **próxima** (N días antes, regla `cobranza.proximo` o `COBRANZA_RECORDATORIO_DIAS`).

| Control | Cómo |
|---------|------|
| Desactivar global | `COBRANZA_EMAIL_CLIENTE=false` en `.env` |
| Opt-out por cliente | `[no-email-cobranza]` o `[no-email-factura]` en notas del cliente |
| Sin email | No envía — revisar ficha cliente o contacto principal |
| Fallo de envío | No bloquea cron — ver Logs (`cobranza-cliente-email`) |
| Dedup | Una vez por cuota y tipo (vencido / próximo) vía SystemLog |

Plantilla editable: Configuración → Notificaciones → `COBRANZA_RECORDATORIO`.

Aviso **interno** a cobranzas (Guillermo/Lucas) sigue con `COBRANZA_NOTIFY_EMAIL`.

---

## Email OT cerrada al cliente

Tras cerrar OT (`CERRADA`), el ERP envía resumen al email del cliente (si tiene email cargado).

| Control | Cómo |
|---------|------|
| Desactivar global | `OT_EMAIL_CLIENTE=false` en `.env` |
| Opt-out por cliente | `[no-email-ot]` o `[no-email-factura]` en notas del cliente |
| Fallo de envío | No bloquea cierre — ver Logs (`ot-cliente-email`) |
| Dedup | Una vez por OT vía SystemLog |

Plantilla editable: Configuración → Notificaciones → `OT_CERRADA`.

---

## Email presupuesto al cliente

Tras marcar presupuesto `ENVIADO`, el ERP envía PDF al email del cliente.

| Control | Cómo |
|---------|------|
| Desactivar global | `PRESUPUESTO_EMAIL_CLIENTE=false` en `.env` |
| Opt-out por cliente | `[no-email-presupuesto]` o `[no-email-factura]` en notas del cliente |
| Fallo de envío | No bloquea transición — ver Logs (`presupuesto-cliente-email`) |
| Dedup | Una vez por presupuesto vía SystemLog |

Plantilla editable: Configuración → Notificaciones → `PRESUPUESTO_ENVIADO`.

---

## Alerta stock mínimo (admin)

Cron diario envía email cuando `stock <= stockMinimo` (dedup diaria por artículo).

| Control | Cómo |
|---------|------|
| Desactivar global | `STOCK_MINIMO_EMAIL=false` en `.env` |
| Destinatarios | `STOCK_MINIMO_NOTIFY_EMAIL` (coma-separados) o `ADMIN_NOTIFY_EMAIL` |
| Manual | `npm run cron:stock-minimo` o `POST /api/cron/stock-minimo` |
| Integridad | `integridad:prod` advierte artículos bajo mínimo |

---

## CRM en producción (IMAP / Graph / n8n)

Bandeja omnicanal en `/crm/inbox`. Correo entrante vía workers PM2; credenciales en **Configuración → Integraciones** (no en git).

### Checklist CRM

```bash
npm run go-live:check   # sección 2e — CRM
pm2 status              # worker-crm-email / worker-crm-graph online
```

| Canal | Integración | Worker PM2 | Poll |
|-------|-------------|------------|------|
| Correo IMAP/SMTP | `EMAIL_IMAP` — host, usuario, contraseña | `worker-crm-email` | `CRM_EMAIL_POLL_MS` |
| Outlook / Graph | `EMAIL_GRAPH` — Azure app + OAuth | `worker-crm-graph` | `CRM_GRAPH_POLL_MS` |
| Automatizaciones | `N8N` — webhook + apiKey | — | — |

**Primera vez workers CRM:**

```bash
cd /opt/ibiomedica
bash scripts/vps-start-workers.sh
pm2 logs worker-crm-email --lines 30
pm2 logs worker-crm-graph --lines 30
```

### IMAP (ej. @hotmail / buzón actual)

1. Configuración → Integraciones → **Correo IMAP/SMTP**
2. Completar IMAP host/puerto, usuario, contraseña de aplicación
3. **Probar conexión** → estado `CONECTADO`
4. Verificar `worker-crm-email` online en PM2
5. Enviar email de prueba al buzón → debe aparecer en `/crm/inbox` en ~2 min

### Microsoft Graph (dominio propio / Outlook 365)

1. Azure Portal → App registration → permisos `Mail.Read`, `Mail.Send`, `offline_access`
2. Integraciones → **Microsoft Graph** → tenantId, clientId, clientSecret, mailbox
3. **Autorizar OAuth** → estado `CONECTADO`
4. Verificar `worker-crm-graph` online

### n8n webhooks (salientes / entrantes)

| Dirección | Detalle |
|-----------|---------|
| ERP → n8n | Eventos `mensaje.nuevo`, etc. → URL en canal N8N |
| n8n → ERP | `POST /api/n8n/*` con header `Authorization: Bearer $N8N_API_KEY` |

Rutas protegidas (401 sin Bearer válido): `crear-lead`, `crear-ot`, `responder`, `etiquetar`.  
Verificar: `npm run test:invariants` incluye `test-n8n-api-security.ts`.

n8n en VPS: Docker `127.0.0.1:5678` — no exponer públicamente; túnel o VPN si hace falta.

### Troubleshooting CRM

| Síntoma | Acción |
|---------|--------|
| Inbox vacío con email enviado | PM2 workers · Integraciones → CONECTADO · Logs `worker-crm` |
| WARN go-live CRM | Completar credenciales parciales o desactivar canal |
| n8n 401 | Alinear `N8N_API_KEY` en `.env` con canal N8N o workflow |

Detalle: [`05-crm-omnicanal.md`](05-crm-omnicanal.md) · [`18-RUNBOOK-OPERACIONES.md`](18-RUNBOOK-OPERACIONES.md) §6.

---

## Workers PM2

```bash
pm2 status
pm2 logs worker-afip --lines 50
```

| Worker | Función |
|--------|---------|
| `ibiomedica` | App Next.js |
| `worker-afip` | Cola emisión AFIP |
| `worker-cobranzas` | Avisos vencimiento |
| `worker-crm-email` | Bandeja email CRM |
| `worker-crm-graph` | Outlook Graph CRM |

Reiniciar: `pm2 restart ibiomedica worker-afip worker-cobranzas --update-env`

---

## Troubleshooting rápido

| Problema | Ver |
|----------|-----|
| App no carga | [`18-RUNBOOK-OPERACIONES.md`](18-RUNBOOK-OPERACIONES.md) §1 |
| AFIP no emite | §5 mismo doc + este runbook § RECHAZADA |
| CRM sin email | [`18-RUNBOOK-OPERACIONES.md`](18-RUNBOOK-OPERACIONES.md) §6 |
| Cobranzas sin aviso | §7 mismo doc |
| Permisos usuario | §4 mismo doc — cerrar sesión y reentrar |

---

## Enlaces canónicos

| Tema | Documento |
|------|-----------|
| Deploy completo | [`16-DESPLIEGUE-PRODUCCION.md`](16-DESPLIEGUE-PRODUCCION.md) |
| AFIP producción | [`AFIP-PRODUCCION.md`](AFIP-PRODUCCION.md) |
| Operaciones dev/ops | [`18-RUNBOOK-OPERACIONES.md`](18-RUNBOOK-OPERACIONES.md) |
| Logs vs auditoría | [`17-OBSERVABILIDAD-Y-LOGS.md`](17-OBSERVABILIDAD-Y-LOGS.md) |
| Invariantes | [`INVARIANTES.md`](INVARIANTES.md) |
