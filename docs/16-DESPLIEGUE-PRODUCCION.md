# 16 · Despliegue en producción

> Guía para llevar iBiomédica ERP a un VPS (Linux) con Docker, HTTPS y datos reales.

---

## 1. Checklist pre-producción

| Ítem | Acción |
|------|--------|
| Secretos | `NEXTAUTH_SECRET`, `INTEGRATION_SECRET`, `N8N_API_KEY`, `CRON_SECRET` — valores únicos y largos |
| URL pública | `NEXTAUTH_URL=https://erp.tudominio.com` |
| Credenciales demo | **No** usar usuarios del seed en prod; crear admin real |
| AFIP | Certificados de **producción** en emisor; ambiente `PRODUCCION` — ver [`AFIP-PRODUCCION.md`](AFIP-PRODUCCION.md) |
| Storage | `STORAGE_DRIVER=s3` + MinIO o bucket S3 real |
| Redis | `REDIS_URL` activo si usás cola AFIP |
| HTTPS | Reverse proxy (Caddy/Nginx) obligatorio para cookies seguras |
| Backups | Cron diario de PostgreSQL (ver §6) |
| Workers | PM2/systemd para `worker:*` |
| Cron | `logs:purge` diario + `/api/cron/cobranzas-vencimientos` + `/api/cron/ots-vencidas` + `/api/cron/presupuestos-vencidos` |
| Migraciones | `npx prisma migrate deploy` (nunca `migrate dev` en prod) |
| Build | `npm run build && npm run start` o PM2 con `next start` |
| Permisos RBAC | Tras deploy con permisos nuevos: `npm run db:seed` parcial o scripts de sync |

---

## 2. Arquitectura recomendada (VPS)

```mermaid
graph TB
  User[Usuarios] --> Proxy[Caddy / Nginx :443]
  Proxy --> Next[Next.js :3000]
  Next --> PG[(PostgreSQL)]
  Next --> Redis[(Redis)]
  Next --> MinIO[(MinIO / S3)]
  W1[worker:afip] --> Redis
  W2[worker:crm-*] --> PG
  W3[worker:cobranzas] --> PG
  Cron[cron sistema] --> Next
  Cron --> Purge[logs:purge]
```

**Mínimo viable:** Next.js + PostgreSQL.  
**Recomendado:** + Redis + workers + MinIO + reverse proxy SSL.

---

## 3. Variables de entorno (producción)

Copiar `.env.local.example` → `.env` en el servidor. Cambios críticos:

```env
DATABASE_URL="postgresql://USER:PASS@localhost:5432/ibiomedica_db"
NEXTAUTH_SECRET="<openssl rand -base64 32>"
NEXTAUTH_URL="https://erp.tudominio.com"

STORAGE_DRIVER="s3"
S3_ENDPOINT="http://127.0.0.1:9000"
S3_BUCKET="ibiomedica"
S3_ACCESS_KEY_ID="..."
S3_SECRET_ACCESS_KEY="..."

REDIS_URL="redis://127.0.0.1:6379"
INTEGRATION_SECRET="..."
N8N_API_KEY="..."
CRON_SECRET="..."
META_VERIFY_TOKEN="..."

# AFIP (según emisor en BD + certificados subidos)
AFIP_ACCESS_TOKEN="..."
```

No commitear `.env`. Restringir permisos: `chmod 600 .env`.

---

## 4. Orden de despliegue (primera vez)

```bash
# 1. Código
git clone <repo> && cd ibiomedica
npm ci

# 2. Infra
docker compose up -d

# 3. Base de datos
npx prisma migrate deploy
npx prisma generate

# 4. Datos iniciales (solo catálogos/plantillas; revisar si conviene seed completo)
npm run db:seed   # ⚠️ incluye usuarios demo — omitir o adaptar en prod

# 5. Build app
npm run build

# 6. Arrancar app (ejemplo PM2)
pm2 start npm --name ibiomedica -- start
pm2 save

# 7. Workers PM2 (primera vez — script idempotente)
bash scripts/vps-start-workers.sh
# Equivalente manual:
# pm2 start npm --name worker-afip -- run worker:afip
# pm2 start npm --name worker-cobranzas -- run worker:cobranzas
# pm2 start npm --name worker-crm-email -- run worker:crm-email
# pm2 start npm --name worker-crm-graph -- run worker:crm-graph
# pm2 save

# 8. Permisos nuevos (si aplica)
npx tsx --env-file=.env scripts/sync-logs-permiso.ts
```

---

## 5. Actualizaciones (releases)

En el VPS, el flujo habitual es **`bash scripts/vps-deploy-from-git.sh`** (también vía GitHub Actions). Ese script incluye: pull, `validar:env-prod`, build, `test:invariants`, reinicio de `ibiomedica` y —si están registrados en PM2— workers, scripts idempotentes post-deploy (con **`run_optional_step`**: un fallo emite WARN y **no tumba** el deploy), `integridad:prod` (reporte, no bloqueante) y Caddy.

**Pasos que sí bloquean el deploy si fallan:** `validar:env-prod`, `npm run build`, `test:invariants`, reinicio PM2 de `ibiomedica`.

**Primera vez (workers aún no en PM2):** en lugar de iniciar cada worker manualmente, usar el script idempotente:

```bash
cd /opt/ibiomedica
bash scripts/vps-start-workers.sh
```

Registra `worker-afip`, `worker-cobranzas`, `worker-crm-email` y `worker-crm-graph` solo si no existen en PM2; luego `pm2 save`.

Al final intenta instalar `/etc/cron.d/ibiomedica-cron` con `vps-install-cron.sh` si el proceso tiene root o `sudo` sin contraseña sobre `/etc/cron.d/`; si no, imprime `cron: manual — run sudo bash scripts/vps-install-cron.sh` y continúa.

Manual equivalente:

```bash
git pull
npm ci
npx prisma migrate deploy
npx prisma generate
npm run build
pm2 restart ibiomedica
pm2 restart worker-afip worker-cobranzas worker-crm-email worker-crm-graph --update-env   # solo si existen en PM2
FORCE_PROD=1 npm run validar:env-prod
npm run smoke    # verificación rápida post-deploy
```

---

## 6. Backups PostgreSQL

Script idempotente con retención 30 días:

```bash
# Manual
bash scripts/vps-backup-postgres.sh

# Variables opcionales
BACKUP_DIR=/var/backups/ibiomedica RETENTION_DAYS=30 bash scripts/vps-backup-postgres.sh
```

Se instala en cron diario **03:00** vía `vps-install-cron.sh` (fallo seguro: log en `/var/log/ibiomedica-backup.log`, no rompe otras tareas).

Retención sugerida: 30 días local + copia off-site.

---

## 7. Reverse proxy (Caddy — ejemplo)

```caddy
erp.tudominio.com {
  reverse_proxy localhost:3000
}
```

Con Nginx: proxy_pass a `:3000`, headers `X-Forwarded-For`, `X-Forwarded-Proto`.

---

## 8. Cron en producción

| Tarea | Comando / endpoint | Frecuencia |
|-------|-------------------|------------|
| Purga logs sistema | `npm run logs:purge` | Diario 04:00 |
| Vencimientos cobranza | `POST /api/cron/cobranzas-vencimientos` + header `Authorization: Bearer $CRON_SECRET` | Diario 06:00 |
| Cuotas alquiler | `POST /api/cron/alquiler-cuotas` + header `Authorization: Bearer $CRON_SECRET` (o `npm run cron:alquiler-cuotas`) | Diario 06:15 |
| OT SLA vencidas | `POST /api/cron/ots-vencidas` + header `Authorization: Bearer $CRON_SECRET` (o `npm run cron:ots-vencidas`) | Cada hora |
| Presupuestos vencidos | `POST /api/cron/presupuestos-vencidos` + header `Authorization: Bearer $CRON_SECRET` (o `npm run cron:presupuestos-vencidos`) | Diario |
| Integridad datos | `npm run integridad:prod` (post-deploy, WARN si falla — no bloquea deploy) | Post-deploy / manual |
| Backup BD | `scripts/vps-backup-postgres.sh` | Diario 03:00 |
| Validación env | `npm run validar:env-prod` | Pre-deploy |

**Instalación automatizada:** `vps-deploy-from-git.sh` la intenta al final de cada deploy (si hay permisos). Primera vez o sin sudo en el deploy user:

```bash
cd /opt/ibiomedica
sudo APP_URL=https://erp.tudominio.com bash scripts/vps-install-cron.sh
```

Genera `/etc/cron.d/ibiomedica-cron` con: backup PostgreSQL (03:00), `logs:purge` (04:00), OT SLA (cada hora), presupuestos vencidos (05:00), cobranzas (06:00), **cuotas alquiler (06:15)**, notificaciones operativas (06:30), stock mínimo (07:00), resumen semanal (dom 08:00). Requiere `CRON_SECRET` en `/opt/ibiomedica/.env`.

**Rotación de `CRON_SECRET`:** generar valor nuevo (`openssl rand -base64 32`), actualizar `.env` en el VPS, reiniciar la app (`pm2 restart ibiomedica`), y actualizar el mismo valor en `/etc/cron.d/ibiomedica-cron` (o re-ejecutar `vps-install-cron.sh`). Probar con `curl -sf -X POST $APP_URL/api/cron/ots-vencidas -H "Authorization: Bearer $CRON_SECRET"`. Sin reinicio de app + cron, las rutas `/api/cron/*` rechazan con 401.

Ejemplo manual equivalente:

```bash
# OT SLA vencidas — cada hora
0 * * * * deploy bash -c 'set -a; source /opt/ibiomedica/.env; set +a; curl -sf -X POST https://erp-ibiomedica.com.ar/api/cron/ots-vencidas -H "Authorization: Bearer $CRON_SECRET"'

# Presupuestos con vigencia vencida — diario 05:00
0 5 * * * deploy bash -c 'set -a; source /opt/ibiomedica/.env; set +a; curl -sf -X POST https://erp-ibiomedica.com.ar/api/cron/presupuestos-vencidos -H "Authorization: Bearer $CRON_SECRET"'

# Cuotas alquiler — diario 06:15
15 6 * * * deploy bash -c 'set -a; source /opt/ibiomedica/.env; set +a; curl -sf -X POST https://erp-ibiomedica.com.ar/api/cron/alquiler-cuotas -H "Authorization: Bearer $CRON_SECRET"'
```

Alternativa local en el VPS (sin HTTP): `cd /opt/ibiomedica && npm run cron:ots-vencidas`, `npm run cron:presupuestos-vencidos` o `npm run cron:alquiler-cuotas`.

---

## 9. Qué NO hacer en producción

- `npm run dev` — usar `npm run build && npm run start`
- `prisma migrate dev` — solo `migrate deploy`
- `npm run db:reset` — borra toda la BD
- Commitear `.env`, certificados AFIP, `storage/`
- Exponer MinIO console (9001) ni PostgreSQL (5432) a internet sin firewall

---

## 10. Verificación post-deploy

```bash
curl -sf https://erp-ibiomedica.com.ar/api/health | jq
curl -I https://erp-ibiomedica.com.ar/login
npm run smoke
npm run e2e        # opcional en staging
```

**Health check (`GET /api/health`):** respuesta JSON pública (sin secretos) para UptimeRobot u otros monitores.

Ejemplo producción (`https://erp-ibiomedica.com.ar/api/health`):

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

| Campo | Significado |
|-------|-------------|
| `ok` | `true` si la BD responde |
| `db` | `ok` / `error` |
| `redis` | `ok` / `skipped` (sin `REDIS_URL`) / `error` |
| `version` | Versión del package |
| `commit` | SHA corto del deploy (`.git` o `GIT_COMMIT_SHA`) |
| `ts` | Timestamp ISO |

HTTP **503** si `db` falla.

**UptimeRobot (ejemplo):** monitor HTTP(s) cada 5 min a `https://erp-ibiomedica.com.ar/api/health`; alertar si status ≠ 200 o body sin `"ok":true`.

Login con usuario real → Configuración → Logs del sistema (si hay permiso `logs.read`).

Ver también: [`RUNBOOK-PRODUCCION.md`](RUNBOOK-PRODUCCION.md), [`18-RUNBOOK-OPERACIONES.md`](18-RUNBOOK-OPERACIONES.md), [`17-OBSERVABILIDAD-Y-LOGS.md`](17-OBSERVABILIDAD-Y-LOGS.md).
