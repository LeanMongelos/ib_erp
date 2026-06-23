# 00 — Infraestructura (desarrollo y producción)

> **Documento canónico** de infraestructura. Complementa [`16-DESPLIEGUE-PRODUCCION.md`](16-DESPLIEGUE-PRODUCCION.md) (checklist operativo).

---

## 1. Diagrama desarrollo local

```mermaid
flowchart TB
  subgraph DevMachine["PC desarrollador (Windows)"]
    NPM[npm run dev :3001]
    NEXT[Next.js hot reload]
    STG[./storage local]
  end

  subgraph DockerCompose["docker compose up -d"]
    PG[(PostgreSQL :5432<br/>ibiomedica_db)]
    RD[(Redis :6379)]
    MINIO[(MinIO :9000/9001)]
    N8N[n8n :5678]
  end

  NPM --> NEXT
  NEXT --> PG
  NEXT --> RD
  NEXT --> STG
  NEXT -.->|opcional| MINIO
  N8N -.->|webhooks| NEXT
```

### Servicios Docker (dev)

| Servicio | Puerto host | Credencial default | Uso |
|----------|-------------|-------------------|-----|
| postgres | 5432 | admin / admin123 | BD principal |
| redis | 6379 | — | BullMQ AFIP |
| minio | 9000, 9001 | admin / admin123456 | S3 dev |
| n8n | 5678 | admin / admin123 | Automatizaciones |

**Archivo:** `docker-compose.yml`  
**Variables:** `.env` (gitignored), plantilla `.env.local.example`

### Comandos dev

```bash
docker compose up -d          # Infra
cp .env.local.example .env    # Primera vez
npm install
npx prisma migrate deploy
npm run db:seed
npm run dev                   # Puerto PORT en .env (default 3001)
```

Ver [`DEV-ESTABILIDAD.md`](DEV-ESTABILIDAD.md) si CSS roto o Prisma desincronizado → `npm run dev:reset`.

---

## 2. Diagrama producción (VPS DonWeb)

```mermaid
flowchart TB
  subgraph Internet
    USER[Usuarios HTTPS/HTTP]
  end

  subgraph VPS["149.50.152.115 — Ubuntu 22.04"]
    UFW[ufw: 80,443,5244]
    CADDY[Caddy :80 → :3000]
    PM2[PM2 ibiomedica]
    APP[Next.js production build]
    ENV[.env producción]

    subgraph DockerProd["Docker localhost only"]
      PG[(5433→5432)]
      RD[(6380→6379)]
      MINIO[(9002→9000)]
    end
  end

  subgraph GitHub
    GA[Actions deploy.yml]
  end

  USER --> UFW --> CADDY --> PM2 --> APP
  APP --> ENV
  APP --> PG
  APP --> RD
  APP --> MINIO
  GA -->|SSH| VPS
```

### Rutas y paths producción

| Elemento | Valor |
|----------|-------|
| App directory | `/opt/ibiomedica` |
| Process manager | PM2 `ibiomedica` → `npm start` |
| Reverse proxy | Caddy `/etc/caddy/Caddyfile` |
| URL actual | `http://149.50.152.115` |
| SSH | puerto `5244`, usuario `root` |
| Branch deploy | `master` |

### Puertos remapeados (prod)

El VPS tiene conflictos en puertos estándar. `docker-compose.prod.yml` (generado en deploy):

| Servicio | Host | Container |
|----------|------|-----------|
| PostgreSQL | 127.0.0.1:5433 | 5432 |
| Redis | 127.0.0.1:6380 | 6379 |
| MinIO | 127.0.0.1:9002/9003 | 9000/9001 |

**DATABASE_URL** en prod debe usar `:5433`.

---

## 3. CI/CD GitHub Actions

```mermaid
flowchart LR
  PUSH[git push master] --> CI[ci.yml lint+build]
  PUSH --> DEP[deploy.yml SSH]
  DEP --> SCRIPT[vps-deploy-from-git.sh]
  SCRIPT --> BUILD[npm ci + prisma migrate + build]
  BUILD --> PM2[pm2 restart]
  PM2 --> CADDY[caddy restart]
```

| Workflow | Archivo | Trigger | Estado esperado |
|----------|---------|---------|-----------------|
| CI | `.github/workflows/ci.yml` | push/PR master | lint + build |
| Deploy | `.github/workflows/deploy.yml` | push master | SSH deploy VPS |

### Secretos GitHub (repo Settings → Secrets)

| Secreto | Descripción |
|---------|-------------|
| `VPS_HOST` | IP del VPS |
| `VPS_PORT` | SSH (5244 DonWeb) |
| `VPS_USER` | root |
| `VPS_SSH_KEY` | Clave privada ed25519 deploy |

### Script de deploy en VPS

`scripts/vps-deploy-from-git.sh`:
1. `git fetch && git reset --hard origin/master`
2. Regenera `docker-compose.prod.yml`
3. `docker compose up -d` postgres redis minio
4. `npm ci`, `prisma migrate deploy`, `npm run build`
5. `pm2 restart ibiomedica`
6. Reinicia Caddy

---

## 4. Workers y procesos background

| Proceso | Comando | Depende de | Propósito |
|---------|---------|------------|-----------|
| App web | PM2 `ibiomedica` | PG | UI + API |
| AFIP worker | `npm run worker:afip` | Redis, PG | Cola emisión fiscal |
| CRM email | `npm run worker:crm-email` | PG, IMAP config | Ingesta email |
| CRM Graph | `npm run worker:crm-graph` | PG, OAuth MS | Ingesta Outlook |
| Cobranzas | `npm run worker:cobranzas` o cron HTTP | PG | Vencimientos |

**Prod actual:** típicamente solo PM2 app. Workers deben levantarse aparte o vía cron HTTP (`/api/cron/cobranzas-vencimientos` + `CRON_SECRET`).

```mermaid
flowchart LR
  APP[Next.js] -->|encola| REDIS[(Redis)]
  REDIS --> W1[afip-worker]
  W1 --> AFIP[AFIP SDK]
  CRON[cron POST] --> APP
```

---

## 5. Almacenamiento de archivos

```mermaid
flowchart TB
  API[API upload] --> ST[lib/storage.ts]
  ST -->|STORAGE_DRIVER=local| FS[./storage/]
  ST -->|STORAGE_DRIVER=s3| S3[MinIO / AWS S3]
```

| Tipo archivo | Ruta típica |
|--------------|-------------|
| Avatares | `storage/avatars/` |
| Certificados AFIP | storage vía `Emisor.certificadoPath` |
| Imágenes plantilla | `storage/plantillas/` |
| PDF generados | stream al cliente (no siempre persistido) |

**Regla:** `storage/` está en `.gitignore`.

---

## 6. Red y seguridad perimetral

| Capa | Dev | Prod |
|------|-----|------|
| Firewall | localhost | ufw 80,443,5244 |
| TLS | No | Pendiente dominio + Caddy LE |
| DB expuesta | localhost:5432 | 127.0.0.1:5433 only |
| Headers | next.config + lib/security | Igual |

---

## 7. Scripts VPS (índice)

| Script | Cuándo usar |
|--------|-------------|
| `vps-setup-github-deploy.sh` | Setup inicial CI/CD |
| `vps-deploy-from-git.sh` | Cada deploy (automático vía GA) |
| `vps-bootstrap.sh` | Primera instalación bare metal |
| `vps-health-check.sh` | Verificar PM2, Docker, HTTP |
| `vps-fix-caddy.sh` | Reparar Caddyfile multiline |
| `vps-run-remote.sh.js` | Ejecutar script remoto desde Windows |

**No usar** `vps-deploy-remote.js` para deploys rutinarios (sube tarball; reemplazado por git pull).

---

## 8. Variables de entorno críticas

| Variable | Obligatoria | Secreto |
|----------|-------------|---------|
| `DATABASE_URL` | ✅ | ✅ |
| `NEXTAUTH_SECRET` | ✅ | ✅ |
| `NEXTAUTH_URL` | ✅ | No |
| `REDIS_URL` | Workers AFIP | No |
| `CRON_SECRET` | Cron prod | ✅ |
| `N8N_API_KEY` | API n8n | ✅ |
| `INTEGRATION_SECRET` | Cifrado canales | ✅ |
| `S3_*` | Storage S3 | ✅ |

Plantilla: `.env.local.example` — **nunca** commitear `.env`.

---

## 9. Backups recomendados (operación)

```bash
# PostgreSQL dump (en VPS)
docker exec ibiomedica_db pg_dump -U admin ibiomedica_db > backup.sql

# .env (fuera de git)
cp /opt/ibiomedica/.env /root/backups/.env.$(date +%F)
```

Programar cron diario en VPS; retener 7–30 días.

---

## 10. Health checks

| Endpoint / comando | Esperado |
|--------------------|----------|
| `GET /login` | 200 |
| `GET /api/health` | 200 `{"ok":true}` |
| `docker exec ibiomedica_db pg_isready` | accepting |
| `pm2 status` | ibiomedica online |
| `npx prisma migrate status` | up to date |
