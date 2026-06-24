# Go-live AFIP — paso a paso en el VPS

> Guía operativa para **erp-ibiomedica.com.ar**. Tiempo estimado: **2–4 horas** (con certificados AFIP ya generados).  
> Complementa [`AFIP-PRODUCCION.md`](AFIP-PRODUCCION.md) y [`RUNBOOK-PRODUCCION.md`](RUNBOOK-PRODUCCION.md).

---

## Resumen ejecutivo

| Fase | Qué hacés | Tiempo |
|------|-----------|--------|
| 0 | Confirmar deploy y checklist | 15 min |
| 1 | Variables `.env` críticas | 20 min |
| 2 | Certificados en AFIP (portal) | 30–60 min |
| 3 | Subir certificados al ERP | 10 min |
| 4 | Workers + Redis + crons | 20 min |
| 5 | Pasar emisor a PRODUCCIÓN | 5 min |
| 6 | Primera factura real | 15 min |
| 7 | Verificación y monitoreo | 15 min |

**No emitir la primera factura real hasta completar las fases 0–5.**

---

## Fase 0 — Confirmar que prod está al día

Conectate al VPS por SSH.

```bash
cd /opt/ibiomedica
git log -1 --oneline          # debe coincidir con master en GitHub
curl -sf https://erp-ibiomedica.com.ar/api/health | jq
```

Esperado en `/api/health`:

```json
{ "ok": true, "db": "ok", "redis": "ok" }
```

Si el deploy no está al día:

```bash
bash scripts/vps-deploy-from-git.sh
```

Checklist unificado (cualquier **FAIL** hay que resolverlo antes de seguir):

```bash
npm run go-live:check
```

Smoke opcional:

```bash
npm run post-go-live:smoke
```

---

## Fase 1 — Variables `.env` en el VPS

Editar `/opt/ibiomedica/.env` (`chmod 600 .env`).

### Obligatorias para facturación real

```env
NEXTAUTH_URL="https://erp-ibiomedica.com.ar"
NEXTAUTH_SECRET="<secreto-largo>"
DATABASE_URL="postgresql://..."

STORAGE_DRIVER="s3"
S3_ENDPOINT="http://127.0.0.1:9002"
S3_BUCKET="ibiomedica"
S3_ACCESS_KEY_ID="..."
S3_SECRET_ACCESS_KEY="..."

REDIS_URL="redis://127.0.0.1:6379"

CRON_SECRET="<openssl rand -base64 32>"
INTEGRATION_SECRET="..."

ADMIN_NOTIFY_EMAIL="admin@ib.com"
SYSTEM_SMTP_HOST="smtp-mail.outlook.com"
SYSTEM_SMTP_PORT="587"
SYSTEM_SMTP_USER="alertas@tudominio.com"
SYSTEM_SMTP_PASSWORD="contraseña-de-aplicacion"
SYSTEM_SMTP_FROM_EMAIL="alertas@tudominio.com"

FACTURA_EMAIL_CLIENTE=true
```

Validar:

```bash
FORCE_PROD=1 npm run validar:env-prod
```

Reiniciar app si cambiaste `.env`:

```bash
pm2 restart ibiomedica --update-env
```

---

## Fase 2 — Certificados AFIP (portal AFIP)

Hacer esto **fuera del ERP**, en [AFIP](https://www.afip.gob.ar):

1. Ingresar con CUIT del emisor que facturará.
2. **Administrador de relaciones de clave fiscal** → nueva relación con servicio **Web Services de Facturación Electrónica (WSFE)**.
3. Generar certificado de **producción**:
   - Crear CSR / pedido de certificado según el flujo AFIP.
   - Descargar **certificado (.crt)** y conservar la **clave privada (.key)**.
4. Verificar que el **punto de venta** usado en el ERP esté habilitado para **Web Services** (distinto al talonario manual).
5. Anotar: CUIT, razón social, PtoVta, condición IVA del emisor.

> Guardar `.crt` y `.key` en lugar seguro. No subirlos al repositorio git.

---

## Fase 3 — Subir certificados al ERP

1. Login en **https://erp-ibiomedica.com.ar** con usuario admin (`config.read`).
2. **Configuración → Emisores**.
3. Editar el emisor correspondiente (CUIT correcto).
4. **Dejar ambiente en `HOMOLOGACION` por ahora.**
5. Subir:
   - Certificado (.crt / .pem)
   - Clave privada (.key)
6. Guardar.
7. Verificar en la tarjeta go-live (**Configuración → Estado go-live / AFIP**):
   - Emisor con certificados cargados
   - Badge **«Listo para facturar»** o equivalente cuando certificados OK

Opcional — probar conectividad sin emitir (con emisor aún en homologación):

```bash
npm run smoke:afip-homolog
```

Seed de plantillas (si go-live avisa plantillas faltantes):

```bash
npm run db:seed
```

---

## Fase 4 — Workers, Redis y crons

### Redis

```bash
docker compose ps   # redis debe estar up
# o verificar REDIS_URL en .env
```

### Workers PM2 (primera vez)

```bash
cd /opt/ibiomedica
bash scripts/vps-start-workers.sh
pm2 status
```

Esperado:

| Proceso | Estado |
|---------|--------|
| `ibiomedica` | online |
| `worker-afip` | online |
| `worker-cobranzas` | online (recomendado) |

```bash
pm2 save
pm2 logs worker-afip --lines 30
```

### Crons del sistema

```bash
sudo APP_URL=https://erp-ibiomedica.com.ar bash scripts/vps-install-cron.sh
```

Verificar que exista `/etc/cron.d/ibiomedica-cron`.

Probar un cron manualmente:

```bash
source .env
curl -sf -X POST "https://erp-ibiomedica.com.ar/api/cron/ots-vencidas" \
  -H "Authorization: Bearer $CRON_SECRET"
```

---

## Fase 5 — Pasar emisor a PRODUCCIÓN

**Solo cuando:**

- [ ] Certificados cargados en el emisor
- [ ] PtoVta verificado en AFIP
- [ ] `worker-afip` online
- [ ] `go-live:check` sin FAIL
- [ ] SMTP configurado (`ADMIN_NOTIFY_EMAIL` + `SYSTEM_SMTP_*`)

### En la UI

1. **Configuración → Emisores** → Editar emisor.
2. Cambiar **Ambiente** de `HOMOLOGACION` → `PRODUCCION`.
3. Marcar el checkbox: **«Confirmo certificados cargados y PtoVta verificado»**.
4. Guardar.

El sistema registra el cambio en **Auditoría** (`emisor.ambiente_change`) y en Logs (WARN).

### Verificar en CLI

```bash
npm run go-live:check
npm run integridad:prod
```

---

## Fase 6 — Primera factura real

### Preparar datos

1. **CRM → Cliente** con CUIT válido y, si aplica, sucursal de instalación.
2. **Facturación → Nueva factura**:
   - Emisor **PRODUCCIÓN**
   - Cliente con CUIT
   - Ítems con IVA correcto
   - Condición de pago (genera cuotas en Cobranzas al crear)
3. Guardar en **BORRADOR**.
4. Revisar totales y moneda.

### Emitir

1. Botón **Emitir AFIP** (o confirmar emisión).
2. Si el emisor no está listo, la UI **bloquea** con mensaje en español.
3. Esperar estado **EMITIDA** (worker AFIP procesa la cola).

### Confirmar éxito

| Check | Dónde |
|-------|--------|
| Estado `EMITIDA` | Facturación → detalle |
| CAE real (sin «CAE SIMULADO») | Observaciones / detalle AFIP |
| PDF con QR fiscal | Descargar PDF |
| Comprobante en AFIP | Consulta pública AFIP |
| Email al cliente | Si tiene email y `FACTURA_EMAIL_CLIENTE=true` |
| Cuotas creadas | Cobranzas (si condición en cuotas) |

Logs:

```bash
pm2 logs worker-afip --lines 50
```

UI: **Configuración → Logs** → filtrar `worker-afip`, `afip-notify`.

---

## Fase 7 — Post go-live (monitoreo)

### UptimeRobot

| Campo | Valor |
|-------|--------|
| URL | `https://erp-ibiomedica.com.ar/api/health` |
| Intervalo | 5 min |
| Alerta | HTTP ≠ 200 o `"ok": false` |

### Semanal

```bash
npm run go-live:check
npm run integridad:prod
```

- Campana ámbar en header (WARN recientes)
- Facturas `RECHAZADA` pendientes
- PM2: `ibiomedica`, `worker-afip`, `worker-cobranzas` online

### Resumen semanal automático

Cron domingo 08:00 → email a `ADMIN_NOTIFY_EMAIL` con KPIs.  
Probar manual:

```bash
curl -sf -X POST "https://erp-ibiomedica.com.ar/api/cron/resumen-semanal" \
  -H "Authorization: Bearer $CRON_SECRET"
```

---

## Rollback (si la emisión real falla)

1. **No borrar** facturas ya `EMITIDA` con CAE real.
2. **Configuración → Emisores** → volver ambiente a `HOMOLOGACION` hasta corregir certificados/PtoVta/datos.
3. Revisar Logs y email de alerta (`ADMIN_NOTIFY_EMAIL`).
4. Corregir causa (certificado vencido, CUIT cliente, tipo comprobante, etc.).
5. Facturas `RECHAZADA`: corregir datos y reintentar emisión desde la UI.

---

## Troubleshooting rápido

| Síntoma | Causa probable | Acción |
|---------|----------------|--------|
| Botón emitir deshabilitado | Emisor PRODUCCIÓN sin cert | Subir certificados o usar HOMOLOGACION |
| Factura queda en cola | `worker-afip` caído o sin Redis | `pm2 restart worker-afip`, verificar `REDIS_URL` |
| Estado `RECHAZADA` | Datos AFIP inválidos | Leer observaciones AFIP en la factura |
| Sin email de alerta | SMTP mal configurado | `go-live:check` sección alertas |
| Deploy falla en health | App caída o Caddy | `pm2 logs ibiomedica`, `curl localhost:3000/api/health` |
| I8 integridad error | EMITIDA sin CAE en prod | Revisar facturas afectadas antes de deploy |

---

## Comandos de referencia (copiar/pegar)

```bash
# Sesión típica post-cambios
cd /opt/ibiomedica
bash scripts/vps-deploy-from-git.sh
npm run go-live:check
npm run post-go-live:smoke
pm2 status

# Backup manual
bash scripts/vps-backup-postgres.sh
bash scripts/vps-backup-offsite.sh

# Integridad datos
npm run integridad:prod
npm run integridad:reparar              # dry-run
npm run integridad:reparar -- --execute --only I2,Pr3
```

---

## Documentación relacionada

| Doc | Contenido |
|-----|-----------|
| [`AFIP-PRODUCCION.md`](AFIP-PRODUCCION.md) | Detalle técnico AFIP |
| [`RUNBOOK-PRODUCCION.md`](RUNBOOK-PRODUCCION.md) | Operación diaria |
| [`INICIO-RAPIDO-OPERADOR.md`](INICIO-RAPIDO-OPERADOR.md) | Uso del ERP para operadores |
| [`16-DESPLIEGUE-PRODUCCION.md`](16-DESPLIEGUE-PRODUCCION.md) | Infra y variables |
| [`02-facturacion-afip.md`](02-facturacion-afip.md) | Modelo fiscal |
