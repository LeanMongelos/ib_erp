# 16 · Despliegue en producción

> Guía para llevar iBiomédica ERP a un VPS (Linux) con Docker, HTTPS y datos reales.

---

## 1. Checklist pre-producción

| Ítem | Acción |
|------|--------|
| Secretos | `NEXTAUTH_SECRET`, `INTEGRATION_SECRET`, `N8N_API_KEY`, `CRON_SECRET` — valores únicos y largos |
| URL pública | `NEXTAUTH_URL=https://erp.tudominio.com` |
| Credenciales demo | **No** usar usuarios del seed en prod; crear admin real |
| AFIP | Certificados de **producción** en emisor; ambiente `produccion` |
| Storage | `STORAGE_DRIVER=s3` + MinIO o bucket S3 real |
| Redis | `REDIS_URL` activo si usás cola AFIP |
| HTTPS | Reverse proxy (Caddy/Nginx) obligatorio para cookies seguras |
| Backups | Cron diario de PostgreSQL (ver §6) |
| Workers | PM2/systemd para `worker:*` |
| Cron | `logs:purge` diario + `/api/cron/cobranzas-vencimientos` + `/api/cron/ots-vencidas` |
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

# 7. Workers (cada uno en proceso separado)
pm2 start npm --name worker-afip -- run worker:afip
pm2 start npm --name worker-cobranzas -- run worker:cobranzas
# ... crm-email, crm-graph según integraciones activas

# 8. Permisos nuevos (si aplica)
npx tsx --env-file=.env scripts/sync-logs-permiso.ts
```

---

## 5. Actualizaciones (releases)

```bash
git pull
npm ci
npx prisma migrate deploy
npx prisma generate
npm run build
pm2 restart ibiomedica
# Reiniciar workers si cambió lógica de colas
npm run smoke    # verificación rápida post-deploy
```

---

## 6. Backups PostgreSQL

Ejemplo cron diario (ajustar rutas):

```bash
# /etc/cron.d/ibiomedica-backup
0 3 * * * deploy docker exec ibiomedica_db pg_dump -U admin ibiomedica_db | gzip > /backups/ibiomedica_$(date +\%Y\%m\%d).sql.gz
```

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
| Vencimientos cobranza | `POST /api/cron/cobranzas-vencimientos` + header `Authorization: Bearer $CRON_SECRET` | Diario |
| OT SLA vencidas | `POST /api/cron/ots-vencidas` + header `Authorization: Bearer $CRON_SECRET` (o `npm run cron:ots-vencidas`) | Cada hora |
| Integridad datos | `npm run integridad:prod` (incluido en `vps-deploy-from-git.sh`) | Post-deploy |
| Backup BD | `pg_dump` | Diario |

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
curl -I https://erp.tudominio.com/login
npm run smoke
npm run e2e        # opcional en staging
```

Login con usuario real → Configuración → Logs del sistema (si hay permiso `logs.read`).

Ver también: [`18-RUNBOOK-OPERACIONES.md`](18-RUNBOOK-OPERACIONES.md), [`17-OBSERVABILIDAD-Y-LOGS.md`](17-OBSERVABILIDAD-Y-LOGS.md).
