# AFIP — Checklist producción fiscal

> Complementa [`02-facturacion-afip.md`](02-facturacion-afip.md) y [`16-DESPLIEGUE-PRODUCCION.md`](16-DESPLIEGUE-PRODUCCION.md).

---

## 0. Checklist unificado (antes de todo)

En el VPS, con `.env` de producción cargado:

```bash
cd /opt/ibiomedica
npm run go-live:check
```

Ejecuta en orden: validación de entorno (`FORCE_PROD=1`), estado de emisores AFIP en BD (ambiente + certificados) e integridad de datos (`integridad:prod`). Salida **PASS / WARN / FAIL** en español. **Cualquier FAIL bloquea** la primera factura real.

Opcional tras cargar certificados en homologación:

```bash
npm run smoke:afip-homolog   # WSAA/WSFE sin emitir comprobante
```

---

## 1. Antes del primer comprobante real

| Paso | Acción |
|------|--------|
| Certificados | Generar en AFIP **producción** (.crt + .key) para WSFE |
| Subir archivos | Configuración → Emisores → editar emisor → certificado y clave privada |
| Storage | `STORAGE_DRIVER=s3` + MinIO/S3 (los paths quedan en BD, no en repo) |
| Ambiente | Cambiar emisor de `HOMOLOGACION` → `PRODUCCION` **solo** cuando certificados estén cargados |
| Punto de venta | Verificar PtoVta habilitado en AFIP para Web Services |
| Worker | `pm2 start npm --name worker-afip -- run worker:afip` + `REDIS_URL` |
| Validación | `FORCE_PROD=1 npm run validar:env-prod` y `npm run integridad:prod` (o `npm run go-live:check` unificado) |

**Guardia en código:** si el emisor está en `PRODUCCION` sin certificados, la API **bloquea** la emisión (no llega a estado `EMITIDA`). En `HOMOLOGACION` sigue permitido CAE simulado para pruebas.

---

## 2. Variables de entorno (`.env` en VPS)

```env
REDIS_URL="redis://127.0.0.1:6379"
AFIP_ACCESS_TOKEN=""   # según @afipsdk/afip.js si aplica
STORAGE_DRIVER="s3"
S3_ENDPOINT="http://127.0.0.1:9002"
S3_BUCKET="ibiomedica"
S3_ACCESS_KEY_ID="..."
S3_SECRET_ACCESS_KEY="..."
```

Ver plantilla completa en `.env.local.example`.

---

## 3. Flujo de prueba (primera factura real)

1. Crear factura en **BORRADOR** con emisor `PRODUCCION` y cliente con CUIT válido.
2. Verificar ítems, IVA y sucursal de instalación (equipos).
3. `POST /api/facturas/[id]/emitir` (UI: botón Emitir AFIP) o cola vía worker.
4. Confirmar estado `EMITIDA`, CAE real (no texto "CAE SIMULADO"), QR y PDF.
5. Verificar en AFIP/consulta pública el comprobante.

Si falla: revisar Logs del sistema (`factura.emit_afip`), estado `RECHAZADA` y `afipObservaciones`.

---

## 4. Homologación vs producción

| | HOMOLOGACION | PRODUCCION |
|---|--------------|------------|
| Certificados | Opcionales (CAE simulado) | **Obligatorios** |
| Endpoint AFIP | Testing | Fiscal real |
| I8 integridad (sin CAE) | Advertencia | **Error** |
| Emisor sin cert en emisión | Permitido (simulado) | **Bloqueado** |

---

## 5. PM2 worker AFIP

```bash
pm2 start npm --name worker-afip -- run worker:afip
pm2 save
pm2 logs worker-afip
```

El deploy (`vps-deploy-from-git.sh`) reinicia `worker-afip` si está registrado en PM2.
