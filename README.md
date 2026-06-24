# iBiomédica — Sistema de Gestión (ERP · CRM · Servicio Técnico)

ERP/CRM para una empresa de **ingeniería biomédica** en Formosa, Argentina.
Gestiona clientes (con sucursales geolocalizadas), equipos médicos, órdenes de
trabajo (servicio técnico con SLA), facturación, inventario y bandeja CRM
omnicanal.

## Stack

- **Next.js 14** (App Router) · **React 18** · **TypeScript** (strict)
- **Prisma 7** con adapter `@prisma/adapter-pg` sobre **PostgreSQL 15**
- **NextAuth v4** (credenciales + JWT) · **RBAC granular**
- **Tailwind CSS 3** · Radix UI · Leaflet (mapas) · recharts · sonner
- **Zod 4** + react-hook-form para validación
- **Docker Compose** (PostgreSQL + Redis + n8n)

## Requisitos

- Node.js 20+
- Docker y Docker Compose (PostgreSQL; Redis opcional para workers)

## Puesta en marcha

1. **Instalar dependencias**

   ```bash
   npm install
   ```

2. **Configurar variables de entorno**

   ```bash
   cp .env.local.example .env
   ```

   ```env
   DATABASE_URL="postgresql://admin:admin123@localhost:5432/ibiomedica_db"
   NEXTAUTH_SECRET="<openssl rand -base64 32>"
   NEXTAUTH_URL="http://localhost:3001"
   PORT=3001
   ```

   > `.env` está en `.gitignore`. No commitear secretos.

3. **Levantar la base de datos**

   ```bash
   docker compose up -d
   ```

4. **Migraciones y datos de prueba**

   ```bash
   npm run db:migrate
   npm run db:seed
   ```

5. **Servidor de desarrollo**

   ```bash
   npm run dev
   ```

   Abrí [http://localhost:3001](http://localhost:3001) (puerto **3001** para no chocar con otras apps en 3000).

   Si la UI se ve sin estilos o hay errores de chunks: `npm run dev:reset`.

## Credenciales de prueba (seed)

| Rol     | Email                      | Contraseña    |
| ------- | -------------------------- | ------------- |
| ADMIN   | `admin@ib.com`     | `admin123`    |
| TÉCNICO | `nicolas@ib.com`   | `admin123`    |

> Solo desarrollo. Cambiar antes de producción.

## Scripts

| Script              | Descripción                                      |
| ------------------- | ------------------------------------------------ |
| `npm run dev`       | Servidor de desarrollo (puerto 3001 por defecto) |
| `npm run dev:status`| Ver si Docker + Next están arriba                |
| `npm run dev:reset` | Limpia `.next`, regenera Prisma, inicia dev      |
| `npm run build`     | Build de producción                              |
| `npm run start`     | Servir build de producción                       |
| `npm run lint`      | ESLint                                           |
| `npm run smoke`     | Smoke test Prisma + contabilidad                 |
| `npm run e2e`       | Revisión E2E CRM, sucursales, historial, mapa    |
| `npm run e2e:all`   | Smoke + E2E                                      |
| `npm run db:migrate`| Migraciones Prisma                               |
| `npm run db:seed`   | Datos demo                                       |
| `npm run db:studio` | Prisma Studio                                    |
| `npm run db:reset`  | Reset completo de BD (¡borra todo!)              |
| `npm run logs:purge`| Elimina logs del sistema con más de 15 días      |
| `npm run icons:generate` | Regenera favicon IB desde `logo.png`        |

### Workers (procesos separados)

| Script | Descripción |
|--------|-------------|
| `npm run worker:afip` | Cola emisión AFIP (requiere Redis) |
| `npm run worker:cobranzas` | Avisos vencimientos cobranza |
| `npm run worker:crm-email` | Poll IMAP CRM |
| `npm run worker:crm-graph` | Poll Microsoft Graph |

### Scripts auxiliares

| Comando | Uso |
|---------|-----|
| `npx tsx --env-file=.env scripts/demo-historial-graciela.ts` | Demo historial CRM (Clínica San Juan / Graciela) |
| `npx tsx --env-file=.env scripts/reset-role-permisos.ts ADMINISTRACION` | Restaurar permisos de un rol |
| `npx tsx --env-file=.env scripts/sync-logs-permiso.ts` | Sincronizar permiso `logs.read` en BD |

## Rutas principales

| Ruta | Módulo |
|------|--------|
| `/dashboard` | KPIs |
| `/crm`, `/crm/nuevo`, `/crm/inbox` | Clientes, alta, bandeja omnicanal |
| `/crm/[id]` | Ficha 360° + sucursales |
| `/presupuestos`, `/facturacion/nueva` | Comercial |
| `/servicio-tecnico`, `/servicio-tecnico/mapa` | OT + mapa interactivo |
| `/configuracion/*` | Emisores, plantillas, usuarios, integraciones, **logs**, auditoría |

## Checklist producción

Antes de abrir a usuarios reales:

- [ ] Cambiar secretos (`NEXTAUTH_SECRET`, `INTEGRATION_SECRET`, `CRON_SECRET`, …)
- [ ] `NEXTAUTH_URL` con dominio HTTPS real
- [ ] Eliminar o cambiar usuarios demo del seed
- [ ] Certificados AFIP de **producción** en emisores
- [ ] `docker compose up -d` + `npx prisma migrate deploy`
- [ ] `npm run build && npm run start` (no `npm run dev`)
- [ ] Workers y cron (`logs:purge`, cobranzas) en PM2/systemd
- [ ] Backup diario PostgreSQL
- [ ] `npm run smoke` post-deploy

Guía completa: **[docs/16-DESPLIEGUE-PRODUCCION.md](docs/16-DESPLIEGUE-PRODUCCION.md)** · Runbook: **[docs/18-RUNBOOK-OPERACIONES.md](docs/18-RUNBOOK-OPERACIONES.md)**

## Funcionalidades destacadas

### Clientes y sucursales
- Alta en `/crm/nuevo` con **sede fiscal** (opcional) y **sucursales de instalación** (obligatorias).
- Calle y **número separados**, validación en **mapa** (Nominatim) antes de guardar.
- Tipo **Organismo público** para Ministerio de Salud y entidades multi-sede.
- Sucursales reutilizables en facturación y posicionamiento de equipos.

### CRM Bandeja
- Inbox omnicanal (email, WhatsApp, etc.).
- **Historial del cliente**: OTs y productos facturados; clic abre detalle de OT o producto.
- Vincular prospecto como cliente (`ClienteProspectoModal`).

### Facturación de equipos
- Ítems `EQUIPO` exigen **sucursal de instalación** obligatoria.
- **Carga rápida de sucursal** desde la factura si no existe en el cliente.
- Provisión automática: equipo + kit + preventivo + posición en mapa.

### Observabilidad
- **Auditoría** (`/configuracion/auditoria`): quién cambió qué.
- **Logs del sistema** (`/configuracion/logs`): errores técnicos, 15 días, filtros por día.

## Estructura

```
app/
  (auth)/login/           Login
  (dashboard)/            Panel protegido
  api/                    REST (clientes, ots, facturas, crm, geocoding…)
components/
  clientes/               SucursalesEditor, SucursalRapidaModal, mapa
  crm/                    Bandeja, historial, ficha, embudo
  facturacion/            NuevaFacturaForm
lib/
  clientes/crear-cliente.ts
  facturas/validar-sucursal-equipo.ts
  equipos/provisionar-venta.ts
  geocoding.ts
  validation.ts             Esquemas Zod
docs/                       Documentación completa → docs/README.md
scripts/                    e2e-smoke, e2e-revision, demo-historial-graciela
prisma/                     schema, migraciones, seed
```

## Seguridad

- **NextAuth** JWT + middleware en rutas del dashboard.
- **RBAC** por permiso (`requirePermission`) en cada API.
- Validación **Zod** en todos los endpoints.
- Totales de factura recalculados en servidor.
- No importar módulos server-only (`api-auth`, `storage`) desde `'use client'`.

## Documentación

| Doc | Contenido |
|-----|-----------|
| **[docs/README.md](docs/README.md)** | Índice completo |
| **[AGENTS.md](AGENTS.md)** | Guía para agentes IA / devs |
| **[CONTRIBUTING.md](CONTRIBUTING.md)** | Cómo contribuir |
| **[docs/16-DESPLIEGUE-PRODUCCION.md](docs/16-DESPLIEGUE-PRODUCCION.md)** | Deploy VPS |
| **[docs/18-RUNBOOK-OPERACIONES.md](docs/18-RUNBOOK-OPERACIONES.md)** | Troubleshooting |
| **[docs/20-GLOSARIO-DOMINIO.md](docs/20-GLOSARIO-DOMINIO.md)** | Términos de negocio |
| **[docs/22-MAPA-MODULOS.md](docs/22-MAPA-MODULOS.md)** | Ruta → API → permisos |

## Automatizaciones (n8n)

n8n en [http://localhost:5678](http://localhost:5678). Webhooks y API `/api/n8n/*` para leads, OTs y respuestas CRM.
